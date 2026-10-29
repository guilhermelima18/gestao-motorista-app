import { vehicleSchema, type VehicleInput } from '@shared/schemas'
import type { Vehicle } from '@shared/types'
import { countRows, nowIso, notFound, toInt, type Db } from './common'
import { DomainError } from './errors'

const SELECT = `SELECT id, nome AS name, marca AS brand, modelo AS model, ano AS year, placa AS plate,
  combustivel_principal AS mainFuel, quilometragem_atual AS currentOdometer, ativo AS active,
  criado_em AS createdAt, atualizado_em AS updatedAt FROM veiculos`

type Row = Omit<Vehicle, 'active'> & { active: number }
const mapRow = (row: Row): Vehicle => ({ ...row, active: row.active === 1 })

export function listVehicles(db: Db, userId: number): Vehicle[] {
  return (db.prepare(`${SELECT} WHERE usuario_id = ? ORDER BY ativo DESC, nome COLLATE NOCASE`).all(userId) as Row[]).map(mapRow)
}

export function getVehicle(db: Db, userId: number, id: number): Vehicle {
  const row = db.prepare(`${SELECT} WHERE id = ? AND usuario_id = ?`).get(id, userId) as Row | undefined
  if (!row) throw notFound('Veículo')
  return mapRow(row)
}

export function createVehicle(db: Db, userId: number, input: VehicleInput): Vehicle {
  const data = vehicleSchema.parse(input)
  const now = nowIso()
  const result = db
    .prepare(
      `INSERT INTO veiculos (nome, marca, modelo, ano, placa, combustivel_principal, quilometragem_atual, ativo, criado_em, atualizado_em, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(data.name, data.brand, data.model, data.year, data.plate, data.mainFuel, data.currentOdometer, toInt(data.active), now, now, userId)
  return getVehicle(db, userId, Number(result.lastInsertRowid))
}

export function updateVehicle(db: Db, userId: number, input: VehicleInput & { id: number }): Vehicle {
  const data = vehicleSchema.parse(input)
  const current = getVehicle(db, userId, input.id)
  if (!data.active && current.active && hasOpenShift(db, userId, input.id)) {
    throw new DomainError('VEICULO_EM_USO', 'Não é possível desativar um veículo com jornada em andamento.')
  }
  db.prepare(
    `UPDATE veiculos SET nome = ?, marca = ?, modelo = ?, ano = ?, placa = ?, combustivel_principal = ?,
       quilometragem_atual = ?, ativo = ?, atualizado_em = ? WHERE id = ? AND usuario_id = ?`,
  ).run(data.name, data.brand, data.model, data.year, data.plate, data.mainFuel, data.currentOdometer, toInt(data.active), nowIso(), input.id, userId)
  return getVehicle(db, userId, input.id)
}

function hasOpenShift(db: Db, userId: number, vehicleId: number): boolean {
  return (
    countRows(db, 'SELECT COUNT(*) AS total FROM jornadas WHERE veiculo_id = ? AND usuario_id = ? AND fim_em IS NULL', vehicleId, userId) > 0
  )
}

/** Só exclui veículos sem nenhum registro vinculado; caso contrário orienta a desativar. */
export function deleteVehicle(db: Db, userId: number, id: number): void {
  getVehicle(db, userId, id)
  const links =
    countRows(db, 'SELECT COUNT(*) AS total FROM jornadas WHERE veiculo_id = ? AND usuario_id = ?', id, userId) +
    countRows(db, 'SELECT COUNT(*) AS total FROM abastecimentos WHERE veiculo_id = ? AND usuario_id = ?', id, userId) +
    countRows(db, 'SELECT COUNT(*) AS total FROM despesas WHERE veiculo_id = ? AND usuario_id = ?', id, userId)
  if (links > 0) {
    throw new DomainError(
      'POSSUI_VINCULOS',
      `Este veículo possui ${links} registro(s) vinculado(s) e não pode ser excluído. Desative-o para deixar de usá-lo.`,
    )
  }
  db.prepare('DELETE FROM veiculos WHERE id = ? AND usuario_id = ?').run(id, userId)
}

/** Maior quilometragem conhecida do veículo: cadastro, jornadas e abastecimentos. */
export function lastKnownOdometer(db: Db, userId: number, vehicleId: number): number | null {
  const row = db
    .prepare(
      `SELECT MAX(v) AS value FROM (
         SELECT quilometragem_atual AS v FROM veiculos WHERE id = ? AND usuario_id = ?
         UNION ALL SELECT MAX(COALESCE(quilometragem_final, quilometragem_inicial)) FROM jornadas WHERE veiculo_id = ? AND usuario_id = ?
         UNION ALL SELECT MAX(quilometragem) FROM abastecimentos WHERE veiculo_id = ? AND usuario_id = ?)`,
    )
    .get(vehicleId, userId, vehicleId, userId, vehicleId, userId) as { value: number | null }
  return row.value
}

/** Atualiza a quilometragem do cadastro apenas quando o novo valor é maior. */
export function raiseVehicleOdometer(db: Db, userId: number, vehicleId: number, odometer: number): void {
  db.prepare(
    `UPDATE veiculos SET quilometragem_atual = ?, atualizado_em = ?
     WHERE id = ? AND usuario_id = ? AND (quilometragem_atual IS NULL OR quilometragem_atual < ?)`,
  ).run(odometer, nowIso(), vehicleId, userId, odometer)
}
