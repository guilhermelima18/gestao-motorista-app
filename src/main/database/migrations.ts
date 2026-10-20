import { createHash } from 'node:crypto'
import type Database from 'better-sqlite3'
import { MIGRATION_001 } from './migrations/001_initial_schema'

export interface Migration {
  version: number
  name: string
  sql: string
}

/** Lista ordenada. Nunca altere uma migração já publicada: crie uma nova com ALTER TABLE/CREATE. */
export const MIGRATIONS: Migration[] = [{ version: 1, name: 'esquema_inicial', sql: MIGRATION_001 }]

function checksum(sql: string): string {
  return createHash('sha256').update(sql).digest('hex')
}

export function currentVersion(db: Database.Database): number {
  const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'migracoes'").get()
  if (!exists) return 0
  const row = db.prepare('SELECT MAX(versao) AS version FROM migracoes').get() as { version: number | null }
  return row.version ?? 0
}

/**
 * Aplica as migrações pendentes, cada uma na sua própria transação.
 * `beforeMigrate` é chamado (uma vez) quando já existem dados e há migrações pendentes — usado para backup.
 * Retorna as versões aplicadas.
 */
export function migrate(
  db: Database.Database,
  migrations: Migration[] = MIGRATIONS,
  beforeMigrate?: (previousVersion: number) => void,
): number[] {
  db.exec(`CREATE TABLE IF NOT EXISTS migracoes (
    versao INTEGER PRIMARY KEY,
    nome TEXT NOT NULL,
    checksum TEXT NOT NULL,
    aplicada_em TEXT NOT NULL
  )`)

  const applied = new Map<number, string>(
    (db.prepare('SELECT versao, checksum FROM migracoes').all() as { versao: number; checksum: string }[]).map(
      (m) => [m.versao, m.checksum],
    ),
  )
  for (const m of migrations) {
    const existing = applied.get(m.version)
    if (existing !== undefined && existing !== checksum(m.sql)) {
      throw new Error(`A migração ${m.version} (${m.name}) foi alterada após ser aplicada.`)
    }
  }

  const pending = migrations.filter((m) => !applied.has(m.version)).sort((a, b) => a.version - b.version)
  if (pending.length === 0) return []

  const previous = Math.max(0, ...applied.keys())
  if (previous > 0) beforeMigrate?.(previous)

  const register = db.prepare('INSERT INTO migracoes (versao, nome, checksum, aplicada_em) VALUES (?, ?, ?, ?)')
  const apply = db.transaction((m: Migration) => {
    db.exec(m.sql)
    register.run(m.version, m.name, checksum(m.sql), new Date().toISOString())
  })
  for (const m of pending) apply(m)
  return pending.map((m) => m.version)
}
