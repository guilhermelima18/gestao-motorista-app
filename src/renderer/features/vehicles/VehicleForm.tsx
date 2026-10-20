import { FUEL_TYPES } from '@shared/domain'
import { vehicleSchema } from '@shared/schemas'
import type { Vehicle } from '@shared/types'
import { useForm } from 'react-hook-form'
import { FormActions } from '@/components/FormActions'
import { Field, Input, Select } from '@/components/ui/form-controls'
import { useFormSubmit } from '@/hooks/useFormSubmit'
import { api, unwrap } from '@/lib/api'
import { optionalNumberField, schemaResolver } from '@/lib/form'

interface VehicleFormValues {
  name: string
  brand: string
  model: string
  year: string
  plate: string
  mainFuel: string
  currentOdometer: string
  active: boolean
}

const toInput = (v: VehicleFormValues) => ({
  name: v.name,
  brand: v.brand,
  model: v.model,
  year: optionalNumberField(v.year),
  plate: v.plate,
  mainFuel: v.mainFuel,
  currentOdometer: optionalNumberField(v.currentOdometer),
  active: v.active,
})

export function VehicleForm({ vehicle, onDone, onCancel }: { vehicle: Vehicle | null; onDone: () => void; onCancel: () => void }) {
  const form = useForm<VehicleFormValues>({
    resolver: schemaResolver(vehicleSchema, toInput),
    defaultValues: {
      name: vehicle?.name ?? '',
      brand: vehicle?.brand ?? '',
      model: vehicle?.model ?? '',
      year: vehicle?.year?.toString() ?? '',
      plate: vehicle?.plate ?? '',
      mainFuel: vehicle?.mainFuel ?? '',
      currentOdometer: vehicle?.currentOdometer?.toString().replace('.', ',') ?? '',
      active: vehicle?.active ?? true,
    },
  })
  const { errors } = form.formState
  const { submit, submitting } = useFormSubmit(
    form,
    (values) => {
      const input = toInput(values)
      return unwrap(vehicle ? api().vehicles.update({ ...input, id: vehicle.id }) : api().vehicles.create(input))
    },
    vehicle ? 'Veículo atualizado.' : 'Veículo cadastrado.',
    onDone,
  )

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Nome *" error={errors.name?.message} className="sm:col-span-2">
        {(f) => <Input {...form.register('name')} id={f.id} aria-invalid={f.invalid} aria-describedby={f.describedBy} autoFocus placeholder="Ex.: Onix 2020" />}
      </Field>
      <Field label="Marca" error={errors.brand?.message}>
        {(f) => <Input {...form.register('brand')} id={f.id} aria-invalid={f.invalid} aria-describedby={f.describedBy} />}
      </Field>
      <Field label="Modelo" error={errors.model?.message}>
        {(f) => <Input {...form.register('model')} id={f.id} aria-invalid={f.invalid} aria-describedby={f.describedBy} />}
      </Field>
      <Field label="Ano" error={errors.year?.message}>
        {(f) => <Input {...form.register('year')} id={f.id} inputMode="numeric" aria-invalid={f.invalid} aria-describedby={f.describedBy} />}
      </Field>
      <Field label="Placa" error={errors.plate?.message}>
        {(f) => <Input {...form.register('plate')} id={f.id} aria-invalid={f.invalid} aria-describedby={f.describedBy} />}
      </Field>
      <Field label="Combustível principal" error={errors.mainFuel?.message}>
        {(f) => (
          <Select {...form.register('mainFuel')} id={f.id}>
            <option value="">Não informado</option>
            {FUEL_TYPES.map((fuel) => (
              <option key={fuel} value={fuel}>
                {fuel}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Quilometragem atual (km)" error={errors.currentOdometer?.message}>
        {(f) => <Input {...form.register('currentOdometer')} id={f.id} inputMode="decimal" aria-invalid={f.invalid} aria-describedby={f.describedBy} />}
      </Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" {...form.register('active')} /> Veículo ativo
      </label>
      <div className="sm:col-span-2">
        <FormActions submitting={submitting} onCancel={onCancel} />
      </div>
    </form>
  )
}
