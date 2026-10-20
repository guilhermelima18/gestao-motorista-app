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
  FROM abastecimentos a JOIN veiculos v ON v.id = a.veiculo_id`

type Row = Omit<Refueling, 'fullTank'> & { fullTank: number }
const mapRow = (row: Row): Refueling => ({ ...row, fullTank: row.fullTank === 1 })

export function listRefuelings(db: Db, filterInput: RefuelingFilter): Refueling[] {
  const filter = refuelingFilterSchema.parse(filterInput)
  const conditions: string[] = []
  const params: unknown[] = []
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
  const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''
  return (db.prepare(`${SELECT}${where} ORDER BY a.abastecido_em DESC`).all(...params) as Row[]).map(mapRow)
}

export function getRefueling(db: Db, id: number): Refueling {
  const row = db.prepare(`${SELECT} WHERE a.id = ?`).get(id) as Row | undefined
  if (!row) throw notFound('Abastecimento')
  return mapRow(row)
}

function checkRules(db: Db, data: RefuelingData): void {
  getVehicle(db, data.vehicleId)
  const shift = data.shiftId ? getShift(db, data.shiftId) : null
  validateRefueling({ vehicleId: data.vehicleId, shiftVehicleId: shift?.vehicleId ?? null })
}

export function createRefueling(db: Db, input: RefuelingInput): Refueling {
  const data = refuelingSchema.parse(input)
  const run = db.transaction(() => {
    checkRules(db, data)
    const result = db
      .prepare(
        `INSERT INTO abastecimentos (veiculo_id, jornada_id, abastecido_em, combustivel, litros, preco_por_litro,
           valor_total, quilometragem, tanque_completo, posto, observacoes, criado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        data.vehicleId, data.shiftId, toIso(data.refueledAt), data.fuel, data.liters, data.pricePerLiter,
        calculateTotalAmount(data.liters, data.pricePerLiter), data.odometer, data.fullTank ? 1 : 0,
        data.station, data.notes, nowIso(),
      )
    raiseVehicleOdometer(db, data.vehicleId, data.odometer)
    return Number(result.lastInsertRowid)
  })
  return getRefueling(db, run())
}

export function updateRefueling(db: Db, input: RefuelingInput & { id: number }): Refueling {
  const data = refuelingSchema.parse(input)
  const run = db.transaction(() => {
    getRefueling(db, input.id)
    checkRules(db, data)
    db.prepare(
      `UPDATE abastecimentos SET veiculo_id = ?, jornada_id = ?, abastecido_em = ?, combustivel = ?, litros = ?,
         preco_por_litro = ?, valor_total = ?, quilometragem = ?, tanque_completo = ?, posto = ?, observacoes = ?
       WHERE id = ?`,
    ).run(
      data.vehicleId, data.shiftId, toIso(data.refueledAt), data.fuel, data.liters, data.pricePerLiter,
      calculateTotalAmount(data.liters, data.pricePerLiter), data.odometer, data.fullTank ? 1 : 0,
      data.station, data.notes, input.id,
    )
    raiseVehicleOdometer(db, data.vehicleId, data.odometer)
  })
  run()
  return getRefueling(db, input.id)
}

export function deleteRefueling(db: Db, id: number): void {
  getRefueling(db, id)
  db.prepare('DELETE FROM abastecimentos WHERE id = ?').run(id)
}
