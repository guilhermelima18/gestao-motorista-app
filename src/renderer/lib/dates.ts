import { addDays, endOfWeek, format, parseISO, startOfDay, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'

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

/** Hoje como yyyy-MM-dd (horário local), para campos <input type="date">. */
export function todayLocalDate(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

/**
 * Rótulo do período de uma meta a partir da periodicidade e da data de referência:
 * "22/10/2026 (quinta-feira)", "19/10 a 25/10/2026" ou "Outubro de 2026".
 */
export function goalPeriodLabel(period: 'diaria' | 'semanal' | 'mensal', referenceDate: string): string {
  const date = parseISO(referenceDate)
  if (period === 'diaria') return format(date, "dd/MM/yyyy (EEEE)", { locale: ptBR })
  if (period === 'semanal') {
    const start = startOfWeek(date, { weekStartsOn: 1 })
    return `${format(start, 'dd/MM')} a ${format(endOfWeek(date, { weekStartsOn: 1 }), 'dd/MM/yyyy')}`
  }
  const label = format(date, "MMMM 'de' yyyy", { locale: ptBR })
  return label.charAt(0).toUpperCase() + label.slice(1)
}
