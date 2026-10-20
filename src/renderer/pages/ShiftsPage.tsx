import { formatCurrency, formatNumber } from '@shared/money'
import type { Shift } from '@shared/types'
import { Eye, Flag, Play, Route, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge, Card, EmptyState, ErrorBlock, LoadingBlock, PageHeader } from '@/components/ui/display'
import { Modal } from '@/components/ui/modal'
import { EndShiftForm, StartShiftForm } from '@/features/shifts/ShiftForms'
import { ShiftDetails } from '@/features/shifts/ShiftDetails'
import { useApiQuery } from '@/hooks/useApiQuery'
import { useSettings, useVehicles } from '@/hooks/useLookups'
import { useRemove } from '@/hooks/useRemove'
import { useShortcut } from '@/hooks/useShortcut'
import { api } from '@/lib/api'
import { formatDateTime, formatHours } from '@/lib/dates'

type Dialog = { kind: 'start' } | { kind: 'end'; shift: Shift } | { kind: 'details'; shift: Shift } | null

function durationHours(shift: Shift): number | null {
  if (!shift.endedAt) return null
  return (new Date(shift.endedAt).getTime() - new Date(shift.startedAt).getTime()) / 3_600_000
}

export function ShiftsPage() {
  const shifts = useApiQuery(() => api().shifts.list(), [])
  const vehicles = useVehicles()
  const settings = useSettings()
  const [dialog, setDialog] = useState<Dialog>(null)
  const remove = useRemove((id) => api().shifts.remove({ id }), 'jornada', shifts.reload)

  const openShift = shifts.data?.find((s) => !s.endedAt) ?? null
  const startOrEnd = () => setDialog(openShift ? { kind: 'end', shift: openShift } : { kind: 'start' })
  useShortcut('n', startOrEnd)

  const close = () => setDialog(null)
  const done = () => {
    close()
    shifts.reload()
    vehicles.reload()
  }

  const columns: Column<Shift>[] = [
    {
      key: 'start',
      header: 'Início',
      sortValue: (s) => s.startedAt,
      render: (s) => (
        <div>
          <div className="font-medium">{formatDateTime(s.startedAt)}</div>
          <div className="text-xs text-muted">{s.vehicleName}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Situação',
      render: (s) => (s.endedAt ? <Badge>Encerrada</Badge> : <Badge tone="success">Em andamento</Badge>),
    },
    { key: 'duration', header: 'Duração', align: 'right', sortValue: (s) => durationHours(s) ?? 0, render: (s) => (s.endedAt ? formatHours(durationHours(s) ?? 0) : '—') },
    { key: 'distance', header: 'Distância', align: 'right', sortValue: (s) => s.distanceKm ?? 0, render: (s) => (s.distanceKm === null ? '—' : `${formatNumber(s.distanceKm)} km`) },
    { key: 'trips', header: 'Viagens', align: 'right', sortValue: (s) => s.tripCount, render: (s) => s.tripCount },
    { key: 'revenue', header: 'Faturamento', align: 'right', sortValue: (s) => s.revenue, render: (s) => formatCurrency(s.revenue) },
    {
      key: 'actions',
      header: 'Ações',
      align: 'right',
      render: (s) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label="Ver detalhes da jornada" onClick={() => setDialog({ kind: 'details', shift: s })}>
            <Eye size={16} />
          </Button>
          {!s.endedAt ? (
            <Button variant="ghost" size="icon" aria-label="Encerrar jornada" onClick={() => setDialog({ kind: 'end', shift: s })}>
              <Flag size={16} />
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" aria-label="Excluir jornada" onClick={() => void remove(s.id, 'Jornadas com registros vinculados não podem ser excluídas')}>
            <Trash2 size={16} />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Jornadas"
        description="Cada período de trabalho, com quilometragem, corridas e resultado."
        actions={
          openShift ? (
            <Button variant="danger" onClick={startOrEnd}>
              <Flag size={16} /> Encerrar jornada
            </Button>
          ) : (
            <Button onClick={startOrEnd}>
              <Play size={16} /> Iniciar jornada
            </Button>
          )
        }
      />
      {openShift ? (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-2 border-success/50 bg-success/10">
          <div>
            <div className="font-medium text-success">Jornada em andamento</div>
            <div className="text-sm text-muted">
              Desde {formatDateTime(openShift.startedAt)} · {openShift.vehicleName} · {formatCurrency(openShift.revenue)} em {openShift.tripCount} viagem(ns)
            </div>
          </div>
          <Button variant="outline" onClick={() => setDialog({ kind: 'details', shift: openShift })}>
            Ver detalhes
          </Button>
        </Card>
      ) : null}
      {shifts.loading && !shifts.data ? <LoadingBlock /> : null}
      {shifts.error ? <ErrorBlock message={shifts.error} onRetry={shifts.reload} /> : null}
      {shifts.data && shifts.data.length === 0 ? (
        <EmptyState icon={Route} title="Nenhuma jornada registrada" description="Inicie uma jornada para registrar corridas, abastecimentos e despesas." action={<Button onClick={startOrEnd}>Iniciar primeira jornada</Button>} />
      ) : null}
      {shifts.data && shifts.data.length > 0 ? (
        <DataTable caption="Jornadas" rows={shifts.data} columns={columns} rowKey={(s) => s.id} initialSort={{ key: 'start', direction: 'desc' }} />
      ) : null}

      <Modal open={dialog?.kind === 'start'} title="Iniciar jornada" onClose={close}>
        {dialog?.kind === 'start' ? <StartShiftForm vehicles={vehicles.data ?? []} settings={settings.data} onDone={done} onCancel={close} /> : null}
      </Modal>
      <Modal open={dialog?.kind === 'end'} title="Encerrar jornada" onClose={close}>
        {dialog?.kind === 'end' ? <EndShiftForm shift={dialog.shift} onDone={done} onCancel={close} /> : null}
      </Modal>
      <Modal open={dialog?.kind === 'details'} title="Detalhes da jornada" onClose={close}>
        {dialog?.kind === 'details' ? <ShiftDetails shift={dialog.shift} /> : null}
      </Modal>
    </>
  )
}
