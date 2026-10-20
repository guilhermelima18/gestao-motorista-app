import { formatCurrency, formatNumber } from '@shared/money'
import type { Trip } from '@shared/types'
import { Pencil, Plus, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { ExportButton } from '@/components/ExportButton'
import { Button } from '@/components/ui/button'
import { DataTable, type Column } from '@/components/ui/data-table'
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader } from '@/components/ui/display'
import { Select } from '@/components/ui/form-controls'
import { Modal } from '@/components/ui/modal'
import { TripForm } from '@/features/trips/TripForm'
import { useApiQuery } from '@/hooks/useApiQuery'
import { usePlatforms, useShifts } from '@/hooks/useLookups'
import { useRemove } from '@/hooks/useRemove'
import { useShortcut } from '@/hooks/useShortcut'
import { api } from '@/lib/api'
import { formatDateTime, rangeToIso, type DateRangeValue } from '@/lib/dates'

export function TripsPage() {
  const [range, setRange] = useState<DateRangeValue>({ from: '', to: '' })
  const [platformId, setPlatformId] = useState('')
  const [shiftId, setShiftId] = useState('')
  const [editing, setEditing] = useState<Trip | null | undefined>(undefined)
  const platforms = usePlatforms()
  const shifts = useShifts()

  const iso = rangeToIso(range)
  const trips = useApiQuery(
    () => api().trips.list({ ...iso, platformId: platformId ? Number(platformId) : null, shiftId: shiftId ? Number(shiftId) : null }),
    [range.from, range.to, platformId, shiftId],
  )
  const refreshAll = () => {
    trips.reload()
    shifts.reload()
  }
  const remove = useRemove((id) => api().trips.remove({ id }), 'viagem', refreshAll)
  useShortcut('n', () => setEditing(null))

  const columns: Column<Trip>[] = [
    { key: 'date', header: 'Data', sortValue: (t) => t.occurredAt, render: (t) => formatDateTime(t.occurredAt) },
    { key: 'platform', header: 'Plataforma', sortValue: (t) => t.platformName, render: (t) => t.platformName },
    {
      key: 'route',
      header: 'Trajeto',
      render: (t) => (t.origin || t.destination ? `${t.origin ?? '?'} → ${t.destination ?? '?'}` : '—'),
    },
    { key: 'distance', header: 'Distância', align: 'right', sortValue: (t) => t.distanceKm, render: (t) => `${formatNumber(t.distanceKm)} km` },
    { key: 'duration', header: 'Duração', align: 'right', sortValue: (t) => t.durationMinutes, render: (t) => (t.durationMinutes ? `${t.durationMinutes} min` : '—') },
    { key: 'amount', header: 'Receita', align: 'right', sortValue: (t) => t.totalRevenue, render: (t) => <span className="font-medium">{formatCurrency(t.totalRevenue)}</span> },
    {
      key: 'actions',
      header: 'Ações',
      align: 'right',
      render: (t) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label="Editar viagem" onClick={() => setEditing(t)}>
            <Pencil size={16} />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Excluir viagem" onClick={() => void remove(t.id, `A viagem de ${formatCurrency(t.totalRevenue)} será removida`)}>
            <Trash2 size={16} />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Viagens"
        description="Corridas registradas individualmente."
        actions={
          <>
            <ExportButton input={{ entity: 'trips', ...iso }} />
            <Button onClick={() => setEditing(null)}>
              <Plus size={16} /> Nova viagem
            </Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <DateRangeFilter value={range} onChange={setRange} />
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Plataforma
          <Select value={platformId} onChange={(e) => setPlatformId(e.target.value)}>
            <option value="">Todas</option>
            {platforms.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Jornada
          <Select value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
            <option value="">Todas</option>
            {shifts.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {formatDateTime(s.startedAt)} · {s.vehicleName}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {trips.loading && !trips.data ? <LoadingBlock /> : null}
      {trips.error ? <ErrorBlock message={trips.error} onRetry={trips.reload} /> : null}
      {trips.data && trips.data.items.length === 0 ? (
        <EmptyState icon={Users} title="Nenhuma viagem encontrada" description="Registre uma corrida ou ajuste os filtros." action={<Button onClick={() => setEditing(null)}>Registrar viagem</Button>} />
      ) : null}
      {trips.data && trips.data.items.length > 0 ? (
        <DataTable
          caption="Viagens"
          rows={trips.data.items}
          columns={columns}
          rowKey={(t) => t.id}
          initialSort={{ key: 'date', direction: 'desc' }}
          footer={
            <strong className="text-fg">
              Total recebido: {formatCurrency(trips.data.totals.totalRevenue)} em {trips.data.totals.tripCount} viagem(ns)
            </strong>
          }
        />
      ) : null}

      <Modal open={editing !== undefined} title={editing ? 'Editar viagem' : 'Nova viagem'} onClose={() => setEditing(undefined)}>
        {editing !== undefined ? (
          <TripForm
            trip={editing}
            shifts={shifts.data ?? []}
            platforms={platforms.data ?? []}
            onCancel={() => setEditing(undefined)}
            onDone={() => {
              setEditing(undefined)
              refreshAll()
            }}
          />
        ) : null}
      </Modal>
    </>
  )
}
