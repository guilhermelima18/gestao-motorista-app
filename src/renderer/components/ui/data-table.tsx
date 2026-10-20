import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from './button'

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  /** Quando informado, a coluna é ordenável por este valor. */
  sortValue?: (row: T) => string | number
  align?: 'left' | 'right'
}

interface DataTableProps<T> {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string | number
  pageSize?: number
  caption: string
  /** Ordenação inicial (chave da coluna e direção). */
  initialSort?: { key: string; direction: 'asc' | 'desc' }
  footer?: ReactNode
}

/** Tabela com ordenação por coluna e paginação no cliente. */
export function DataTable<T>({ rows, columns, rowKey, pageSize = 15, caption, initialSort, footer }: DataTableProps<T>) {
  const [sort, setSort] = useState(initialSort ?? null)
  const [page, setPage] = useState(0)

  const sorted = useMemo(() => {
    const column = columns.find((c) => c.key === sort?.key)
    if (!column?.sortValue || !sort) return rows
    const value = column.sortValue
    const factor = sort.direction === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const va = value(a)
      const vb = value(b)
      return (va < vb ? -1 : va > vb ? 1 : 0) * factor
    })
  }, [rows, columns, sort])

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const current = Math.min(page, pages - 1)
  const visible = sorted.slice(current * pageSize, current * pageSize + pageSize)

  const toggleSort = (key: string) => {
    setSort((prev) => (prev?.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' }))
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-surface-2 text-left text-xs text-muted">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn('px-3 py-2 font-medium whitespace-nowrap', c.align === 'right' && 'text-right')}
                  aria-sort={sort?.key === c.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {c.sortValue ? (
                    <button className="inline-flex items-center gap-1 hover:text-fg" onClick={() => toggleSort(c.key)}>
                      {c.header}
                      {sort?.key === c.key ? sort.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : null}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={rowKey(row)} className="border-t border-border hover:bg-surface-2/60">
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-3 py-2 align-middle', c.align === 'right' && 'text-right tabular-nums')}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted">
        <div>{footer}</div>
        <div className="flex items-center gap-2">
          <span>
            {sorted.length} registro(s) · página {current + 1} de {pages}
          </span>
          <Button variant="ghost" size="icon" aria-label="Página anterior" disabled={current === 0} onClick={() => setPage(current - 1)}>
            <ChevronLeft size={16} />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Próxima página" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  )
}
