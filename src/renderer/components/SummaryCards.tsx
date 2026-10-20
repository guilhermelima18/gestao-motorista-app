import { formatCurrency, formatNumber } from '@shared/money'
import type { Summary } from '@shared/types'
import { Card, StatCard } from '@/components/ui/display'
import { formatHours } from '@/lib/dates'

const orDash = (value: number | null) => (value === null ? 'Sem dados' : formatCurrency(value))

/** Indicadores do período: usados no painel e nos relatórios. */
export function SummaryCards({ summary }: { summary: Summary }) {
  const profit = summary.operatingProfit
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Faturamento bruto" value={formatCurrency(summary.grossRevenue)} hint={`${summary.tripCount} viagem(ns)`} />
        <StatCard label="Despesas pagas" value={formatCurrency(summary.totalExpenses)} />
        <StatCard label="Abastecimentos" value={formatCurrency(summary.totalRefuelings)} />
        <StatCard
          label="Resultado de caixa"
          value={formatCurrency(summary.cashResult)}
          hint="Receitas − despesas − abastecimentos lançados"
          tone={summary.cashResult < 0 ? 'danger' : undefined}
        />
        <StatCard
          label={summary.profitIsPartial ? 'Lucro operacional (parcial)' : 'Lucro operacional estimado'}
          value={profit === null ? 'Sem dados' : formatCurrency(profit)}
          hint={summary.estimatedFuelCost === null ? 'Combustível consumido não estimado' : `Combustível estimado: ${formatCurrency(summary.estimatedFuelCost)}`}
          tone={profit !== null && profit < 0 ? 'danger' : undefined}
        />
        <StatCard label="Quilometragem percorrida" value={`${formatNumber(summary.kmDriven)} km`} hint={`Deslocamento das corridas: ${formatNumber(summary.attributedDistanceKm)} km`} />
        <StatCard label="Horas trabalhadas" value={formatHours(summary.hoursWorked)} hint={`${summary.closedShifts} jornada(s) encerrada(s)`} />
        <StatCard label="Custo por km" value={orDash(summary.costPerKm)} />
        <StatCard label="Receita por hora" value={orDash(summary.revenuePerHour)} />
        <StatCard label="Receita por km" value={orDash(summary.revenuePerKm)} />
      </div>
      {summary.profitIsPartial || summary.unconsideredCosts.length > 0 ? (
        <Card className="border-warning/50 bg-warning/10 text-sm">
          <h3 className="mb-1 font-semibold text-warning">Custos não considerados no lucro operacional</h3>
          <ul className="list-disc pl-5">
            {summary.unconsideredCosts.map((c) => (
              <li key={c.item}>
                <strong>{c.item}</strong>
                {c.amount !== undefined ? ` (${formatCurrency(c.amount)} lançados)` : ''}: {c.reason}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  )
}
