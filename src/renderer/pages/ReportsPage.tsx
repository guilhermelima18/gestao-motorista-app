import { formatCurrency, formatNumber } from '@shared/money'
import { endOfMonth, format, startOfMonth } from 'date-fns'
import { useState } from 'react'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { ExportButton } from '@/components/ExportButton'
import { RevenueExpenseChart } from '@/components/RevenueExpenseChart'
import { SummaryCards } from '@/components/SummaryCards'
import { Card, ErrorBlock, LoadingBlock, PageHeader } from '@/components/ui/display'
import { useApiQuery } from '@/hooks/useApiQuery'
import { api } from '@/lib/api'
import { rangeToIso, type DateRangeValue } from '@/lib/dates'

export function ReportsPage() {
  const [range, setRange] = useState<DateRangeValue>(() => ({
    from: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    to: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  }))
  const iso = rangeToIso(range)
  const valid = Boolean(iso.from && iso.to)
  const report = useApiQuery(
    () => (valid ? api().reports.generate({ from: iso.from!, to: iso.to! }) : Promise.resolve({ ok: false as const, error: { code: 'PERIODO', message: 'Informe o período do relatório.' } })),
    [range.from, range.to],
  )
  const data = report.data

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Resultado financeiro, quilometragem e comparação de plataformas no período."
        actions={valid ? <ExportButton input={{ entity: 'report', from: iso.from!, to: iso.to! }} label="Exportar relatório" /> : null}
      />
      <div className="mb-4">
        <DateRangeFilter value={range} onChange={setRange} />
      </div>
      {report.loading && !data ? <LoadingBlock /> : null}
      {report.error ? <ErrorBlock message={report.error} onRetry={report.reload} /> : null}
      {data ? (
        <div className="flex flex-col gap-5">
          <SummaryCards summary={data.summary} />
          <Card>
            <h2 className="mb-3 text-sm font-semibold">Faturamento e despesas por dia</h2>
            <RevenueExpenseChart series={data.series} />
          </Card>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <h2 className="mb-2 text-sm font-semibold">Comparação de plataformas</h2>
              {data.platforms.length === 0 ? (
                <p className="text-sm text-muted">Sem viagens no período.</p>
              ) : (
                <table className="w-full text-sm">
                  <caption className="sr-only">Comparação de plataformas</caption>
                  <thead className="text-left text-xs text-muted">
                    <tr>
                      <th className="py-1">Plataforma</th>
                      <th className="py-1 text-right">Viagens</th>
                      <th className="py-1 text-right">Faturamento</th>
                      <th className="py-1 text-right">Km</th>
                      <th className="py-1 text-right">R$/km</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.platforms.map((p) => (
                      <tr key={p.platform} className="border-t border-border">
                        <td className="py-1 font-medium">{p.platform}</td>
                        <td className="py-1 text-right tabular-nums">{p.trips}</td>
                        <td className="py-1 text-right tabular-nums">{formatCurrency(p.revenue)}</td>
                        <td className="py-1 text-right tabular-nums">{formatNumber(p.distanceKm)}</td>
                        <td className="py-1 text-right tabular-nums">{p.revenuePerKm === null ? '—' : formatCurrency(p.revenuePerKm)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
            <Card>
              <h2 className="mb-2 text-sm font-semibold">Despesas por categoria</h2>
              {data.expensesByCategory.length === 0 ? (
                <p className="text-sm text-muted">Sem despesas no período.</p>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {data.expensesByCategory.map((c) => (
                    <li key={c.category} className="flex justify-between border-t border-border pt-1 first:border-0 first:pt-0">
                      <span>{c.category}</span>
                      <span className="tabular-nums">{formatCurrency(c.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      ) : null}
    </>
  )
}
