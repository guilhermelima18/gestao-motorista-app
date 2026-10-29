import type { DashboardPeriod } from '@shared/domain'
import { formatCurrency } from '@shared/money'
import { LayoutDashboard, Play } from 'lucide-react'
import { useState } from 'react'
import { GoalProgressCard } from '@/components/GoalProgressCard'
import { RevenueExpenseChart } from '@/components/RevenueExpenseChart'
import { SummaryCards } from '@/components/SummaryCards'
import { Button } from '@/components/ui/button'
import { Card, EmptyState, ErrorBlock, LoadingBlock, PageHeader, StatCard } from '@/components/ui/display'
import { useApiQuery } from '@/hooks/useApiQuery'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/dates'
import { cn } from '@/lib/utils'

const PERIODS: { value: DashboardPeriod; label: string }[] = [
  { value: 'dia', label: 'Hoje' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mês' },
]

export function DashboardPage({ onNavigate }: { onNavigate: (page: 'shifts') => void }) {
  const [period, setPeriod] = useState<DashboardPeriod>('dia')
  const dashboard = useApiQuery(() => api().dashboard.get({ period }), [period])
  const data = dashboard.data

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Seus resultados reais, calculados a partir dos registros salvos."
        actions={
          <div role="group" aria-label="Período" className="inline-flex rounded-md border border-border bg-surface p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                aria-pressed={period === p.value}
                onClick={() => setPeriod(p.value)}
                className={cn('rounded px-3 py-1 text-sm', period === p.value ? 'bg-primary text-primary-fg' : 'text-muted hover:text-fg')}
              >
                {p.label}
              </button>
            ))}
          </div>
        }
      />
      {dashboard.loading && !data ? <LoadingBlock /> : null}
      {dashboard.error ? <ErrorBlock message={dashboard.error} onRetry={dashboard.reload} /> : null}
      {data && !data.hasRecords ? (
        <EmptyState
          icon={LayoutDashboard}
          title="Ainda não há registros"
          description="Inicie sua primeira jornada para começar a acompanhar faturamento, despesas e resultado."
          action={
            <Button onClick={() => onNavigate('shifts')}>
              <Play size={16} /> Iniciar primeira jornada
            </Button>
          }
        />
      ) : null}
      {data && data.hasRecords ? (
        <div className="flex flex-col gap-5">
          {data.openShift ? (
            <Card className="flex flex-wrap items-center justify-between gap-2 border-success/50 bg-success/10">
              <div>
                <div className="font-medium text-success">Jornada em andamento</div>
                <div className="text-sm text-muted">
                  Desde {formatDateTime(data.openShift.startedAt)} · {data.openShift.vehicleName} · {formatCurrency(data.openShift.revenue)}
                </div>
              </div>
              <Button variant="outline" onClick={() => onNavigate('shifts')}>
                Gerenciar jornada
              </Button>
            </Card>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Faturado hoje" value={formatCurrency(data.todayRevenue)} />
            <StatCard label="Faturado na semana" value={formatCurrency(data.weekRevenue)} />
            <StatCard label="Faturado no mês" value={formatCurrency(data.monthRevenue)} />
          </div>
          <section aria-label="Indicadores do período">
            <SummaryCards summary={data.summary} />
          </section>
          <Card>
            <h2 className="mb-3 text-sm font-semibold">Faturamento e despesas por dia</h2>
            <RevenueExpenseChart series={data.series} />
          </Card>
          {data.goals.length > 0 ? (
            <section aria-label="Metas">
              <h2 className="mb-2 text-sm font-semibold">Metas do período atual</h2>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {data.goals.map((g) => (
                  <GoalProgressCard key={g.goal.id} progress={g} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
