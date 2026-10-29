import { formatCpf, formatPhone } from '@shared/cpf'
import { registerSchema } from '@shared/schemas'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/form-controls'
import { useAuth } from '@/hooks/useAuth'
import { useFormSubmit } from '@/hooks/useFormSubmit'
import { api, errorMessage, unwrap } from '@/lib/api'
import { schemaResolver, withMask } from '@/lib/form'
import { useToast } from '@/components/ui/feedback'
import { AuthLayout } from './AuthLayout'
import { RecoveryCodeNotice } from './RecoveryCodeNotice'

interface RegisterValues {
  name: string
  cpf: string
  email: string
  phone: string
  password: string
  confirmPassword: string
}

export function RegisterPage({ onBack }: { onBack: () => void }) {
  const { signIn } = useAuth()
  const toast = useToast()
  // Depois do cadastro, mostra o código de recuperação e só então entra na conta.
  const [created, setCreated] = useState<{ code: string; cpf: string; password: string } | null>(null)
  const form = useForm<RegisterValues>({
    resolver: schemaResolver(registerSchema, (v: RegisterValues) => v),
    defaultValues: { name: '', cpf: '', email: '', phone: '', password: '', confirmPassword: '' },
  })
  const { submit, submitting } = useFormSubmit(
    form,
    async (values) => {
      const result = await unwrap(api().auth.register(values))
      setCreated({ code: result.recoveryCode, cpf: values.cpf, password: values.password })
    },
    'Conta criada.',
    () => undefined,
  )
  const errors = form.formState.errors

  if (created) {
    return (
      <AuthLayout title="Conta criada" description="Falta só guardar o seu código de recuperação.">
        <RecoveryCodeNotice
          code={created.code}
          continueLabel="Entrar no aplicativo"
          onContinue={() => signIn({ cpf: created.cpf, password: created.password, keepSignedIn: false }).catch((e: unknown) => toast.error(errorMessage(e)))}
        />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Criar conta" description="Cada conta tem seus próprios dados neste computador.">
      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        <Field label="Nome *" error={errors.name?.message}>
          {(f) => <Input {...form.register('name')} id={f.id} aria-invalid={f.invalid} aria-describedby={f.describedBy} autoFocus autoComplete="name" />}
        </Field>
        <Field label="CPF *" error={errors.cpf?.message}>
          {(f) => (
            <Input
              {...withMask(form.register('cpf'), formatCpf)}
              id={f.id}
              aria-invalid={f.invalid}
              aria-describedby={f.describedBy}
              inputMode="numeric"
              placeholder="000.000.000-00"
            />
          )}
        </Field>
        <Field label="E-mail *" error={errors.email?.message}>
          {(f) => <Input {...form.register('email')} id={f.id} type="email" aria-invalid={f.invalid} aria-describedby={f.describedBy} autoComplete="email" />}
        </Field>
        <Field label="Celular" error={errors.phone?.message}>
          {(f) => (
            <Input
              {...withMask(form.register('phone'), formatPhone)}
              id={f.id}
              aria-invalid={f.invalid}
              aria-describedby={f.describedBy}
              inputMode="tel"
              placeholder="(00) 00000-0000"
            />
          )}
        </Field>
        <Field label="Senha *" error={errors.password?.message} hint="Mínimo de 8 caracteres.">
          {(f) => <Input {...form.register('password')} id={f.id} type="password" aria-invalid={f.invalid} aria-describedby={f.describedBy} autoComplete="new-password" />}
        </Field>
        <Field label="Confirmar senha *" error={errors.confirmPassword?.message}>
          {(f) => (
            <Input {...form.register('confirmPassword')} id={f.id} type="password" aria-invalid={f.invalid} aria-describedby={f.describedBy} autoComplete="new-password" />
          )}
        </Field>
        <Button type="submit" disabled={submitting} className="mt-2">
          {submitting ? 'Criando…' : 'Criar conta'}
        </Button>
      </form>
      <div className="mt-4 text-sm">
        <button className="text-primary underline" onClick={onBack}>
          Já tenho conta
        </button>
      </div>
    </AuthLayout>
  )
}
