import { formatCurrency } from '@shared/money'
import type { Goal } from '@shared/types'
import { Pencil, Plus, Target, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { GoalProgressCard } from '@/components/GoalProgressCard'
import { Button } from '@/components/ui/button'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge, EmptyState, ErrorBlock, LoadingBlock, PageHeader } from '@/components/ui/display'
import { Modal } from '@/components/ui/modal'
import { GoalForm } from '@/features/goals/GoalForm'
import { useApiQuery } from '@/hooks/useApiQuery'
import { useRemove } from '@/hooks/useRemove'
import { useShortcut } from '@/hooks/useShortcut'
import { api } from '@/lib/api'

const PERIOD_LABEL = { diaria: 'Diária', semanal: 'Semanal', mensal: 'Mensal' } as const
const TYPE_LABEL = { faturamento: 'Faturamento', lucro: 'Lucro' } as const

export function GoalsPage() {
  const goals = useApiQuery(() => api().goals.list(), [])
  const progress = useApiQuery(() => api().goals.progress(), [])
  const [editing, setEditing] = useState<Goal | null | undefined>(undefined)
  const reloadAll = () => {
    goals.reload()
    progress.reload()
  }
  const remove = useRemove((id) => api().goals.remove({ id }), 'meta', reloadAll)
  useShortcut('n', () => setEditing(null))

  const columns: Column<Goal>[] = [
    { key: 'description', header: 'Meta', sortValue: (g) => g.description.toLowerCase(), render: (g) => <span className="font-medium">{g.description}</span> },
    { key: 'type', header: 'Tipo', render: (g) => TYPE_LABEL[g.type] },
    { key: 'period', header: 'Periodicidade', render: (g) => PERIOD_LABEL[g.period] },
    { key: 'target', header: 'Objetivo', align: 'right', sortValue: (g) => g.targetAmount, render: (g) => formatCurrency(g.targetAmount) },
    { key: 'status', header: 'Situação', render: (g) => <Badge tone={g.active ? 'success' : 'neutral'}>{g.active ? 'Ativa' : 'Inativa'}</Badge> },
    {
      key: 'actions',
      header: 'Ações',
      align: 'right',
      render: (g) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label={`Editar ${g.description}`} onClick={() => setEditing(g)}>
            <Pencil size={16} />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Excluir ${g.description}`} onClick={() => void remove(g.id, `A meta "${g.description}" será removida`)}>
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
        description="Acompanhe o progresso no dia, na semana ou no mês corrente."
        actions={
          <Button onClick={() => setEditing(null)}>
            <Plus size={16} /> Nova meta
          </Button>
        }
      />
      {goals.loading && !goals.data ? <LoadingBlock /> : null}
      {goals.error ? <ErrorBlock message={goals.error} onRetry={goals.reload} /> : null}
      {goals.data && goals.data.length === 0 ? (
        <EmptyState icon={Target} title="Nenhuma meta criada" description="Defina quanto quer faturar ou lucrar por dia, semana ou mês." action={<Button onClick={() => setEditing(null)}>Criar meta</Button>} />
      ) : null}
      {progress.data && progress.data.length > 0 ? (
        <div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {progress.data.map((p) => (
            <GoalProgressCard key={p.goal.id} progress={p} />
          ))}
        </div>
      ) : null}
      {goals.data && goals.data.length > 0 ? <DataTable caption="Metas" rows={goals.data} columns={columns} rowKey={(g) => g.id} /> : null}
      <Modal open={editing !== undefined} title={editing ? 'Editar meta' : 'Nova meta'} onClose={() => setEditing(undefined)}>
        {editing !== undefined ? (
          <GoalForm
            goal={editing}
            onCancel={() => setEditing(undefined)}
            onDone={() => {
              setEditing(undefined)
              reloadAll()
            }}
          />
        ) : null}
      </Modal>
    </>
  )
}
