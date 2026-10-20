import { EXPENSE_CATEGORIES, type ExpenseCategory } from '@shared/domain'
import { formatCurrency } from '@shared/money'
import type { Expense } from '@shared/types'
import { Pencil, Plus, Receipt, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { ExportButton } from '@/components/ExportButton'
import { Button } from '@/components/ui/button'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge, Card, EmptyState, ErrorBlock, LoadingBlock, PageHeader } from '@/components/ui/display'
import { Select } from '@/components/ui/form-controls'
import { Modal } from '@/components/ui/modal'
import { ExpenseForm } from '@/features/expenses/ExpenseForm'
import { useApiQuery } from '@/hooks/useApiQuery'
import { useShifts, useVehicles } from '@/hooks/useLookups'
import { useRemove } from '@/hooks/useRemove'
import { useShortcut } from '@/hooks/useShortcut'
import { api } from '@/lib/api'
import { formatDateTime, rangeToIso, type DateRangeValue } from '@/lib/dates'

export function ExpensesPage() {
  const [range, setRange] = useState<DateRangeValue>({ from: '', to: '' })
  const [category, setCategory] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [editing, setEditing] = useState<Expense | null | undefined>(undefined)
  const vehicles = useVehicles()
  const shifts = useShifts()
  const iso = rangeToIso(range)
  const expenses = useApiQuery(
    () => api().expenses.list({ ...iso, category: (category || null) as ExpenseCategory | null, vehicleId: vehicleId ? Number(vehicleId) : null }),
    [range.from, range.to, category, vehicleId],
  )
  const remove = useRemove((id) => api().expenses.remove({ id }), 'despesa', expenses.reload)
  useShortcut('n', () => setEditing(null))

  const totals = useMemo(() => {
    const byCategory = new Map<string, number>()
    for (const e of expenses.data ?? []) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount)
    return [...byCategory.entries()].sort((a, b) => b[1] - a[1])
  }, [expenses.data])
  const grandTotal = totals.reduce((sum, [, value]) => sum + value, 0)

  const columns: Column<Expense>[] = [
    { key: 'date', header: 'Data', sortValue: (e) => e.expenseDate, render: (e) => formatDateTime(e.expenseDate) },
    { key: 'description', header: 'Descrição', sortValue: (e) => e.description.toLowerCase(), render: (e) => <span className="font-medium">{e.description}</span> },
    { key: 'category', header: 'Categoria', sortValue: (e) => e.category, render: (e) => e.category },
    { key: 'kind', header: 'Tipo', render: (e) => <Badge tone={e.kind === 'fixa' ? 'warning' : 'neutral'}>{e.kind === 'fixa' ? 'Fixa' : 'Operacional'}</Badge> },
    { key: 'vehicle', header: 'Veículo', render: (e) => e.vehicleName ?? '—' },
    { key: 'amount', header: 'Valor', align: 'right', sortValue: (e) => e.amount, render: (e) => <span className="font-medium">{formatCurrency(e.amount)}</span> },
    {
      key: 'actions',
      header: 'Ações',
      align: 'right',
      render: (e) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label={`Editar ${e.description}`} onClick={() => setEditing(e)}>
            <Pencil size={16} />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Excluir ${e.description}`} onClick={() => void remove(e.id, `A despesa "${e.description}" será removida`)}>
            <Trash2 size={16} />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Despesas"
        description="Custos da atividade. Abastecimentos ficam em sua própria tela, sem duplicar aqui."
        actions={
          <>
            <ExportButton input={{ entity: 'expenses', ...iso }} />
            <Button onClick={() => setEditing(null)}>
              <Plus size={16} /> Nova despesa
            </Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <DateRangeFilter value={range} onChange={setRange} />
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Categoria
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Todas</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Veículo
          <Select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">Todos</option>
            {vehicles.data?.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </label>
      </div>
      {expenses.loading && !expenses.data ? <LoadingBlock /> : null}
      {expenses.error ? <ErrorBlock message={expenses.error} onRetry={expenses.reload} /> : null}
      {expenses.data && expenses.data.length === 0 ? (
        <EmptyState icon={Receipt} title="Nenhuma despesa encontrada" action={<Button onClick={() => setEditing(null)}>Registrar despesa</Button>} />
      ) : null}
      {expenses.data && expenses.data.length > 0 ? (
        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="mb-2 text-sm font-semibold">Total por categoria</h2>
            <ul className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {totals.map(([name, value]) => (
                <li key={name} className="flex justify-between gap-2">
                  <span className="text-muted">{name}</span>
                  <span className="tabular-nums">{formatCurrency(value)}</span>
                </li>
              ))}
            </ul>
          </Card>
          <DataTable
            caption="Despesas"
            rows={expenses.data}
            columns={columns}
            rowKey={(e) => e.id}
            initialSort={{ key: 'date', direction: 'desc' }}
            footer={<strong className="text-fg">Total: {formatCurrency(grandTotal)}</strong>}
          />
        </div>
      ) : null}
      <Modal open={editing !== undefined} title={editing ? 'Editar despesa' : 'Nova despesa'} onClose={() => setEditing(undefined)}>
        {editing !== undefined ? (
          <ExpenseForm
            expense={editing}
            vehicles={vehicles.data ?? []}
            shifts={shifts.data ?? []}
            onCancel={() => setEditing(undefined)}
            onDone={() => {
              setEditing(undefined)
              expenses.reload()
            }}
          />
        ) : null}
      </Modal>
    </>
  )
}
