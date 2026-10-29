import { formatCurrency } from '@shared/money'
import type { Goal, GoalProgress } from '@shared/types'
import { Pencil, Plus, Target, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { GoalProgressCard } from '@/components/GoalProgressCard'
import { Button } from '@/components/ui/button'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge, EmptyState, ErrorBlock, LoadingBlock, PageHeader } from '@/components/ui/display'
import { Select } from '@/components/ui/form-controls'
import { Modal } from '@/components/ui/modal'
import { GoalForm } from '@/features/goals/GoalForm'
import { useApiQuery } from '@/hooks/useApiQuery'
import { useRemove } from '@/hooks/useRemove'
import { useShortcut } from '@/hooks/useShortcut'
import { api } from '@/lib/api'
import { goalPeriodLabel } from '@/lib/dates'

const PERIOD_LABEL = { diaria: 'Diária', semanal: 'Semanal', mensal: 'Mensal' } as const
const TYPE_LABEL = { faturamento: 'Faturamento', lucro: 'Lucro' } as const

type Filter = 'todas' | 'current' | 'past' | 'future'
const FILTER_LABEL: Record<Filter, string> = {
  todas: 'Todas as metas',
  current: 'Em andamento',
  past: 'Histórico (períodos encerrados)',
  future: 'Futuras',
}

function ResultBadge({ progress }: { progress: GoalProgress }) {
  const { goal, phase } = progress
  return (
    <span className="flex flex-wrap items-center gap-1">
      {phase === 'future' ? (
        <Badge>Futura</Badge>
      ) : progress.reached ? (
        <Badge tone="success">Atingida</Badge>
      ) : phase === 'past' ? (
        <Badge tone="danger">Não atingida</Badge>
      ) : (
        <Badge tone="info">{Math.round(progress.ratio * 100)}%</Badge>
      )}
      {goal.active ? null : <Badge>Inativa</Badge>}
    </span>
  )
}

export function GoalsPage() {
  const progress = useApiQuery(() => api().goals.progress(), [])
  const [editing, setEditing] = useState<Goal | null | undefined>(undefined)
  const [filter, setFilter] = useState<Filter>('todas')
  const remove = useRemove((id) => api().goals.remove({ id }), 'meta', progress.reload)
  useShortcut('n', () => setEditing(null))

  const all = useMemo(() => progress.data ?? [], [progress.data])
  const current = all.filter((p) => p.phase === 'current' && p.goal.active)
  const rows = useMemo(() => (filter === 'todas' ? all : all.filter((p) => p.phase === filter)), [all, filter])
  const past = all.filter((p) => p.phase === 'past' && p.goal.active)
  const pastReached = past.filter((p) => p.reached).length

  const columns: Column<GoalProgress>[] = [
    {
      key: 'period',
      header: 'Período',
      sortValue: (p) => p.periodStart,
      render: (p) => goalPeriodLabel(p.goal.period, p.goal.referenceDate),
    },
    {
      key: 'description',
      header: 'Meta',
      sortValue: (p) => p.goal.description.toLowerCase(),
      render: (p) => <span className="font-medium">{p.goal.description}</span>,
    },
    { key: 'type', header: 'Tipo', render: (p) => `${TYPE_LABEL[p.goal.type]} · ${PERIOD_LABEL[p.goal.period]}` },
    { key: 'target', header: 'Objetivo', align: 'right', sortValue: (p) => p.goal.targetAmount, render: (p) => formatCurrency(p.goal.targetAmount) },
    {
      key: 'achieved',
      header: 'Alcançado',
      align: 'right',
      sortValue: (p) => p.achieved,
      render: (p) => (p.phase === 'future' ? '—' : formatCurrency(p.achieved)),
    },
    { key: 'result', header: 'Resultado', render: (p) => <ResultBadge progress={p} /> },
    {
      key: 'actions',
      header: 'Ações',
      align: 'right',
      render: (p) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label={`Editar ${p.goal.description}`} onClick={() => setEditing(p.goal)}>
            <Pencil size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Excluir ${p.goal.description}`}
            onClick={() => void remove(p.goal.id, `A meta "${p.goal.description}" será removida`)}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Metas"
        description="Cada meta vale para um dia, semana ou mês específico e é preenchida pelas corridas daquele período. Os períodos encerrados ficam no histórico."
        actions={
          <Button onClick={() => setEditing(null)}>
            <Plus size={16} /> Nova meta
          </Button>
        }
      />
      {progress.loading && !progress.data ? <LoadingBlock /> : null}
      {progress.error ? <ErrorBlock message={progress.error} onRetry={progress.reload} /> : null}
      {progress.data && all.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Nenhuma meta criada"
          description="Defina quanto quer faturar ou lucrar em um dia, semana ou mês."
          action={<Button onClick={() => setEditing(null)}>Criar meta</Button>}
        />
      ) : null}
      {progress.data && all.length > 0 ? (
        <>
          <h2 className="mb-2 text-sm font-semibold">Em andamento</h2>
          {current.length > 0 ? (
            <div className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {current.map((p) => (
                <GoalProgressCard key={p.goal.id} progress={p} />
              ))}
            </div>
          ) : (
            <p className="mb-6 text-sm text-muted">
              Nenhuma meta ativa para o período atual. Crie uma meta com a data de hoje (ou de uma semana ou mês que a contenha).
            </p>
          )}

          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Histórico e todas as metas</h2>
              {past.length > 0 ? (
                <p className="text-xs text-muted">
                  {pastReached} de {past.length} meta(s) ativa(s) de períodos encerrados foram atingidas.
                </p>
              ) : null}
            </div>
            <Select aria-label="Filtrar metas" className="w-60" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
              {(Object.keys(FILTER_LABEL) as Filter[]).map((key) => (
                <option key={key} value={key}>
                  {FILTER_LABEL[key]}
                </option>
              ))}
            </Select>
          </div>
          {rows.length > 0 ? (
            <DataTable
              caption="Metas"
              rows={rows}
              columns={columns}
              rowKey={(p) => p.goal.id}
              initialSort={{ key: 'period', direction: 'desc' }}
            />
          ) : (
            <p className="text-sm text-muted">Nenhuma meta neste filtro.</p>
          )}
        </>
      ) : null}
      <Modal open={editing !== undefined} title={editing ? 'Editar meta' : 'Nova meta'} onClose={() => setEditing(undefined)}>
        {editing !== undefined ? (
          <GoalForm
            goal={editing}
            onCancel={() => setEditing(undefined)}
            onDone={() => {
              setEditing(undefined)
              progress.reload()
            }}
          />
        ) : null}
      </Modal>
    </>
  )
}
