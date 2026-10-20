import { formatCurrency, formatNumber } from '@shared/money'
import type { Shift } from '@shared/types'
import { ErrorBlock, LoadingBlock } from '@/components/ui/display'
import { useApiQuery } from '@/hooks/useApiQuery'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/dates'

/** Resumo financeiro da jornada com as corridas, abastecimentos e despesas vinculados. */
export function ShiftDetails({ shift }: { shift: Shift }) {
  const trips = useApiQuery(() => api().trips.list({ shiftId: shift.id }), [shift.id])
  const range = { from: new Date(shift.startedAt).toISOString(), to: new Date((shift.endedAt ? new Date(shift.endedAt).getTime() : Date.now()) + 60_000).toISOString() }
  const refuelings = useApiQuery(() => api().refuelings.list({ ...range, vehicleId: shift.vehicleId }), [shift.id])
  const expenses = useApiQuery(() => api().expenses.list({ vehicleId: shift.vehicleId }), [shift.id])

  if (trips.loading || refuelings.loading || expenses.loading) return <LoadingBlock />
  if (trips.error || refuelings.error || expenses.error) return <ErrorBlock message={trips.error ?? refuelings.error ?? expenses.error ?? ''} />

  const linkedRefuelings = (refuelings.data ?? []).filter((r) => r.shiftId === shift.id)
  const linkedExpenses = (expenses.data ?? []).filter((d) => d.shiftId === shift.id)
  const refuelingTotal = linkedRefuelings.reduce((sum, r) => sum + r.totalAmount, 0)
  const expenseTotal = linkedExpenses.reduce((sum, d) => sum + d.amount, 0)
  const revenue = trips.data?.totals.totalRevenue ?? 0

  return (
    <div className="flex flex-col gap-4 text-sm">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Info label="Início" value={formatDateTime(shift.startedAt)} />
        <Info label="Término" value={shift.endedAt ? formatDateTime(shift.endedAt) : 'Em andamento'} />
        <Info label="Veículo" value={shift.vehicleName} />
        <Info label="Distância" value={shift.distanceKm === null ? '—' : `${formatNumber(shift.distanceKm)} km`} />
        <Info label="Faturamento" value={formatCurrency(revenue)} />
        <Info label="Abastecimentos" value={formatCurrency(refuelingTotal)} />
        <Info label="Despesas" value={formatCurrency(expenseTotal)} />
        <Info label="Resultado (caixa)" value={formatCurrency(revenue - refuelingTotal - expenseTotal)} />
      </dl>
      {shift.notes ? <p className="text-muted">{shift.notes}</p> : null}

      <Section title={`Corridas (${trips.data?.items.length ?? 0})`}>
        {(trips.data?.items ?? []).map((t) => (
          <Row key={t.id} left={`${formatDateTime(t.occurredAt)} · ${t.platformName}`} right={formatCurrency(t.totalRevenue)} />
        ))}
      </Section>
      <Section title={`Abastecimentos (${linkedRefuelings.length})`}>
        {linkedRefuelings.map((r) => (
          <Row key={r.id} left={`${formatDateTime(r.refueledAt)} · ${formatNumber(r.liters, 2)} L ${r.fuel}`} right={formatCurrency(r.totalAmount)} />
        ))}
      </Section>
      <Section title={`Despesas (${linkedExpenses.length})`}>
        {linkedExpenses.map((d) => (
          <Row key={d.id} left={`${formatDateTime(d.expenseDate)} · ${d.description}`} right={formatCurrency(d.amount)} />
        ))}
      </Section>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const empty = Array.isArray(children) && children.length === 0
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">{title}</h3>
      {empty ? <p className="text-muted">Nenhum registro vinculado.</p> : <ul className="divide-y divide-border rounded-md border border-border">{children}</ul>}
    </section>
  )
}

function Row({ left, right }: { left: string; right: string }) {
  return (
    <li className="flex justify-between gap-3 px-3 py-1.5">
      <span>{left}</span>
      <span className="tabular-nums">{right}</span>
    </li>
  )
}
