import { addDays, format, parseISO, startOfDay } from 'date-fns'

export function formatDateTime(iso: string): string {
  return format(parseISO(iso), 'dd/MM/yyyy HH:mm')
}

export function formatDate(iso: string): string {
  return format(parseISO(iso), 'dd/MM/yyyy')
}

/** Valor para <input type="datetime-local"> a partir de um ISO. */
export function toLocalInput(iso: string): string {
  return format(parseISO(iso), "yyyy-MM-dd'T'HH:mm")
}

export function nowLocalInput(): string {
  return format(new Date(), "yyyy-MM-dd'T'HH:mm")
}

/** Converte o valor de <input type="datetime-local"> em ISO (UTC); undefined quando vazio. */
export function localInputToIso(value: string): string | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

export interface DateRangeValue {
  /** yyyy-MM-dd */
  from: string
  /** yyyy-MM-dd (inclusivo) */
  to: string
}

/** Intervalo [from, to+1 dia) em ISO, como a API espera (fim exclusivo). */
export function rangeToIso(range: DateRangeValue): { from?: string; to?: string } {
  const result: { from?: string; to?: string } = {}
  if (range.from) result.from = startOfDay(new Date(`${range.from}T00:00:00`)).toISOString()
  if (range.to) result.to = addDays(startOfDay(new Date(`${range.to}T00:00:00`)), 1).toISOString()
  return result
}

/** Aviso (não bloqueante) quando a data/hora digitada é posterior a agora; undefined caso contrário. */
export function futureDateWarning(value: string | undefined): string | undefined {
  const iso = value ? localInputToIso(value) : undefined
  if (!iso || new Date(iso).getTime() <= Date.now() + 60_000) return undefined
  return `Data futura (${formatDateTime(iso)}). Os totais de hoje só incluem esse registro a partir dessa data.`
}

export function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60)
  return `${Math.floor(totalMinutes / 60)}h ${String(totalMinutes % 60).padStart(2, '0')}min`
}
