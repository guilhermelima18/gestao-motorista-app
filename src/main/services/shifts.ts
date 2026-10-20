import {
  endShiftSchema,
  shiftNotesSchema,
  startShiftSchema,
  type EndShiftInput,
  type StartShiftInput,
} from '@shared/schemas'
import type { Shift } from '@shared/types'
import { countRows, nowIso, notFound, toIso, type Db } from './common'
import { DomainError } from './errors'
import { validateShiftEnd, validateShiftStart } from './validation'
import { getVehicle, lastKnownOdometer, raiseVehicleOdometer } from './vehicles'

const SELECT = `SELECT j.id, j.veiculo_id AS vehicleId, v.nome AS vehicleName, j.inicio_em AS startedAt,
  j.fim_em AS endedAt, j.quilometragem_inicial AS startOdometer, j.quilometragem_final AS endOdometer,
  j.observacoes AS notes, j.criado_em AS createdAt, j.atualizado_em AS updatedAt,
  CASE WHEN j.fim_em IS NULL THEN NULL ELSE j.quilometragem_final - j.quilometragem_inicial END AS distanceKm,
  COALESCE((SELECT SUM(t.valor_corrida + t.gorjeta + t.adicionais) FROM viagens t WHERE t.jornada_id = j.id), 0) AS revenue,
  (SELECT COUNT(*) FROM viagens t WHERE t.jornada_id = j.id) AS tripCount
  FROM jornadas j JOIN veiculos v ON v.id = j.veiculo_id`

export function listShifts(db: Db): Shift[] {
  return db.prepare(`${SELECT} ORDER BY j.inicio_em DESC`).all() as Shift[]
}

export function getShift(db: Db, id: number): Shift {
  const row = db.prepare(`${SELECT} WHERE j.id = ?`).get(id) as Shift | undefined
  if (!row) throw notFound('Jornada')
  return row
}

export function getOpenShift(db: Db): Shift | null {
  return (db.prepare(`${SELECT} WHERE j.fim_em IS NULL`).get() as Shift | undefined) ?? null
}

/** Inicia uma jornada. Tudo ocorre em uma transação: validação, inserção e atualização do odômetro. */
export function startShift(db: Db, input: StartShiftInput): Shift {
  const data = startShiftSchema.parse(input)
  const vehicle = getVehicle(db, data.vehicleId)
  if (!vehicle.active) throw new DomainError('VEICULO_INATIVO', 'O veículo selecionado está inativo.', 'vehicleId')

  const run = db.transaction(() => {
    validateShiftStart({
      hasOpenShift: getOpenShift(db) !== null,
      lastKnownOdometer: lastKnownOdometer(db, data.vehicleId),
      startOdometer: data.startOdometer,
    })
    const now = nowIso()
    const startedAt = data.startedAt ? toIso(data.startedAt) : now
    const result = db
      .prepare(
        `INSERT INTO jornadas (veiculo_id, inicio_em, quilometragem_inicial, observacoes, criado_em, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(data.vehicleId, startedAt, data.startOdometer, data.notes, now, now)
    raiseVehicleOdometer(db, data.vehicleId, data.startOdometer)
    return Number(result.lastInsertRowid)
  })
  return getShift(db, run())
}

/** Encerra a jornada, grava a quilometragem final e atualiza o odômetro do veículo atomicamente. */
export function endShift(db: Db, input: EndShiftInput): Shift {
  const data = endShiftSchema.parse(input)
  const run = db.transaction(() => {
    const shift = getShift(db, data.id)
    if (shift.endedAt) throw new DomainError('JORNADA_ENCERRADA', 'Esta jornada já foi encerrada.')
    const endedAt = data.endedAt ? toIso(data.endedAt) : nowIso()
    validateShiftEnd({
      startedAt: shift.startedAt,
      endedAt,
      startOdometer: shift.startOdometer,
      endOdometer: data.endOdometer,
    })
    db.prepare(
      `UPDATE jornadas SET fim_em = ?, quilometragem_final = ?, observacoes = COALESCE(?, observacoes), atualizado_em = ?
       WHERE id = ?`,
    ).run(endedAt, data.endOdometer, data.notes, nowIso(), data.id)
    raiseVehicleOdometer(db, shift.vehicleId, data.endOdometer)
  })
  run()
  return getShift(db, data.id)
}

export function updateShiftNotes(db: Db, input: { id: number; notes?: string | null }): Shift {
  const data = shiftNotesSchema.parse(input)
  getShift(db, data.id)
  db.prepare('UPDATE jornadas SET observacoes = ?, atualizado_em = ? WHERE id = ?').run(data.notes, nowIso(), data.id)
  return getShift(db, data.id)
}

/** Jornadas com viagens, abastecimentos ou despesas vinculados não podem ser excluídas. */
export function deleteShift(db: Db, id: number): void {
  getShift(db, id)
  const trips = countRows(db, 'SELECT COUNT(*) AS total FROM viagens WHERE jornada_id = ?', id)
  const refuelings = countRows(db, 'SELECT COUNT(*) AS total FROM abastecimentos WHERE jornada_id = ?', id)
  const expenses = countRows(db, 'SELECT COUNT(*) AS total FROM despesas WHERE jornada_id = ?', id)
  if (trips + refuelings + expenses > 0) {
    throw new DomainError(
      'POSSUI_VINCULOS',
      `Esta jornada possui ${trips} viagem(ns), ${refuelings} abastecimento(s) e ${expenses} despesa(s) vinculados. Exclua ou desvincule esses registros antes.`,
    )
  }
  db.prepare('DELETE FROM jornadas WHERE id = ?').run(id)
}
