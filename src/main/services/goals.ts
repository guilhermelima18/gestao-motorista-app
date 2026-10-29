import { goalSchema, type GoalInput } from '@shared/schemas'
import type { Goal, GoalPhase, GoalProgress, Summary } from '@shared/types'
import { nowIso, notFound, toInt, type Db } from './common'
import { goalProgress } from './financial'
import { getGoalBounds } from './periods'
import { buildSummary } from './summary'

const SELECT = `SELECT id, descricao AS description, tipo AS type, periodicidade AS period, valor_objetivo AS targetAmount,
  data_referencia AS referenceDate, ativa AS active, criado_em AS createdAt, atualizado_em AS updatedAt FROM metas`

type Row = Omit<Goal, 'active'> & { active: number }
const mapRow = (row: Row): Goal => ({ ...row, active: row.active === 1 })

export function listGoals(db: Db, userId: number): Goal[] {
  return (db.prepare(`${SELECT} WHERE usuario_id = ? ORDER BY data_referencia DESC, id DESC`).all(userId) as Row[]).map(mapRow)
}

export function getGoal(db: Db, userId: number, id: number): Goal {
  const row = db.prepare(`${SELECT} WHERE id = ? AND usuario_id = ?`).get(id, userId) as Row | undefined
  if (!row) throw notFound('Meta')
  return mapRow(row)
}

export function createGoal(db: Db, userId: number, input: GoalInput): Goal {
  const data = goalSchema.parse(input)
  const now = nowIso()
  const result = db
    .prepare(
      `INSERT INTO metas (descricao, tipo, periodicidade, valor_objetivo, data_referencia, ativa, criado_em, atualizado_em, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(data.description, data.type, data.period, data.targetAmount, data.referenceDate, toInt(data.active), now, now, userId)
  return getGoal(db, userId, Number(result.lastInsertRowid))
}

export function updateGoal(db: Db, userId: number, input: GoalInput & { id: number }): Goal {
  const data = goalSchema.parse(input)
  getGoal(db, userId, input.id)
  db.prepare(
    `UPDATE metas SET descricao = ?, tipo = ?, periodicidade = ?, valor_objetivo = ?, data_referencia = ?, ativa = ?, atualizado_em = ?
     WHERE id = ? AND usuario_id = ?`,
  ).run(data.description, data.type, data.period, data.targetAmount, data.referenceDate, toInt(data.active), nowIso(), input.id, userId)
  return getGoal(db, userId, input.id)
}

export function deleteGoal(db: Db, userId: number, id: number): void {
  getGoal(db, userId, id)
  db.prepare('DELETE FROM metas WHERE id = ? AND usuario_id = ?').run(id, userId)
}

function phaseOf(start: Date, end: Date, now: Date): GoalPhase {
  if (end <= now) return 'past'
  return start > now ? 'future' : 'current'
}

/**
 * Progresso de todas as metas, cada uma no seu próprio período (o dia, a semana ou o mês que contém a data de
 * referência da meta). `phase` indica se o período está em andamento, já passou (histórico) ou ainda vai começar.
 */
export function listGoalProgress(db: Db, userId: number, now: Date = new Date()): GoalProgress[] {
  const summaries = new Map<string, Summary>() // metas do mesmo período compartilham o cálculo
  return listGoals(db, userId).map((goal) => {
    const { start, end } = getGoalBounds(goal.period, goal.referenceDate)
    const key = `${start.toISOString()}|${end.toISOString()}`
    let summary = summaries.get(key)
    if (!summary) {
      summary = buildSummary(db, userId, start, end)
      summaries.set(key, summary)
    }
    const achieved = goal.type === 'faturamento' ? summary.grossRevenue : (summary.operatingProfit ?? 0)
    const progress = goalProgress(goal.targetAmount, achieved)
    return {
      goal,
      phase: phaseOf(start, end, now),
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

/** Metas ativas cujo período contém o momento atual (o que o painel exibe; o histórico fica na tela de Metas). */
export function listCurrentGoalProgress(db: Db, userId: number, now: Date = new Date()): GoalProgress[] {
  return listGoalProgress(db, userId, now).filter((p) => p.phase === 'current' && p.goal.active)
}
