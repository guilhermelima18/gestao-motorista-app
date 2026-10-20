import type { DashboardInput } from '@shared/schemas'
import { dashboardSchema } from '@shared/schemas'
import type { DashboardData } from '@shared/types'
import { addDays } from 'date-fns'
import type { Db } from './common'
import { listGoalProgress } from './goals'
import { getPeriodBounds } from './periods'
import { getOpenShift } from './shifts'
import { buildDailySeries, buildSummary } from './summary'

function countRecords(db: Db): number {
  const row = db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM jornadas) + (SELECT COUNT(*) FROM viagens) + (SELECT COUNT(*) FROM abastecimentos)
         + (SELECT COUNT(*) FROM despesas) AS total`,
    )
    .get() as { total: number }
  return row.total
}

export function getDashboard(db: Db, input: DashboardInput): DashboardData {
  const { period, reference: referenceIso } = dashboardSchema.parse(input)
  const reference = referenceIso ? new Date(referenceIso) : new Date()
  const bounds = getPeriodBounds(period, reference)

  const revenueOf = (p: 'dia' | 'semana' | 'mes') => {
    const b = getPeriodBounds(p, reference)
    return buildSummary(db, b.start, b.end).grossRevenue
  }

  // Para o dia, o gráfico mostra os últimos 7 dias; para semana e mês, o próprio período.
  const chart = period === 'dia' ? { start: addDays(bounds.start, -6), end: bounds.end } : bounds

  return {
    period,
    summary: buildSummary(db, bounds.start, bounds.end),
    todayRevenue: revenueOf('dia'),
    weekRevenue: revenueOf('semana'),
    monthRevenue: revenueOf('mes'),
    series: buildDailySeries(db, chart.start, chart.end),
    goals: listGoalProgress(db, reference),
    openShift: getOpenShift(db),
    hasRecords: countRecords(db) > 0,
  }
}
