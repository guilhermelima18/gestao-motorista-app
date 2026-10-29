import { platformSchema, type PlatformInput } from '@shared/schemas'
import type { Platform } from '@shared/types'
import { countRows, isUniqueViolation, nowIso, notFound, toInt, type Db } from './common'
import { DomainError } from './errors'

const SELECT = 'SELECT id, nome AS name, ativa AS active, criado_em AS createdAt FROM plataformas'

type Row = Omit<Platform, 'active'> & { active: number }
const mapRow = (row: Row): Platform => ({ ...row, active: row.active === 1 })

export function listPlatforms(db: Db, userId: number): Platform[] {
  return (db.prepare(`${SELECT} WHERE usuario_id = ? ORDER BY ativa DESC, nome COLLATE NOCASE`).all(userId) as Row[]).map(mapRow)
}

export function getPlatform(db: Db, userId: number, id: number): Platform {
  const row = db.prepare(`${SELECT} WHERE id = ? AND usuario_id = ?`).get(id, userId) as Row | undefined
  if (!row) throw notFound('Plataforma')
  return mapRow(row)
}

const duplicateName = () => new DomainError('NOME_DUPLICADO', 'Já existe uma plataforma com esse nome.', 'name')

export function createPlatform(db: Db, userId: number, input: PlatformInput): Platform {
  const data = platformSchema.parse(input)
  try {
    const result = db
      .prepare('INSERT INTO plataformas (nome, ativa, criado_em, usuario_id) VALUES (?, ?, ?, ?)')
      .run(data.name, toInt(data.active), nowIso(), userId)
    return getPlatform(db, userId, Number(result.lastInsertRowid))
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicateName()
    throw error
  }
}

export function updatePlatform(db: Db, userId: number, input: PlatformInput & { id: number }): Platform {
  const data = platformSchema.parse(input)
  getPlatform(db, userId, input.id)
  try {
    db.prepare('UPDATE plataformas SET nome = ?, ativa = ? WHERE id = ? AND usuario_id = ?').run(
      data.name,
      toInt(data.active),
      input.id,
      userId,
    )
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicateName()
    throw error
  }
  return getPlatform(db, userId, input.id)
}

/** Só exclui plataformas sem viagens; caso contrário orienta a desativar. */
export function deletePlatform(db: Db, userId: number, id: number): void {
  getPlatform(db, userId, id)
  const trips = countRows(db, 'SELECT COUNT(*) AS total FROM viagens WHERE plataforma_id = ? AND usuario_id = ?', id, userId)
  if (trips > 0) {
    throw new DomainError(
      'POSSUI_VINCULOS',
      `Esta plataforma possui ${trips} viagem(ns) registrada(s) e não pode ser excluída. Desative-a para deixar de usá-la.`,
    )
  }
  db.prepare('DELETE FROM plataformas WHERE id = ? AND usuario_id = ?').run(id, userId)
}

/** Plataformas iniciais de uma conta nova (a primeira conta adota as que já vêm da migração 001). */
export function seedDefaultPlatforms(db: Db, userId: number): void {
  const insert = db.prepare('INSERT INTO plataformas (nome, ativa, criado_em, usuario_id) VALUES (?, 1, ?, ?)')
  for (const name of ['Uber', '99']) insert.run(name, nowIso(), userId)
}
