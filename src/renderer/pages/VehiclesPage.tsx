import type { Vehicle } from '@shared/types'
import { Car, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge, EmptyState, ErrorBlock, LoadingBlock, PageHeader } from '@/components/ui/display'
import { useToast } from '@/components/ui/feedback'
import { Modal } from '@/components/ui/modal'
import { VehicleForm } from '@/features/vehicles/VehicleForm'
import { useApiQuery } from '@/hooks/useApiQuery'
import { useRemove } from '@/hooks/useRemove'
import { useSettings } from '@/hooks/useLookups'
import { useShortcut } from '@/hooks/useShortcut'
import { api, errorMessage, unwrap } from '@/lib/api'
import { formatNumber } from '@shared/money'

export function VehiclesPage() {
  const vehicles = useApiQuery(() => api().vehicles.list(), [])
  const settings = useSettings()
  const toast = useToast()
  const [editing, setEditing] = useState<Vehicle | null | undefined>(undefined)
  const reloadAll = () => {
    vehicles.reload()
    settings.reload()
  }
  const remove = useRemove((id) => api().vehicles.remove({ id }), 'veículo', reloadAll)
  useShortcut('n', () => setEditing(null))

  const setDefault = async (vehicle: Vehicle) => {
    try {
      await unwrap(api().settings.save({ key: 'veiculo_padrao_id', value: String(vehicle.id) }))
      toast.success(`${vehicle.name} definido como veículo padrão.`)
      settings.reload()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const defaultId = settings.data?.defaultVehicleId ?? null
  const columns: Column<Vehicle>[] = [
    {
      key: 'name',
      header: 'Veículo',
      sortValue: (v) => v.name.toLowerCase(),
      render: (v) => (
        <div>
          <div className="font-medium">
            {v.name} {v.id === defaultId ? <Badge tone="info">Padrão</Badge> : null}
          </div>
          <div className="text-xs text-muted">{[v.brand, v.model, v.year].filter(Boolean).join(' · ') || '—'}</div>
        </div>
      ),
    },
    { key: 'plate', header: 'Placa', render: (v) => v.plate ?? '—' },
    { key: 'fuel', header: 'Combustível', render: (v) => v.mainFuel ?? '—' },
    {
      key: 'odometer',
      header: 'Quilometragem',
      align: 'right',
      sortValue: (v) => v.currentOdometer ?? 0,
      render: (v) => (v.currentOdometer === null ? '—' : `${formatNumber(v.currentOdometer)} km`),
    },
    { key: 'status', header: 'Situação', render: (v) => <Badge tone={v.active ? 'success' : 'neutral'}>{v.active ? 'Ativo' : 'Inativo'}</Badge> },
    {
      key: 'actions',
      header: 'Ações',
      align: 'right',
      render: (v) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label={`Definir ${v.name} como padrão`} title="Definir como padrão" disabled={!v.active || v.id === defaultId} onClick={() => void setDefault(v)}>
            <Star size={16} />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Editar ${v.name}`} onClick={() => setEditing(v)}>
            <Pencil size={16} />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Excluir ${v.name}`} onClick={() => void remove(v.id, `O veículo "${v.name}" será removido`)}>
            <Trash2 size={16} />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Veículos"
        description="Cadastre os veículos usados nas jornadas. Veículos com registros só podem ser desativados."
        actions={
          <Button onClick={() => setEditing(null)}>
            <Plus size={16} /> Novo veículo
          </Button>
        }
      />
      {vehicles.loading && !vehicles.data ? <LoadingBlock /> : null}
      {vehicles.error ? <ErrorBlock message={vehicles.error} onRetry={vehicles.reload} /> : null}
      {vehicles.data && vehicles.data.length === 0 ? (
        <EmptyState icon={Car} title="Nenhum veículo cadastrado" description="Cadastre seu veículo para iniciar a primeira jornada." action={<Button onClick={() => setEditing(null)}>Cadastrar veículo</Button>} />
      ) : null}
      {vehicles.data && vehicles.data.length > 0 ? <DataTable caption="Veículos" rows={vehicles.data} columns={columns} rowKey={(v) => v.id} /> : null}
      <Modal open={editing !== undefined} title={editing ? 'Editar veículo' : 'Novo veículo'} onClose={() => setEditing(undefined)}>
        {editing !== undefined ? (
          <VehicleForm
            vehicle={editing}
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
