import { calculateTotalAmount } from '@shared/money'
import {
  refuelingFilterSchema,
  refuelingSchema,
  type RefuelingData,
  type RefuelingFilter,
  type RefuelingInput,
} from '@shared/schemas'
import type { Refueling } from '@shared/types'
import { nowIso, notFound, toIso, type Db } from './common'
import { getShift } from './shifts'
import { validateRefueling } from './validation'
import { getVehicle, raiseVehicleOdometer } from './vehicles'

const SELECT = `SELECT a.id, a.veiculo_id AS vehicleId, v.nome AS vehicleName, a.jornada_id AS shiftId,
  a.abastecido_em AS refueledAt, a.combustivel AS fuel, a.litros AS liters, a.preco_por_litro AS pricePerLiter,
  a.valor_total AS totalAmount, a.quilometragem AS odometer, a.tanque_completo AS fullTank, a.posto AS station,
  a.observacoes AS notes, a.criado_em AS createdAt
  FROM abastecimentos a JOIN veiculos v ON v.id = a.veiculo_id AND v.usuario_id = a.usuario_id`

type Row = Omit<Refueling, 'fullTank'> & { fullTank: number }
const mapRow = (row: Row): Refueling => ({ ...row, fullTank: row.fullTank === 1 })

export function listRefuelings(db: Db, userId: number, filterInput: RefuelingFilter): Refueling[] {
  const filter = refuelingFilterSchema.parse(filterInput)
  const conditions: string[] = ['a.usuario_id = ?']
  const params: unknown[] = [userId]
  if (filter.from) {
    conditions.push('a.abastecido_em >= ?')
    params.push(toIso(filter.from))
  }
  if (filter.to) {
    conditions.push('a.abastecido_em < ?')
    params.push(toIso(filter.to))
  }
  if (filter.vehicleId) {
    conditions.push('a.veiculo_id = ?')
    params.push(filter.vehicleId)
  }
  return (db.prepare(`${SELECT} WHERE ${conditions.join(' AND ')} ORDER BY a.abastecido_em DESC`).all(...params) as Row[]).map(mapRow)
}

export function getRefueling(db: Db, userId: number, id: number): Refueling {
  const row = db.prepare(`${SELECT} WHERE a.id = ? AND a.usuario_id = ?`).get(id, userId) as Row | undefined
  if (!row) throw notFound('Abastecimento')
  return mapRow(row)
}

function checkRules(db: Db, userId: number, data: RefuelingData): void {
  getVehicle(db, userId, data.vehicleId)
  const shift = data.shiftId ? getShift(db, userId, data.shiftId) : null
  validateRefueling({ vehicleId: data.vehicleId, shiftVehicleId: shift?.vehicleId ?? null })
}

export function createRefueling(db: Db, userId: number, input: RefuelingInput): Refueling {
  const data = refuelingSchema.parse(input)
  const run = db.transaction(() => {
    checkRules(db, userId, data)
    const result = db
      .prepare(
        `INSERT INTO abastecimentos (veiculo_id, jornada_id, abastecido_em, combustivel, litros, preco_por_litro,
           valor_total, quilometragem, tanque_completo, posto, observacoes, criado_em, usuario_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        data.vehicleId, data.shiftId, toIso(data.refueledAt), data.fuel, data.liters, data.pricePerLiter,
        calculateTotalAmount(data.liters, data.pricePerLiter), data.odometer, data.fullTank ? 1 : 0,
        data.station, data.notes, nowIso(), userId,
      )
    raiseVehicleOdometer(db, userId, data.vehicleId, data.odometer)
    return Number(result.lastInsertRowid)
  })
  return getRefueling(db, userId, run())
}

export function updateRefueling(db: Db, userId: number, input: RefuelingInput & { id: number }): Refueling {
  const data = refuelingSchema.parse(input)
  const run = db.transaction(() => {
    getRefueling(db, userId, input.id)
    checkRules(db, userId, data)
    db.prepare(
      `UPDATE abastecimentos SET veiculo_id = ?, jornada_id = ?, abastecido_em = ?, combustivel = ?, litros = ?,
         preco_por_litro = ?, valor_total = ?, quilometragem = ?, tanque_completo = ?, posto = ?, observacoes = ?
       WHERE id = ? AND usuario_id = ?`,
    ).run(
      data.vehicleId, data.shiftId, toIso(data.refueledAt), data.fuel, data.liters, data.pricePerLiter,
      calculateTotalAmount(data.liters, data.pricePerLiter), data.odometer, data.fullTank ? 1 : 0,
      data.station, data.notes, input.id, userId,
    )
    raiseVehicleOdometer(db, userId, data.vehicleId, data.odometer)
  })
  run()
  return getRefueling(db, userId, input.id)
}

export function deleteRefueling(db: Db, userId: number, id: number): void {
  getRefueling(db, userId, id)
  db.prepare('DELETE FROM abastecimentos WHERE id = ? AND usuario_id = ?').run(id, userId)
}
