import type Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const MAX_BACKUPS = 10

function timestamp(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`
}

/** Cria uma cópia consistente do banco (VACUUM INTO) e mantém apenas os backups mais recentes. */
export function createBackup(db: Database.Database, folder: string, prefix = 'backup'): string {
  fs.mkdirSync(folder, { recursive: true })
  let target = path.join(folder, `gestao-motorista-${prefix}-${timestamp()}.db`)
  for (let i = 1; fs.existsSync(target); i++) {
    target = path.join(folder, `gestao-motorista-${prefix}-${timestamp()}-${i}.db`)
  }
  db.prepare('VACUUM INTO ?').run(target)
  pruneOldBackups(folder)
  return target
}

export function pruneOldBackups(folder: string, max = MAX_BACKUPS): void {
  const files = fs
    .readdirSync(folder)
    .filter((f) => f.startsWith('gestao-motorista-') && f.endsWith('.db'))
    .map((f) => ({ f, t: fs.statSync(path.join(folder, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
  for (const old of files.slice(max)) fs.rmSync(path.join(folder, old.f), { force: true })
}
