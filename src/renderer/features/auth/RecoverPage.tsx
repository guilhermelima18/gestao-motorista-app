import { formatCpf } from '@shared/cpf'
import { recoverSchema } from '@shared/schemas'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/form-controls'
import { useFormSubmit } from '@/hooks/useFormSubmit'
import { api, unwrap } from '@/lib/api'
import { schemaResolver, withMask } from '@/lib/form'
import { AuthLayout } from './AuthLayout'
import { RecoveryCodeNotice } from './RecoveryCodeNotice'

interface RecoverValues {
  cpf: string
  recoveryCode: string
  newPassword: string
  confirmPassword: string
}

export function RecoverPage({ initialCpf, onBack }: { initialCpf: string; onBack: (cpf: string) => void }) {
  const [newCode, setNewCode] = useState<{ code: string; cpf: string } | null>(null)
  const form = useForm<RecoverValues>({
    resolver: schemaResolver(recoverSchema, (v: RecoverValues) => v),
    defaultValues: { cpf: formatCpf(initialCpf), recoveryCode: '', newPassword: '', confirmPassword: '' },
  })
  const { submit, submitting } = useFormSubmit(
    form,
    async (values) => {
      const result = await unwrap(api().auth.recover(values))
      setNewCode({ code: result.recoveryCode, cpf: values.cpf })
    },
    'Senha redefinida.',
    () => undefined,
  )
  const errors = form.formState.errors

  if (newCode) {
    return (
      <AuthLayout title="Senha redefinida" description="O código anterior foi substituído por este novo.">
        <RecoveryCodeNotice code={newCode.code} continueLabel="Ir para o login" onContinue={() => onBack(newCode.cpf)} />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Recuperar senha" description="Informe seu CPF e o código de recuperação mostrado quando você criou a conta.">
      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        <Field label="CPF *" error={errors.cpf?.message}>
          {(f) => (
            <Input
              {...withMask(form.register('cpf'), formatCpf)}
              id={f.id}
              aria-invalid={f.invalid}
              aria-describedby={f.describedBy}
              autoFocus={!initialCpf}
              inputMode="numeric"
              placeholder="000.000.000-00"
            />
          )}
        </Field>
        <Field label="Código de recuperação *" error={errors.recoveryCode?.message}>
          {(f) => (
            <Input
              {...form.register('recoveryCode')}
              id={f.id}
              aria-invalid={f.invalid}
              aria-describedby={f.describedBy}
              autoFocus={Boolean(initialCpf)}
              autoComplete="off"
              spellCheck={false}
              className="font-mono uppercase"
              placeholder="XXXX-XXXX-XXXX-XXXX"
            />
          )}
        </Field>
        <Field label="Nova senha *" error={errors.newPassword?.message} hint="Mínimo de 8 caracteres.">
          {(f) => <Input {...form.register('newPassword')} id={f.id} type="password" aria-invalid={f.invalid} aria-describedby={f.describedBy} autoComplete="new-password" />}
        </Field>
        <Field label="Confirmar nova senha *" error={errors.confirmPassword?.message}>
          {(f) => (
            <Input {...form.register('confirmPassword')} id={f.id} type="password" aria-invalid={f.invalid} aria-describedby={f.describedBy} autoComplete="new-password" />
          )}
        </Field>
        <Button type="submit" disabled={submitting} className="mt-2">
          {submitting ? 'Redefinindo…' : 'Redefinir senha'}
        </Button>
      </form>
      <div className="mt-4 text-sm">
        <button className="text-primary underline" onClick={() => onBack(form.getValues('cpf'))}>
          Voltar ao login
        </button>
      </div>
    </AuthLayout>
  )
}
