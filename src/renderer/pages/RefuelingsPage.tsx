import { formatCurrency, formatNumber } from '@shared/money'
import type { Refueling } from '@shared/types'
import { Fuel, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DateRangeFilter } from '@/components/DateRangeFilter'
import { ExportButton } from '@/components/ExportButton'
import { Badge, EmptyState, ErrorBlock, LoadingBlock, PageHeader } from '@/components/ui/display'
import { Button } from '@/components/ui/button'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Select } from '@/components/ui/form-controls'
import { Modal } from '@/components/ui/modal'
import { RefuelingForm } from '@/features/refuelings/RefuelingForm'
import { useApiQuery } from '@/hooks/useApiQuery'
import { useSettings, useShifts, useVehicles } from '@/hooks/useLookups'
import { useRemove } from '@/hooks/useRemove'
import { useShortcut } from '@/hooks/useShortcut'
import { api } from '@/lib/api'
import { formatDateTime, rangeToIso, type DateRangeValue } from '@/lib/dates'

/** Custo por km: entre o primeiro e o último odômetro, os litros gastos exceto os do primeiro abastecimento. */
function costPerKm(rows: Refueling[]): number | null {
  const byVehicle = new Map<number, Refueling[]>()
  for (const r of rows) byVehicle.set(r.vehicleId, [...(byVehicle.get(r.vehicleId) ?? []), r])
  let km = 0
  let cost = 0
  for (const list of byVehicle.values()) {
    const sorted = [...list].sort((a, b) => a.odometer - b.odometer)
    if (sorted.length < 2) continue
    const span = sorted[sorted.length - 1]!.odometer - sorted[0]!.odometer
    if (span <= 0) continue
    km += span
    cost += sorted.slice(1).reduce((sum, r) => sum + r.totalAmount, 0)
  }
  return km > 0 ? cost / km : null
}

export function RefuelingsPage() {
  const [range, setRange] = useState<DateRangeValue>({ from: '', to: '' })
  const [vehicleId, setVehicleId] = useState('')
  const [editing, setEditing] = useState<Refueling | null | undefined>(undefined)
  const vehicles = useVehicles()
  const shifts = useShifts()
  const settings = useSettings()
  const iso = rangeToIso(range)
  const refuelings = useApiQuery(() => api().refuelings.list({ ...iso, vehicleId: vehicleId ? Number(vehicleId) : null }), [range.from, range.to, vehicleId])
  const remove = useRemove((id) => api().refuelings.remove({ id }), 'abastecimento', refuelings.reload)
  useShortcut('n', () => setEditing(null))

  const total = useMemo(() => (refuelings.data ?? []).reduce((sum, r) => sum + r.totalAmount, 0), [refuelings.data])
  const perKm = useMemo(() => costPerKm(refuelings.data ?? []), [refuelings.data])

  const columns: Column<Refueling>[] = [
    { key: 'date', header: 'Data', sortValue: (r) => r.refueledAt, render: (r) => formatDateTime(r.refueledAt) },
    { key: 'vehicle', header: 'Veículo', sortValue: (r) => r.vehicleName, render: (r) => r.vehicleName },
    { key: 'fuel', header: 'Combustível', render: (r) => r.fuel },
    { key: 'liters', header: 'Litros', align: 'right', sortValue: (r) => r.liters, render: (r) => formatNumber(r.liters, 2) },
    { key: 'price', header: 'Preço/L', align: 'right', render: (r) => formatCurrency(r.pricePerLiter) },
    { key: 'total', header: 'Total', align: 'right', sortValue: (r) => r.totalAmount, render: (r) => <span className="font-medium">{formatCurrency(r.totalAmount)}</span> },
    { key: 'odometer', header: 'Odômetro', align: 'right', sortValue: (r) => r.odometer, render: (r) => `${formatNumber(r.odometer, 0)} km` },
    { key: 'full', header: 'Tanque', render: (r) => (r.fullTank ? <Badge tone="info">Completo</Badge> : <Badge>Parcial</Badge>) },
    {
      key: 'actions',
      header: 'Ações',
      align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label="Editar abastecimento" onClick={() => setEditing(r)}>
            <Pencil size={16} />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Excluir abastecimento" onClick={() => void remove(r.id, `O abastecimento de ${formatCurrency(r.totalAmount)} será removido`)}>
            <Trash2 size={16} />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Abastecimentos"
        description="Registre cada abastecimento; o consumo médio só é calculado entre tanques completos."
        actions={
          <>
            <ExportButton input={{ entity: 'refuelings', ...iso }} />
            <Button onClick={() => setEditing(null)}>
              <Plus size={16} /> Novo abastecimento
            </Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <DateRangeFilter value={range} onChange={setRange} />
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
      {refuelings.loading && !refuelings.data ? <LoadingBlock /> : null}
      {refuelings.error ? <ErrorBlock message={refuelings.error} onRetry={refuelings.reload} /> : null}
      {refuelings.data && refuelings.data.length === 0 ? (
        <EmptyState icon={Fuel} title="Nenhum abastecimento encontrado" action={<Button onClick={() => setEditing(null)}>Registrar abastecimento</Button>} />
      ) : null}
      {refuelings.data && refuelings.data.length > 0 ? (
        <DataTable
          caption="Abastecimentos"
          rows={refuelings.data}
          columns={columns}
          rowKey={(r) => r.id}
          initialSort={{ key: 'date', direction: 'desc' }}
          footer={
            <span>
              <strong className="text-fg">Total: {formatCurrency(total)}</strong> · Custo de combustível por km:{' '}
              {perKm === null ? 'dados insuficientes' : formatCurrency(Math.round(perKm))}
            </span>
          }
        />
      ) : null}
      <Modal open={editing !== undefined} title={editing ? 'Editar abastecimento' : 'Novo abastecimento'} onClose={() => setEditing(undefined)}>
        {editing !== undefined ? (
          <RefuelingForm
            refueling={editing}
            vehicles={vehicles.data ?? []}
            shifts={shifts.data ?? []}
            settings={settings.data}
            onCancel={() => setEditing(undefined)}
            onDone={() => {
              setEditing(undefined)
              refuelings.reload()
              vehicles.reload()
            }}
          />
        ) : null}
      </Modal>
    </>
  )
}
