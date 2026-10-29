import {
  tripFilterSchema,
  tripSchema,
  type TripData,
  type TripFilter,
  type TripInput,
} from '@shared/schemas'
import type { Trip, TripList } from '@shared/types'
import { nowIso, notFound, toIso, type Db } from './common'
import { DomainError } from './errors'
import { tripRevenue } from './financial'
import { getPlatform } from './platforms'
import { getShift } from './shifts'
import { validateTrip } from './validation'

const SELECT = `SELECT t.id, t.jornada_id AS shiftId, t.plataforma_id AS platformId, p.nome AS platformName,
  t.realizada_em AS occurredAt, t.origem AS origin, t.destino AS destination, t.valor_corrida AS fareAmount,
  t.gorjeta AS tip, t.adicionais AS extras, t.distancia_km AS distanceKm, t.duracao_minutos AS durationMinutes,
  t.quilometragem_vazia_km AS deadheadKm, t.observacoes AS notes, t.criado_em AS createdAt,
  t.atualizado_em AS updatedAt, (t.valor_corrida + t.gorjeta + t.adicionais) AS totalRevenue
  FROM viagens t JOIN plataformas p ON p.id = t.plataforma_id AND p.usuario_id = t.usuario_id`

export function listTrips(db: Db, userId: number, filterInput: TripFilter): TripList {
  const filter = tripFilterSchema.parse(filterInput)
  const conditions: string[] = ['t.usuario_id = ?']
  const params: unknown[] = [userId]
  if (filter.from) {
    conditions.push('t.realizada_em >= ?')
    params.push(toIso(filter.from))
  }
  if (filter.to) {
    conditions.push('t.realizada_em < ?')
    params.push(toIso(filter.to))
  }
  if (filter.platformId) {
    conditions.push('t.plataforma_id = ?')
    params.push(filter.platformId)
  }
  if (filter.shiftId) {
    conditions.push('t.jornada_id = ?')
    params.push(filter.shiftId)
  }
  const items = db.prepare(`${SELECT} WHERE ${conditions.join(' AND ')} ORDER BY t.realizada_em DESC`).all(...params) as Trip[]
  return {
    items,
    totals: { tripCount: items.length, totalRevenue: items.reduce((sum, t) => sum + t.totalRevenue, 0) },
  }
}

export function getTrip(db: Db, userId: number, id: number): Trip {
  const row = db.prepare(`${SELECT} WHERE t.id = ? AND t.usuario_id = ?`).get(id, userId) as Trip | undefined
  if (!row) throw notFound('Viagem')
  return row
}

/** Valida as regras que dependem de outros registros (jornada e plataforma). */
function checkRules(db: Db, userId: number, data: TripData): void {
  const shift = getShift(db, userId, data.shiftId)
  const platform = getPlatform(db, userId, data.platformId)
  if (!platform.active) throw new DomainError('PLATAFORMA_INATIVA', 'A plataforma selecionada está inativa.', 'platformId')
  validateTrip({
    occurredAt: toIso(data.occurredAt),
    distanceKm: data.distanceKm,
    durationMinutes: data.durationMinutes,
    totalRevenue: tripRevenue(data),
    notes: data.notes,
    shift: { startedAt: shift.startedAt, endedAt: shift.endedAt },
  })
}

export function createTrip(db: Db, userId: number, input: TripInput): Trip {
  const data = tripSchema.parse(input)
  checkRules(db, userId, data)
  const now = nowIso()
  const result = db
    .prepare(
      `INSERT INTO viagens (jornada_id, plataforma_id, realizada_em, origem, destino, valor_corrida, gorjeta, adicionais,
         distancia_km, duracao_minutos, quilometragem_vazia_km, observacoes, criado_em, atualizado_em, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      data.shiftId, data.platformId, toIso(data.occurredAt), data.origin, data.destination, data.fareAmount,
      data.tip, data.extras, data.distanceKm, data.durationMinutes, data.deadheadKm, data.notes, now, now, userId,
    )
  return getTrip(db, userId, Number(result.lastInsertRowid))
}

export function updateTrip(db: Db, userId: number, input: TripInput & { id: number }): Trip {
  const data = tripSchema.parse(input)
  getTrip(db, userId, input.id)
  checkRules(db, userId, data)
  db.prepare(
    `UPDATE viagens SET jornada_id = ?, plataforma_id = ?, realizada_em = ?, origem = ?, destino = ?, valor_corrida = ?,
       gorjeta = ?, adicionais = ?, distancia_km = ?, duracao_minutos = ?, quilometragem_vazia_km = ?, observacoes = ?,
       atualizado_em = ? WHERE id = ? AND usuario_id = ?`,
  ).run(
    data.shiftId, data.platformId, toIso(data.occurredAt), data.origin, data.destination, data.fareAmount,
    data.tip, data.extras, data.distanceKm, data.durationMinutes, data.deadheadKm, data.notes, nowIso(), input.id, userId,
  )
  return getTrip(db, userId, input.id)
}

export function deleteTrip(db: Db, userId: number, id: number): void {
  getTrip(db, userId, id)
  db.prepare('DELETE FROM viagens WHERE id = ? AND usuario_id = ?').run(id, userId)
}
