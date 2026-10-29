import { centsToText } from '@shared/money'
import { goalSchema } from '@shared/schemas'
import type { Goal } from '@shared/types'
import { useForm } from 'react-hook-form'
import { FormActions } from '@/components/FormActions'
import { Field, Input, Select } from '@/components/ui/form-controls'
import { useFormSubmit } from '@/hooks/useFormSubmit'
import { api, unwrap } from '@/lib/api'
import { goalPeriodLabel, todayLocalDate } from '@/lib/dates'
import { maskMoney, moneyField, schemaResolver, withMask } from '@/lib/form'

interface GoalFormValues {
  description: string
  type: string
  period: string
  targetAmount: string
  referenceDate: string
  active: boolean
}

const toInput = (v: GoalFormValues) => ({
  description: v.description,
  type: v.type,
  period: v.period,
  targetAmount: moneyField(v.targetAmount),
  referenceDate: v.referenceDate,
  active: v.active,
})

export function GoalForm({ goal, onDone, onCancel }: { goal: Goal | null; onDone: () => void; onCancel: () => void }) {
  const form = useForm<GoalFormValues>({
    resolver: schemaResolver(goalSchema, toInput),
    defaultValues: {
      description: goal?.description ?? '',
      type: goal?.type ?? 'faturamento',
      period: goal?.period ?? 'diaria',
      targetAmount: goal ? centsToText(goal.targetAmount) : '',
      referenceDate: goal?.referenceDate ?? todayLocalDate(),
      active: goal?.active ?? true,
    },
  })
  const { errors } = form.formState
  const period = form.watch('period') as 'diaria' | 'semanal' | 'mensal'
  const referenceDate = form.watch('referenceDate')
  const periodPreview = /^\d{4}-\d{2}-\d{2}$/.test(referenceDate) ? `Vale para: ${goalPeriodLabel(period, referenceDate)}` : undefined
  const { submit, submitting } = useFormSubmit(
    form,
    (values) => {
      const input = toInput(values) as Parameters<ReturnType<typeof api>['goals']['create']>[0]
      return unwrap(goal ? api().goals.update({ ...input, id: goal.id }) : api().goals.create(input))
    },
    goal ? 'Meta atualizada.' : 'Meta criada.',
    onDone,
  )

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Descrição *" error={errors.description?.message} className="sm:col-span-2">
        {(f) => <Input {...form.register('description')} id={f.id} aria-invalid={f.invalid} aria-describedby={f.describedBy} autoFocus placeholder="Ex.: Meta do dia" />}
      </Field>
      <Field label="Tipo *" error={errors.type?.message} hint="Lucro usa o lucro operacional estimado.">
        {(f) => (
          <Select {...form.register('type')} id={f.id}>
            <option value="faturamento">Faturamento bruto</option>
            <option value="lucro">Lucro operacional</option>
          </Select>
        )}
      </Field>
      <Field label="Periodicidade *" error={errors.period?.message}>
        {(f) => (
          <Select {...form.register('period')} id={f.id}>
            <option value="diaria">Diária</option>
            <option value="semanal">Semanal</option>
            <option value="mensal">Mensal</option>
          </Select>
        )}
      </Field>
      <Field
        label="Data de referência *"
        error={errors.referenceDate?.message}
        hint={periodPreview ?? 'Dia, semana ou mês a que a meta se refere.'}
      >
        {(f) => <Input {...form.register('referenceDate')} id={f.id} type="date" aria-invalid={f.invalid} aria-describedby={f.describedBy} />}
      </Field>
      <Field label="Valor objetivo (R$) *" error={errors.targetAmount?.message}>
        {(f) => <Input {...withMask(form.register('targetAmount'), maskMoney)} id={f.id} inputMode="numeric" placeholder="R$ 0,00" aria-invalid={f.invalid} aria-describedby={f.describedBy} />}
      </Field>
      <label className="flex items-center gap-2 self-end text-sm">
        <input type="checkbox" {...form.register('active')} /> Meta ativa
      </label>
      <div className="sm:col-span-2">
        <FormActions submitting={submitting} onCancel={onCancel} />
      </div>
    </form>
  )
}
