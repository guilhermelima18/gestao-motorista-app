import { formatCurrency } from '@shared/money'
import type { DailyPoint } from '@shared/types'
import { format, parseISO } from 'date-fns'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'

const compactCurrency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

/** Faturamento e despesas por dia, com legenda, tooltip e alternativa em tabela para acessibilidade. */
export function RevenueExpenseChart({ series }: { series: DailyPoint[] }) {
  const [asTable, setAsTable] = useState(false)
  const data = useMemo(
    () =>
      series.map((p) => ({
        label: format(parseISO(p.day), 'dd/MM'),
        Faturamento: p.revenue,
        Despesas: p.expenses,
      })),
    [series],
  )

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <ul className="flex gap-4 text-xs" aria-label="Legenda">
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--series-1)' }} /> Faturamento
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--series-2)' }} /> Despesas (inclui combustível)
          </li>
        </ul>
        <Button variant="ghost" size="sm" onClick={() => setAsTable((v) => !v)}>
          {asTable ? 'Ver gráfico' : 'Ver como tabela'}
        </Button>
      </div>
      {asTable ? (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Faturamento e despesas por dia</caption>
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="py-1">Dia</th>
                <th className="py-1 text-right">Faturamento</th>
                <th className="py-1 text-right">Despesas</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.label} className="border-t border-border">
                  <td className="py-1">{row.label}</td>
                  <td className="py-1 text-right tabular-nums">{formatCurrency(row.Faturamento)}</td>
                  <td className="py-1 text-right tabular-nums">{formatCurrency(row.Despesas)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-64 w-full" role="img" aria-label="Gráfico de barras de faturamento e despesas por dia">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" stroke="var(--muted)" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
              <YAxis
                stroke="var(--muted)"
                tick={{ fontSize: 11, fill: 'var(--muted)' }}
                tickLine={false}
                axisLine={false}
                width={64}
                tickFormatter={(v: number) => compactCurrency.format(v / 100)}
              />
              <Tooltip
                cursor={{ fill: 'var(--surface-2)' }}
                formatter={(value) => formatCurrency(Number(value))}
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--fg)' }}
                labelStyle={{ color: 'var(--fg)' }}
              />
              <Bar dataKey="Faturamento" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="Despesas" fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
