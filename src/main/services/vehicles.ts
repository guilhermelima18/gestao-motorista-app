import { vehicleSchema, type VehicleInput } from '@shared/schemas'
import type { Vehicle } from '@shared/types'
import { countRows, nowIso, notFound, toInt, type Db } from './common'
import { DomainError } from './errors'

const SELECT = `SELECT id, nome AS name, marca AS brand, modelo AS model, ano AS year, placa AS plate,
  combustivel_principal AS mainFuel, quilometragem_atual AS currentOdometer, ativo AS active,
  criado_em AS createdAt, atualizado_em AS updatedAt FROM veiculos`

type Row = Omit<Vehicle, 'active'> & { active: number }
const mapRow = (row: Row): Vehicle => ({ ...row, active: row.active === 1 })

export function listVehicles(db: Db): Vehicle[] {
  return (db.prepare(`${SELECT} ORDER BY ativo DESC, nome COLLATE NOCASE`).all() as Row[]).map(mapRow)
}

export function getVehicle(db: Db, id: number): Vehicle {
  const row = db.prepare(`${SELECT} WHERE id = ?`).get(id) as Row | undefined
  if (!row) throw notFound('Veículo')
  return mapRow(row)
}

export function createVehicle(db: Db, input: VehicleInput): Vehicle {
  const data = vehicleSchema.parse(input)
  const now = nowIso()
  const result = db
    .prepare(
      `INSERT INTO veiculos (nome, marca, modelo, ano, placa, combustivel_principal, quilometragem_atual, ativo, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(data.name, data.brand, data.model, data.year, data.plate, data.mainFuel, data.currentOdometer, toInt(data.active), now, now)
  return getVehicle(db, Number(result.lastInsertRowid))
}

export function updateVehicle(db: Db, input: VehicleInput & { id: number }): Vehicle {
  const data = vehicleSchema.parse(input)
  const current = getVehicle(db, input.id)
  if (!data.active && current.active && hasOpenShift(db, input.id)) {
    throw new DomainError('VEICULO_EM_USO', 'Não é possível desativar um veículo com jornada em andamento.')
  }
  db.prepare(
    `UPDATE veiculos SET nome = ?, marca = ?, modelo = ?, ano = ?, placa = ?, combustivel_principal = ?,
       quilometragem_atual = ?, ativo = ?, atualizado_em = ? WHERE id = ?`,
  ).run(data.name, data.brand, data.model, data.year, data.plate, data.mainFuel, data.currentOdometer, toInt(data.active), nowIso(), input.id)
  return getVehicle(db, input.id)
}

function hasOpenShift(db: Db, vehicleId: number): boolean {
  return countRows(db, 'SELECT COUNT(*) AS total FROM jornadas WHERE veiculo_id = ? AND fim_em IS NULL', vehicleId) > 0
}

/** Só exclui veículos sem nenhum registro vinculado; caso contrário orienta a desativar. */
export function deleteVehicle(db: Db, id: number): void {
  getVehicle(db, id)
  const links =
    countRows(db, 'SELECT COUNT(*) AS total FROM jornadas WHERE veiculo_id = ?', id) +
    countRows(db, 'SELECT COUNT(*) AS total FROM abastecimentos WHERE veiculo_id = ?', id) +
    countRows(db, 'SELECT COUNT(*) AS total FROM despesas WHERE veiculo_id = ?', id)
  if (links > 0) {
    throw new DomainError(
      'POSSUI_VINCULOS',
      `Este veículo possui ${links} registro(s) vinculado(s) e não pode ser excluído. Desative-o para deixar de usá-lo.`,
    )
  }
  db.prepare('DELETE FROM veiculos WHERE id = ?').run(id)
}

/** Maior quilometragem conhecida do veículo: cadastro, jornadas e abastecimentos. */
export function lastKnownOdometer(db: Db, vehicleId: number): number | null {
  const row = db
    .prepare(
      `SELECT MAX(v) AS value FROM (
         SELECT quilometragem_atual AS v FROM veiculos WHERE id = ?
         UNION ALL SELECT MAX(COALESCE(quilometragem_final, quilometragem_inicial)) FROM jornadas WHERE veiculo_id = ?
         UNION ALL SELECT MAX(quilometragem) FROM abastecimentos WHERE veiculo_id = ?)`,
    )
    .get(vehicleId, vehicleId, vehicleId) as { value: number | null }
  return row.value
}

/** Atualiza a quilometragem do cadastro apenas quando o novo valor é maior. */
export function raiseVehicleOdometer(db: Db, vehicleId: number, odometer: number): void {
  db.prepare(
    `UPDATE veiculos SET quilometragem_atual = ?, atualizado_em = ?
     WHERE id = ? AND (quilometragem_atual IS NULL OR quilometragem_atual < ?)`,
  ).run(odometer, nowIso(), vehicleId, odometer)
}
