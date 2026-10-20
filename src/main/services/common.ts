import type Database from 'better-sqlite3'
import { DomainError } from './errors'

export type Db = Database.Database

export function nowIso(): string {
  return new Date().toISOString()
}

/** Normaliza qualquer data ISO (com ou sem offset) para UTC, mantendo a ordenação textual correta. */
export function toIso(value: string): string {
  return new Date(value).toISOString()
}

export function toInt(value: boolean): number {
  return value ? 1 : 0
}

/** Contagem de registros vinculados, usada para bloquear exclusões inseguras. */
export function countRows(db: Db, sql: string, ...params: unknown[]): number {
  const row = db.prepare(sql).get(...params) as { total: number }
  return row.total
}

export function notFound(entity: string): DomainError {
  return new DomainError('NAO_ENCONTRADO', `${entity} não encontrado(a).`)
}

/** Converte violações de UNIQUE em erros de domínio amigáveis. */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed/.test(error.message)
}
