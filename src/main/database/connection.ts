import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { createBackup } from './backup'
import { migrate } from './migrations'

export interface DatabaseOptions {
  /** Pasta dos backups automáticos feitos antes de migrar. */
  backupFolder?: string
}

/** Abre (criando se necessário) o banco, aplica pragmas e migrações. Use ':memory:' em testes. */
export function openDatabase(filePath: string, options: DatabaseOptions = {}): Database.Database {
  if (filePath !== ':memory:') fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const db = new Database(filePath)
  try {
    db.pragma('foreign_keys = ON')
    if (filePath !== ':memory:') db.pragma('journal_mode = WAL')
    db.pragma('busy_timeout = 5000')

    const integrity = db.pragma('quick_check', { simple: true })
    if (integrity !== 'ok') throw new Error(`Falha na verificação de integridade: ${String(integrity)}`)

    migrate(db, undefined, () => {
      if (options.backupFolder) createBackup(db, options.backupFolder, 'pre-migracao')
    })
    return db
  } catch (error) {
    db.close()
    throw error
  }
}
