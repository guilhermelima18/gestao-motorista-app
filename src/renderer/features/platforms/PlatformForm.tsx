import { platformSchema } from '@shared/schemas'
import type { Platform } from '@shared/types'
import { useForm } from 'react-hook-form'
import { FormActions } from '@/components/FormActions'
import { Field, Input } from '@/components/ui/form-controls'
import { useFormSubmit } from '@/hooks/useFormSubmit'
import { api, unwrap } from '@/lib/api'
import { schemaResolver } from '@/lib/form'

interface PlatformFormValues {
  name: string
  active: boolean
}

export function PlatformForm({ platform, onDone, onCancel }: { platform: Platform | null; onDone: () => void; onCancel: () => void }) {
  const form = useForm<PlatformFormValues>({
    resolver: schemaResolver(platformSchema, (v: PlatformFormValues) => v),
    defaultValues: { name: platform?.name ?? '', active: platform?.active ?? true },
  })
  const { submit, submitting } = useFormSubmit(
    form,
    (values) => unwrap(platform ? api().platforms.update({ ...values, id: platform.id }) : api().platforms.create(values)),
    platform ? 'Plataforma atualizada.' : 'Plataforma cadastrada.',
    onDone,
  )

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <Field label="Nome *" error={form.formState.errors.name?.message}>
        {(f) => <Input {...form.register('name')} id={f.id} aria-invalid={f.invalid} aria-describedby={f.describedBy} autoFocus placeholder="Ex.: InDrive" />}
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...form.register('active')} /> Plataforma ativa
      </label>
      <FormActions submitting={submitting} onCancel={onCancel} />
    </form>
  )
}
