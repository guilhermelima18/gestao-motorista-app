import { reportSchema, type ReportInput } from '@shared/schemas'
import type { CategoryRow, PlatformRow, ReportData } from '@shared/types'
import type { Db } from './common'
import { revenuePerKm } from './financial'
import { buildDailySeries, buildSummary } from './summary'

/** Relatório do intervalo [from, to): resumo, série diária, comparação de plataformas e despesas por categoria. */
export function generateReport(db: Db, input: ReportInput): ReportData {
  const { from, to } = reportSchema.parse(input)
  const start = new Date(from)
  const end = new Date(to)

  const platforms = (
    db
      .prepare(
        `SELECT p.nome AS platform, COUNT(t.id) AS trips,
           COALESCE(SUM(t.valor_corrida + t.gorjeta + t.adicionais), 0) AS revenue,
           COALESCE(SUM(t.distancia_km + t.quilometragem_vazia_km), 0) AS distanceKm
         FROM plataformas p LEFT JOIN viagens t ON t.plataforma_id = p.id AND t.realizada_em >= ? AND t.realizada_em < ?
         GROUP BY p.id HAVING trips > 0 ORDER BY revenue DESC`,
      )
      .all(start.toISOString(), end.toISOString()) as Omit<PlatformRow, 'revenuePerKm'>[]
  ).map((row) => ({ ...row, revenuePerKm: revenuePerKm(row.revenue, row.distanceKm) }))

  const expensesByCategory = db
    .prepare(
      `SELECT categoria AS category, SUM(valor) AS total FROM despesas
       WHERE data_despesa >= ? AND data_despesa < ? GROUP BY categoria ORDER BY total DESC`,
    )
    .all(start.toISOString(), end.toISOString()) as CategoryRow[]

  return {
    summary: buildSummary(db, start, end),
    series: buildDailySeries(db, start, end),
    platforms,
    expensesByCategory,
  }
}
