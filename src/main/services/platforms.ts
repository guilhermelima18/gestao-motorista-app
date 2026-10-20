import { platformSchema, type PlatformInput } from '@shared/schemas'
import type { Platform } from '@shared/types'
import { countRows, isUniqueViolation, nowIso, notFound, toInt, type Db } from './common'
import { DomainError } from './errors'

const SELECT = 'SELECT id, nome AS name, ativa AS active, criado_em AS createdAt FROM plataformas'

type Row = Omit<Platform, 'active'> & { active: number }
const mapRow = (row: Row): Platform => ({ ...row, active: row.active === 1 })

export function listPlatforms(db: Db): Platform[] {
  return (db.prepare(`${SELECT} ORDER BY ativa DESC, nome COLLATE NOCASE`).all() as Row[]).map(mapRow)
}

export function getPlatform(db: Db, id: number): Platform {
  const row = db.prepare(`${SELECT} WHERE id = ?`).get(id) as Row | undefined
  if (!row) throw notFound('Plataforma')
  return mapRow(row)
}

const duplicateName = () => new DomainError('NOME_DUPLICADO', 'Já existe uma plataforma com esse nome.', 'name')

export function createPlatform(db: Db, input: PlatformInput): Platform {
  const data = platformSchema.parse(input)
  try {
    const result = db
      .prepare('INSERT INTO plataformas (nome, ativa, criado_em) VALUES (?, ?, ?)')
      .run(data.name, toInt(data.active), nowIso())
    return getPlatform(db, Number(result.lastInsertRowid))
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicateName()
    throw error
  }
}

export function updatePlatform(db: Db, input: PlatformInput & { id: number }): Platform {
  const data = platformSchema.parse(input)
  getPlatform(db, input.id)
  try {
    db.prepare('UPDATE plataformas SET nome = ?, ativa = ? WHERE id = ?').run(data.name, toInt(data.active), input.id)
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicateName()
    throw error
  }
  return getPlatform(db, input.id)
}

/** Só exclui plataformas sem viagens; caso contrário orienta a desativar. */
export function deletePlatform(db: Db, id: number): void {
  getPlatform(db, id)
  const trips = countRows(db, 'SELECT COUNT(*) AS total FROM viagens WHERE plataforma_id = ?', id)
  if (trips > 0) {
    throw new DomainError(
      'POSSUI_VINCULOS',
      `Esta plataforma possui ${trips} viagem(ns) registrada(s) e não pode ser excluída. Desative-a para deixar de usá-la.`,
    )
  }
  db.prepare('DELETE FROM plataformas WHERE id = ?').run(id)
}
