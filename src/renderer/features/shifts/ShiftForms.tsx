import { endShiftSchema, startShiftSchema } from '@shared/schemas'
import type { Settings, Shift, Vehicle } from '@shared/types'
import { useForm, useWatch } from 'react-hook-form'
import { FormActions } from '@/components/FormActions'
import { Field, Input, Select, Textarea } from '@/components/ui/form-controls'
import { useFormSubmit } from '@/hooks/useFormSubmit'
import { api, unwrap } from '@/lib/api'
import { futureDateWarning, localInputToIso, nowLocalInput } from '@/lib/dates'
import { idField, numberField, schemaResolver } from '@/lib/form'

interface StartValues {
  vehicleId: string
  startedAt: string
  startOdometer: string
  notes: string
}

const toStartInput = (v: StartValues) => ({
  vehicleId: idField(v.vehicleId),
  startedAt: localInputToIso(v.startedAt),
  startOdometer: numberField(v.startOdometer),
  notes: v.notes,
})

export function StartShiftForm({
  vehicles,
  settings,
  onDone,
  onCancel,
}: {
  vehicles: Vehicle[]
  settings: Settings | null
  onDone: () => void
  onCancel: () => void
}) {
  const active = vehicles.filter((v) => v.active)
  const preferred = active.find((v) => v.id === settings?.defaultVehicleId) ?? (active.length === 1 ? active[0] : undefined)
  const form = useForm<StartValues>({
    resolver: schemaResolver(startShiftSchema, toStartInput),
    defaultValues: {
      vehicleId: preferred?.id.toString() ?? '',
      startedAt: nowLocalInput(),
      startOdometer: preferred?.currentOdometer?.toString().replace('.', ',') ?? '',
      notes: '',
    },
  })
  const { errors } = form.formState
  const dateWarning = futureDateWarning(useWatch({ control: form.control, name: 'startedAt' }))
  const { submit, submitting } = useFormSubmit(
    form,
    (values) => unwrap(api().shifts.start(toStartInput(values) as Parameters<ReturnType<typeof api>['shifts']['start']>[0])),
    'Jornada iniciada.',
    onDone,
  )

  const onVehicleChange = (id: string) => {
    const vehicle = active.find((v) => v.id === Number(id))
    if (vehicle?.currentOdometer != null) form.setValue('startOdometer', vehicle.currentOdometer.toString().replace('.', ','))
  }

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Veículo *" error={errors.vehicleId?.message} className="sm:col-span-2">
        {(f) => (
          <Select
            {...form.register('vehicleId', { onChange: (e) => onVehicleChange(e.target.value) })}
            id={f.id}
            aria-invalid={f.invalid}
            aria-describedby={f.describedBy}
          >
            <option value="">Selecione…</option>
            {active.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Início *" error={errors.startedAt?.message} warning={dateWarning}>
        {(f) => <Input type="datetime-local" {...form.register('startedAt')} id={f.id} aria-invalid={f.invalid} aria-describedby={f.describedBy} />}
      </Field>
      <Field label="Quilometragem inicial (km) *" error={errors.startOdometer?.message}>
        {(f) => <Input {...form.register('startOdometer')} id={f.id} inputMode="decimal" aria-invalid={f.invalid} aria-describedby={f.describedBy} autoFocus />}
      </Field>
      <Field label="Observações" error={errors.notes?.message} className="sm:col-span-2">
        {(f) => <Textarea {...form.register('notes')} id={f.id} />}
      </Field>
      <div className="sm:col-span-2">
        <FormActions submitting={submitting} onCancel={onCancel} label="Iniciar jornada" />
      </div>
    </form>
  )
}

interface EndValues {
  endedAt: string
  endOdometer: string
  notes: string
}

export function EndShiftForm({ shift, onDone, onCancel }: { shift: Shift; onDone: () => void; onCancel: () => void }) {
  const toInput = (v: EndValues) => ({
    id: shift.id,
    endedAt: localInputToIso(v.endedAt),
    endOdometer: numberField(v.endOdometer),
    notes: v.notes,
  })
  const form = useForm<EndValues>({
    resolver: schemaResolver(endShiftSchema, toInput),
    defaultValues: { endedAt: nowLocalInput(), endOdometer: '', notes: shift.notes ?? '' },
  })
  const { errors } = form.formState
  const dateWarning = futureDateWarning(useWatch({ control: form.control, name: 'endedAt' }))
  const { submit, submitting } = useFormSubmit(
    form,
    (values) => unwrap(api().shifts.end(toInput(values) as Parameters<ReturnType<typeof api>['shifts']['end']>[0])),
    'Jornada encerrada.',
    onDone,
  )

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <p className="text-sm text-muted sm:col-span-2">
        Jornada de {shift.vehicleName} iniciada com {shift.startOdometer.toString().replace('.', ',')} km.
      </p>
      <Field label="Término *" error={errors.endedAt?.message} warning={dateWarning}>
        {(f) => <Input type="datetime-local" {...form.register('endedAt')} id={f.id} aria-invalid={f.invalid} aria-describedby={f.describedBy} />}
      </Field>
      <Field label="Quilometragem final (km) *" error={errors.endOdometer?.message}>
        {(f) => <Input {...form.register('endOdometer')} id={f.id} inputMode="decimal" aria-invalid={f.invalid} aria-describedby={f.describedBy} autoFocus />}
      </Field>
      <Field label="Observações" error={errors.notes?.message} className="sm:col-span-2">
        {(f) => <Textarea {...form.register('notes')} id={f.id} />}
      </Field>
      <div className="sm:col-span-2">
        <FormActions submitting={submitting} onCancel={onCancel} label="Encerrar jornada" />
      </div>
    </form>
  )
}
