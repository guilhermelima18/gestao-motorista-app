import { goalSchema, type GoalInput } from '@shared/schemas'
import type { Goal, GoalProgress } from '@shared/types'
import { nowIso, notFound, toInt, type Db } from './common'
import { goalProgress } from './financial'
import { getGoalBounds } from './periods'
import { buildSummary } from './summary'

const SELECT = `SELECT id, descricao AS description, tipo AS type, periodicidade AS period, valor_objetivo AS targetAmount,
  ativa AS active, criado_em AS createdAt, atualizado_em AS updatedAt FROM metas`

type Row = Omit<Goal, 'active'> & { active: number }
const mapRow = (row: Row): Goal => ({ ...row, active: row.active === 1 })

export function listGoals(db: Db): Goal[] {
  return (db.prepare(`${SELECT} ORDER BY ativa DESC, id`).all() as Row[]).map(mapRow)
}

export function getGoal(db: Db, id: number): Goal {
  const row = db.prepare(`${SELECT} WHERE id = ?`).get(id) as Row | undefined
  if (!row) throw notFound('Meta')
  return mapRow(row)
}

export function createGoal(db: Db, input: GoalInput): Goal {
  const data = goalSchema.parse(input)
  const now = nowIso()
  const result = db
    .prepare(
      `INSERT INTO metas (descricao, tipo, periodicidade, valor_objetivo, ativa, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(data.description, data.type, data.period, data.targetAmount, toInt(data.active), now, now)
  return getGoal(db, Number(result.lastInsertRowid))
}

export function updateGoal(db: Db, input: GoalInput & { id: number }): Goal {
  const data = goalSchema.parse(input)
  getGoal(db, input.id)
  db.prepare(
    `UPDATE metas SET descricao = ?, tipo = ?, periodicidade = ?, valor_objetivo = ?, ativa = ?, atualizado_em = ? WHERE id = ?`,
  ).run(data.description, data.type, data.period, data.targetAmount, toInt(data.active), nowIso(), input.id)
  return getGoal(db, input.id)
}

export function deleteGoal(db: Db, id: number): void {
  getGoal(db, id)
  db.prepare('DELETE FROM metas WHERE id = ?').run(id)
}

/** Progresso das metas ativas no período corrente de cada uma (dia, semana ou mês). */
export function listGoalProgress(db: Db, reference: Date = new Date()): GoalProgress[] {
  return listGoals(db)
    .filter((goal) => goal.active)
    .map((goal) => {
      const { start, end } = getGoalBounds(goal.period, reference)
      const summary = buildSummary(db, start, end)
      const achieved = goal.type === 'faturamento' ? summary.grossRevenue : (summary.operatingProfit ?? 0)
      const progress = goalProgress(goal.targetAmount, achieved)
      return {
        goal,
        achieved,
        remaining: progress.remaining,
        ratio: progress.ratio,
        reached: progress.reached,
        partial: goal.type === 'lucro' && summary.profitIsPartial,
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
      }
    })
}
