import type { Platform } from '@shared/types'
import { Pencil, Plus, Trash2, Waypoints } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge, EmptyState, ErrorBlock, LoadingBlock, PageHeader } from '@/components/ui/display'
import { Modal } from '@/components/ui/modal'
import { PlatformForm } from '@/features/platforms/PlatformForm'
import { useApiQuery } from '@/hooks/useApiQuery'
import { useRemove } from '@/hooks/useRemove'
import { useShortcut } from '@/hooks/useShortcut'
import { api } from '@/lib/api'

export function PlatformsPage() {
  const platforms = useApiQuery(() => api().platforms.list(), [])
  const [editing, setEditing] = useState<Platform | null | undefined>(undefined)
  const remove = useRemove((id) => api().platforms.remove({ id }), 'plataforma', platforms.reload)
  useShortcut('n', () => setEditing(null))

  const columns: Column<Platform>[] = [
    { key: 'name', header: 'Plataforma', sortValue: (p) => p.name.toLowerCase(), render: (p) => <span className="font-medium">{p.name}</span> },
    { key: 'status', header: 'Situação', render: (p) => <Badge tone={p.active ? 'success' : 'neutral'}>{p.active ? 'Ativa' : 'Inativa'}</Badge> },
    {
      key: 'actions',
      header: 'Ações',
      align: 'right',
      render: (p) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label={`Editar ${p.name}`} onClick={() => setEditing(p)}>
            <Pencil size={16} />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Excluir ${p.name}`} onClick={() => void remove(p.id, `A plataforma "${p.name}" será removida`)}>
            <Trash2 size={16} />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Plataformas"
        description="Desative uma plataforma para deixar de usá-la sem perder o histórico."
        actions={
          <Button onClick={() => setEditing(null)}>
            <Plus size={16} /> Nova plataforma
          </Button>
        }
      />
      {platforms.loading && !platforms.data ? <LoadingBlock /> : null}
      {platforms.error ? <ErrorBlock message={platforms.error} onRetry={platforms.reload} /> : null}
      {platforms.data && platforms.data.length === 0 ? <EmptyState icon={Waypoints} title="Nenhuma plataforma" /> : null}
      {platforms.data && platforms.data.length > 0 ? <DataTable caption="Plataformas" rows={platforms.data} columns={columns} rowKey={(p) => p.id} /> : null}
      <Modal open={editing !== undefined} title={editing ? 'Editar plataforma' : 'Nova plataforma'} onClose={() => setEditing(undefined)}>
        {editing !== undefined ? (
          <PlatformForm
            platform={editing}
            onCancel={() => setEditing(undefined)}
            onDone={() => {
              setEditing(undefined)
              platforms.reload()
            }}
          />
        ) : null}
      </Modal>
    </>
  )
}
