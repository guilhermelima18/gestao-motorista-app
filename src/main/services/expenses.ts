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
  FROM despesas d LEFT JOIN veiculos v ON v.id = d.veiculo_id AND v.usuario_id = d.usuario_id`

export function listExpenses(db: Db, userId: number, filterInput: ExpenseFilter): Expense[] {
  const filter = expenseFilterSchema.parse(filterInput)
  const conditions: string[] = ['d.usuario_id = ?']
  const params: unknown[] = [userId]
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
  return db.prepare(`${SELECT} WHERE ${conditions.join(' AND ')} ORDER BY d.data_despesa DESC`).all(...params) as Expense[]
}

export function getExpense(db: Db, userId: number, id: number): Expense {
  const row = db.prepare(`${SELECT} WHERE d.id = ? AND d.usuario_id = ?`).get(id, userId) as Expense | undefined
  if (!row) throw notFound('Despesa')
  return row
}

function checkRules(db: Db, userId: number, data: ExpenseData): void {
  if (data.vehicleId) getVehicle(db, userId, data.vehicleId)
  const shift = data.shiftId ? getShift(db, userId, data.shiftId) : null
  validateExpense({ vehicleId: data.vehicleId, shiftVehicleId: shift?.vehicleId ?? null })
}

export function createExpense(db: Db, userId: number, input: ExpenseInput): Expense {
  const data = expenseSchema.parse(input)
  checkRules(db, userId, data)
  const now = nowIso()
  const result = db
    .prepare(
      `INSERT INTO despesas (veiculo_id, jornada_id, descricao, categoria, valor, data_despesa, tipo, observacoes, criado_em, atualizado_em, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(data.vehicleId, data.shiftId, data.description, data.category, data.amount, toIso(data.expenseDate), data.kind, data.notes, now, now, userId)
  return getExpense(db, userId, Number(result.lastInsertRowid))
}

export function updateExpense(db: Db, userId: number, input: ExpenseInput & { id: number }): Expense {
  const data = expenseSchema.parse(input)
  getExpense(db, userId, input.id)
  checkRules(db, userId, data)
  db.prepare(
    `UPDATE despesas SET veiculo_id = ?, jornada_id = ?, descricao = ?, categoria = ?, valor = ?, data_despesa = ?,
       tipo = ?, observacoes = ?, atualizado_em = ? WHERE id = ? AND usuario_id = ?`,
  ).run(data.vehicleId, data.shiftId, data.description, data.category, data.amount, toIso(data.expenseDate), data.kind, data.notes, nowIso(), input.id, userId)
  return getExpense(db, userId, input.id)
}

export function deleteExpense(db: Db, userId: number, id: number): void {
  getExpense(db, userId, id)
  db.prepare('DELETE FROM despesas WHERE id = ? AND usuario_id = ?').run(id, userId)
}
