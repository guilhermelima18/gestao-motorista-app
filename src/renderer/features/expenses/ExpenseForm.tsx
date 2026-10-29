import { EXPENSE_CATEGORIES } from '@shared/domain'
import { centsToText } from '@shared/money'
import { expenseSchema } from '@shared/schemas'
import type { Expense, Shift, Vehicle } from '@shared/types'
import { useForm, useWatch } from 'react-hook-form'
import { FormActions } from '@/components/FormActions'
import { Field, Input, Select, Textarea } from '@/components/ui/form-controls'
import { useFormSubmit } from '@/hooks/useFormSubmit'
import { api, unwrap } from '@/lib/api'
import { futureDateWarning, localInputToIso, nowLocalInput, toLocalInput } from '@/lib/dates'
import { maskMoney, moneyField, optionalIdField, schemaResolver, withMask } from '@/lib/form'

interface ExpenseFormValues {
  description: string
  category: string
  amount: string
  expenseDate: string
  kind: string
  vehicleId: string
  shiftId: string
  notes: string
}

const toInput = (v: ExpenseFormValues) => ({
  description: v.description,
  category: v.category,
  amount: moneyField(v.amount),
  expenseDate: localInputToIso(v.expenseDate),
  kind: v.kind,
  vehicleId: optionalIdField(v.vehicleId),
  shiftId: optionalIdField(v.shiftId),
  notes: v.notes,
})

export function ExpenseForm({
  expense,
  vehicles,
  shifts,
  onDone,
  onCancel,
}: {
  expense: Expense | null
  vehicles: Vehicle[]
  shifts: Shift[]
  onDone: () => void
  onCancel: () => void
}) {
  const form = useForm<ExpenseFormValues>({
    resolver: schemaResolver(expenseSchema, toInput),
    defaultValues: {
      description: expense?.description ?? '',
      category: expense?.category ?? 'Outros',
      amount: expense ? centsToText(expense.amount) : '',
      expenseDate: expense ? toLocalInput(expense.expenseDate) : nowLocalInput(),
      kind: expense?.kind ?? 'operacional',
      vehicleId: expense?.vehicleId?.toString() ?? '',
      shiftId: expense?.shiftId?.toString() ?? '',
      notes: expense?.notes ?? '',
    },
  })
  const { errors } = form.formState
  const dateWarning = futureDateWarning(useWatch({ control: form.control, name: 'expenseDate' }))
  const { submit, submitting } = useFormSubmit(
    form,
    (values) => {
      const input = toInput(values) as Parameters<ReturnType<typeof api>['expenses']['create']>[0]
      return unwrap(expense ? api().expenses.update({ ...input, id: expense.id }) : api().expenses.create(input))
    },
    expense ? 'Despesa atualizada.' : 'Despesa registrada.',
    onDone,
  )

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Descrição *" error={errors.description?.message} className="sm:col-span-2">
        {(f) => <Input {...form.register('description')} id={f.id} aria-invalid={f.invalid} aria-describedby={f.describedBy} autoFocus />}
      </Field>
      <Field label="Categoria *" error={errors.category?.message} hint="Abastecimentos devem ser lançados em Abastecimentos.">
        {(f) => (
          <Select {...form.register('category')} id={f.id} aria-invalid={f.invalid} aria-describedby={f.describedBy}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Valor (R$) *" error={errors.amount?.message}>
        {(f) => <Input {...withMask(form.register('amount'), maskMoney)} id={f.id} inputMode="numeric" placeholder="R$ 0,00" aria-invalid={f.invalid} aria-describedby={f.describedBy} />}
      </Field>
      <Field label="Data *" error={errors.expenseDate?.message} warning={dateWarning}>
        {(f) => <Input type="datetime-local" {...form.register('expenseDate')} id={f.id} aria-invalid={f.invalid} aria-describedby={f.describedBy} />}
      </Field>
      <Field label="Tipo" error={errors.kind?.message}>
        {(f) => (
          <Select {...form.register('kind')} id={f.id}>
            <option value="operacional">Operacional</option>
            <option value="fixa">Fixa</option>
          </Select>
        )}
      </Field>
      <Field label="Veículo (opcional)" error={errors.vehicleId?.message}>
        {(f) => (
          <Select {...form.register('vehicleId')} id={f.id}>
            <option value="">Sem veículo específico</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Jornada (opcional)" error={errors.shiftId?.message}>
        {(f) => (
          <Select {...form.register('shiftId')} id={f.id} aria-invalid={f.invalid} aria-describedby={f.describedBy}>
            <option value="">Sem jornada</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {new Date(s.startedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · {s.vehicleName}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Observações" error={errors.notes?.message} className="sm:col-span-2">
        {(f) => <Textarea {...form.register('notes')} id={f.id} />}
      </Field>
      <div className="sm:col-span-2">
        <FormActions submitting={submitting} onCancel={onCancel} />
      </div>
    </form>
  )
}
