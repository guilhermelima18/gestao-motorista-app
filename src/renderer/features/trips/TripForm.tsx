import { tripSchema } from '@shared/schemas'
import { centsToText } from '@shared/money'
import type { Platform, Shift, Trip } from '@shared/types'
import { useForm, useWatch } from 'react-hook-form'
import { FormActions } from '@/components/FormActions'
import { Field, Input, Select, Textarea } from '@/components/ui/form-controls'
import { useFormSubmit } from '@/hooks/useFormSubmit'
import { api, unwrap } from '@/lib/api'
import { futureDateWarning, localInputToIso, nowLocalInput, toLocalInput } from '@/lib/dates'
import { idField, distanceToText, maskDistance, maskMoney, moneyField, numberField, schemaResolver, withMask } from '@/lib/form'

interface TripFormValues {
  shiftId: string
  platformId: string
  occurredAt: string
  fareAmount: string
  tip: string
  extras: string
  distanceKm: string
  durationMinutes: string
  deadheadKm: string
  origin: string
  destination: string
  notes: string
}

const toInput = (v: TripFormValues) => ({
  shiftId: idField(v.shiftId),
  platformId: idField(v.platformId),
  occurredAt: localInputToIso(v.occurredAt),
  fareAmount: moneyField(v.fareAmount),
  tip: moneyField(v.tip) ?? 0,
  extras: moneyField(v.extras) ?? 0,
  distanceKm: numberField(v.distanceKm) ?? 0,
  durationMinutes: numberField(v.durationMinutes) ?? 0,
  deadheadKm: numberField(v.deadheadKm) ?? 0,
  origin: v.origin,
  destination: v.destination,
  notes: v.notes,
})

const money = (cents: number) => (cents ? centsToText(cents) : '')

interface TripFormProps {
  trip: Trip | null
  shifts: Shift[]
  platforms: Platform[]
  defaultShiftId?: number | null
  onDone: () => void
  onCancel: () => void
}

/** Formulário rápido: só jornada, plataforma, data, valor e distância são necessários. */
export function TripForm({ trip, shifts, platforms, defaultShiftId, onDone, onCancel }: TripFormProps) {
  const openShift = shifts.find((s) => !s.endedAt)
  const activePlatforms = platforms.filter((p) => p.active || p.id === trip?.platformId)
  const form = useForm<TripFormValues>({
    resolver: schemaResolver(tripSchema, toInput),
    defaultValues: {
      shiftId: (trip?.shiftId ?? defaultShiftId ?? openShift?.id)?.toString() ?? '',
      platformId: trip?.platformId.toString() ?? (activePlatforms[0]?.id.toString() ?? ''),
      occurredAt: trip ? toLocalInput(trip.occurredAt) : nowLocalInput(),
      fareAmount: trip ? centsToText(trip.fareAmount) : '',
      tip: trip ? money(trip.tip) : '',
      extras: trip ? money(trip.extras) : '',
      distanceKm: trip ? distanceToText(trip.distanceKm) : '',
      durationMinutes: trip?.durationMinutes ? trip.durationMinutes.toString() : '',
      deadheadKm: trip?.deadheadKm ? distanceToText(trip.deadheadKm) : '',
      origin: trip?.origin ?? '',
      destination: trip?.destination ?? '',
      notes: trip?.notes ?? '',
    },
  })
  const { errors } = form.formState
  const dateWarning = futureDateWarning(useWatch({ control: form.control, name: 'occurredAt' }))
  const { submit, submitting } = useFormSubmit(
    form,
    (values) => {
      const input = toInput(values) as Parameters<ReturnType<typeof api>['trips']['create']>[0]
      return unwrap(trip ? api().trips.update({ ...input, id: trip.id }) : api().trips.create(input))
    },
    trip ? 'Viagem atualizada.' : 'Viagem registrada.',
    onDone,
  )

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Field label="Jornada *" error={errors.shiftId?.message} className="sm:col-span-2">
        {(f) => (
          <Select {...form.register('shiftId')} id={f.id} aria-invalid={f.invalid} aria-describedby={f.describedBy}>
            <option value="">Selecione…</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {new Date(s.startedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · {s.vehicleName}
                {s.endedAt ? '' : ' (em andamento)'}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Plataforma *" error={errors.platformId?.message}>
        {(f) => (
          <Select {...form.register('platformId')} id={f.id} aria-invalid={f.invalid} aria-describedby={f.describedBy}>
            <option value="">Selecione…</option>
            {activePlatforms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Valor da corrida (R$) *" error={errors.fareAmount?.message}>
        {(f) => <Input {...withMask(form.register('fareAmount'), maskMoney)} id={f.id} inputMode="numeric" placeholder="R$ 0,00" aria-invalid={f.invalid} aria-describedby={f.describedBy} autoFocus />}
      </Field>
      <Field label="Distância (km) *" error={errors.distanceKm?.message}>
        {(f) => <Input {...withMask(form.register('distanceKm'), maskDistance)} id={f.id} inputMode="decimal" aria-invalid={f.invalid} aria-describedby={f.describedBy} />}
      </Field>
      <Field label="Data e hora *" error={errors.occurredAt?.message} warning={dateWarning}>
        {(f) => <Input type="datetime-local" {...form.register('occurredAt')} id={f.id} aria-invalid={f.invalid} aria-describedby={f.describedBy} />}
      </Field>
      <details className="rounded-md border border-border p-3 sm:col-span-3">
        <summary className="cursor-pointer text-sm font-medium">Mais detalhes (opcional)</summary>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Gorjeta (R$)" error={errors.tip?.message}>
            {(f) => <Input {...withMask(form.register('tip'), maskMoney)} id={f.id} inputMode="numeric" placeholder="R$ 0,00" aria-invalid={f.invalid} aria-describedby={f.describedBy} />}
          </Field>
          <Field label="Adicionais (R$)" error={errors.extras?.message}>
            {(f) => <Input {...withMask(form.register('extras'), maskMoney)} id={f.id} inputMode="numeric" placeholder="R$ 0,00" aria-invalid={f.invalid} aria-describedby={f.describedBy} />}
          </Field>
          <Field label="Duração (min)" error={errors.durationMinutes?.message}>
            {(f) => <Input {...form.register('durationMinutes')} id={f.id} inputMode="numeric" aria-invalid={f.invalid} aria-describedby={f.describedBy} />}
          </Field>
          <Field label="Km vazio até o embarque" error={errors.deadheadKm?.message} hint="Deslocamento sem passageiro atribuído a esta corrida.">
            {(f) => <Input {...withMask(form.register('deadheadKm'), maskDistance)} id={f.id} inputMode="decimal" aria-invalid={f.invalid} aria-describedby={f.describedBy} />}
          </Field>
          <Field label="Origem" error={errors.origin?.message}>
            {(f) => <Input {...form.register('origin')} id={f.id} />}
          </Field>
          <Field label="Destino" error={errors.destination?.message}>
            {(f) => <Input {...form.register('destination')} id={f.id} />}
          </Field>
          <Field label="Observações" error={errors.notes?.message} hint="Obrigatória quando a distância for zero." className="sm:col-span-3">
            {(f) => <Textarea {...form.register('notes')} id={f.id} aria-invalid={f.invalid} aria-describedby={f.describedBy} />}
          </Field>
        </div>
      </details>
      <div className="sm:col-span-3">
        <FormActions submitting={submitting} onCancel={onCancel} />
      </div>
    </form>
  )
}
