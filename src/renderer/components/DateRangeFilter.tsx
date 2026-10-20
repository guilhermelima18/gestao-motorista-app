import type { DateRangeValue } from '@/lib/dates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form-controls'

interface DateRangeFilterProps {
  value: DateRangeValue
  onChange: (value: DateRangeValue) => void
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        De
        <Input type="date" value={value.from} max={value.to || undefined} onChange={(e) => onChange({ ...value, from: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        Até
        <Input type="date" value={value.to} min={value.from || undefined} onChange={(e) => onChange({ ...value, to: e.target.value })} />
      </label>
      {value.from || value.to ? (
        <Button variant="ghost" size="sm" onClick={() => onChange({ from: '', to: '' })}>
          Limpar datas
        </Button>
      ) : null}
    </div>
  )
}
