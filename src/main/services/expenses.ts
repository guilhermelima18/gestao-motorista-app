import {
  expenseFilterSchema,
  expenseSchema,
  type ExpenseData,
  type ExpenseFilter,
  type ExpenseInput,
} from '@shared/schemas'
import type { Expense } from '@shared/types'
import { nowIso, notFound, toIso, type Db } from './common'
import { getShift } from './shifts'
import { validateExpense } from './validation'
import { getVehicle } from './vehicles'

const SELECT = `SELECT d.id, d.veiculo_id AS vehicleId, v.nome AS vehicleName, d.jornada_id AS shiftId,
  d.descricao AS description, d.categoria AS category, d.valor AS amount, d.data_despesa AS expenseDate,
  d.tipo AS kind, d.observacoes AS notes, d.criado_em AS createdAt, d.atualizado_em AS updatedAt
  FROM despesas d LEFT JOIN veiculos v ON v.id = d.veiculo_id`

export function listExpenses(db: Db, filterInput: ExpenseFilter): Expense[] {
  const filter = expenseFilterSchema.parse(filterInput)
  const conditions: string[] = []
  const params: unknown[] = []
  if (filter.from) {
    conditions.push('d.data_despesa >= ?')
    params.push(toIso(filter.from))
  }
  if (filter.to) {
    conditions.push('d.data_despesa < ?')
    params.push(toIso(filter.to))
  }
  if (filter.category) {
    conditions.push('d.categoria = ?')
    params.push(filter.category)
  }
  if (filter.vehicleId) {
    conditions.push('d.veiculo_id = ?')
    params.push(filter.vehicleId)
  }
  const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''
  return db.prepare(`${SELECT}${where} ORDER BY d.data_despesa DESC`).all(...params) as Expense[]
}

export function getExpense(db: Db, id: number): Expense {
  const row = db.prepare(`${SELECT} WHERE d.id = ?`).get(id) as Expense | undefined
  if (!row) throw notFound('Despesa')
  return row
}

function checkRules(db: Db, data: ExpenseData): void {
  if (data.vehicleId) getVehicle(db, data.vehicleId)
  const shift = data.shiftId ? getShift(db, data.shiftId) : null
  validateExpense({ vehicleId: data.vehicleId, shiftVehicleId: shift?.vehicleId ?? null })
}

export function createExpense(db: Db, input: ExpenseInput): Expense {
  const data = expenseSchema.parse(input)
  checkRules(db, data)
  const now = nowIso()
  const result = db
    .prepare(
      `INSERT INTO despesas (veiculo_id, jornada_id, descricao, categoria, valor, data_despesa, tipo, observacoes, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(data.vehicleId, data.shiftId, data.description, data.category, data.amount, toIso(data.expenseDate), data.kind, data.notes, now, now)
  return getExpense(db, Number(result.lastInsertRowid))
}

export function updateExpense(db: Db, input: ExpenseInput & { id: number }): Expense {
  const data = expenseSchema.parse(input)
  getExpense(db, input.id)
  checkRules(db, data)
  db.prepare(
    `UPDATE despesas SET veiculo_id = ?, jornada_id = ?, descricao = ?, categoria = ?, valor = ?, data_despesa = ?,
       tipo = ?, observacoes = ?, atualizado_em = ? WHERE id = ?`,
  ).run(data.vehicleId, data.shiftId, data.description, data.category, data.amount, toIso(data.expenseDate), data.kind, data.notes, nowIso(), input.id)
  return getExpense(db, input.id)
}

export function deleteExpense(db: Db, id: number): void {
  getExpense(db, id)
  db.prepare('DELETE FROM despesas WHERE id = ?').run(id)
}
