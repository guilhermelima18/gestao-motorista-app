import { FUEL_TYPES } from '@shared/domain'
import { calculateTotalAmount, centsToText, formatCurrency } from '@shared/money'
import { refuelingSchema } from '@shared/schemas'
import type { Refueling, Settings, Shift, Vehicle } from '@shared/types'
import { useForm, useWatch } from 'react-hook-form'
import { FormActions } from '@/components/FormActions'
import { Field, Input, Select, Textarea } from '@/components/ui/form-controls'
import { useFormSubmit } from '@/hooks/useFormSubmit'
import { api, unwrap } from '@/lib/api'
import { futureDateWarning, localInputToIso, nowLocalInput, toLocalInput } from '@/lib/dates'
import { idField, kmToText, maskKm, maskMoney, moneyField, numberField, optionalIdField, schemaResolver, withMask } from '@/lib/form'

interface RefuelingFormValues {
  vehicleId: string
  shiftId: string
  refueledAt: string
  fuel: string
  liters: string
  pricePerLiter: string
  odometer: string
  fullTank: boolean
  station: string
  notes: string
}

const toInput = (v: RefuelingFormValues) => ({
  vehicleId: idField(v.vehicleId),
  shiftId: optionalIdField(v.shiftId),
  refueledAt: localInputToIso(v.refueledAt),
  fuel: v.fuel,
  liters: numberField(v.liters),
  pricePerLiter: moneyField(v.pricePerLiter),
  odometer: numberField(v.odometer),
  fullTank: v.fullTank,
  station: v.station,
  notes: v.notes,
})

interface RefuelingFormProps {
  refueling: Refueling | null
  vehicles: Vehicle[]
  shifts: Shift[]
  settings: Settings | null
  onDone: () => void
  onCancel: () => void
}

export function RefuelingForm({ refueling, vehicles, shifts, settings, onDone, onCancel }: RefuelingFormProps) {
  const activeVehicles = vehicles.filter((v) => v.active || v.id === refueling?.vehicleId)
  const defaultVehicle = activeVehicles.find((v) => v.id === settings?.defaultVehicleId) ?? activeVehicles[0]
  const form = useForm<RefuelingFormValues>({
    resolver: schemaResolver(refuelingSchema, toInput),
    defaultValues: {
      vehicleId: (refueling?.vehicleId ?? defaultVehicle?.id)?.toString() ?? '',
      shiftId: refueling?.shiftId?.toString() ?? '',
      refueledAt: refueling ? toLocalInput(refueling.refueledAt) : nowLocalInput(),
      fuel: refueling?.fuel ?? defaultVehicle?.mainFuel ?? 'Gasolina',
      liters: refueling?.liters.toString().replace('.', ',') ?? '',
      pricePerLiter: refueling ? centsToText(refueling.pricePerLiter) : '',
      odometer: (refueling?.odometer ?? defaultVehicle?.currentOdometer) != null ? kmToText((refueling?.odometer ?? defaultVehicle?.currentOdometer) as number) : '',
      fullTank: refueling?.fullTank ?? true,
      station: refueling?.station ?? '',
      notes: refueling?.notes ?? '',
    },
  })
  const { errors } = form.formState
  const watched = useWatch({ control: form.control })
  const liters = numberField(watched.liters)
  const price = moneyField(watched.pricePerLiter)
  const total = liters !== undefined && price !== undefined && liters > 0 && price > 0 ? calculateTotalAmount(liters, price) : null
  const vehicleId = Number(watched.vehicleId)

  const { submit, submitting } = useFormSubmit(
    form,
    (values) => {
      const input = toInput(values) as Parameters<ReturnType<typeof api>['refuelings']['create']>[0]
      return unwrap(refueling ? api().refuelings.update({ ...input, id: refueling.id }) : api().refuelings.create(input))
    },
    refueling ? 'Abastecimento atualizado.' : 'Abastecimento registrado.',
    onDone,
  )

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Field label="Veículo *" error={errors.vehicleId?.message}>
        {(f) => (
          <Select {...form.register('vehicleId')} id={f.id} aria-invalid={f.invalid} aria-describedby={f.describedBy}>
            <option value="">Selecione…</option>
            {activeVehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Data e hora *" error={errors.refueledAt?.message} warning={futureDateWarning(watched.refueledAt)}>
        {(f) => <Input type="datetime-local" {...form.register('refueledAt')} id={f.id} aria-invalid={f.invalid} aria-describedby={f.describedBy} />}
      </Field>
      <Field label="Combustível *" error={errors.fuel?.message}>
        {(f) => (
          <Select {...form.register('fuel')} id={f.id} aria-invalid={f.invalid} aria-describedby={f.describedBy}>
            {FUEL_TYPES.map((fuel) => (
              <option key={fuel} value={fuel}>
                {fuel}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Litros *" error={errors.liters?.message}>
        {(f) => <Input {...form.register('liters')} id={f.id} inputMode="decimal" aria-invalid={f.invalid} aria-describedby={f.describedBy} autoFocus />}
      </Field>
      <Field label="Preço por litro (R$) *" error={errors.pricePerLiter?.message}>
        {(f) => <Input {...withMask(form.register('pricePerLiter'), maskMoney)} id={f.id} inputMode="numeric" placeholder="R$ 0,00" aria-invalid={f.invalid} aria-describedby={f.describedBy} />}
      </Field>
      <Field label="Valor total (calculado)">
        {(f) => <Input id={f.id} readOnly value={total === null ? '—' : formatCurrency(total)} aria-live="polite" />}
      </Field>
      <Field label="Odômetro (km) *" error={errors.odometer?.message}>
        {(f) => <Input {...withMask(form.register('odometer'), maskKm)} id={f.id} inputMode="decimal" aria-invalid={f.invalid} aria-describedby={f.describedBy} />}
      </Field>
      <Field label="Jornada (opcional)" error={errors.shiftId?.message}>
        {(f) => (
          <Select {...form.register('shiftId')} id={f.id}>
            <option value="">Fora de jornada</option>
            {shifts
              .filter((s) => !vehicleId || s.vehicleId === vehicleId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {new Date(s.startedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </option>
              ))}
          </Select>
        )}
      </Field>
      <Field label="Posto" error={errors.station?.message}>
        {(f) => <Input {...form.register('station')} id={f.id} />}
      </Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-3">
        <input type="checkbox" {...form.register('fullTank')} /> Tanque completo (necessário para calcular o consumo médio)
      </label>
      <Field label="Observações" error={errors.notes?.message} className="sm:col-span-3">
        {(f) => <Textarea {...form.register('notes')} id={f.id} />}
      </Field>
      <div className="sm:col-span-3">
        <FormActions submitting={submitting} onCancel={onCancel} />
      </div>
    </form>
  )
}
