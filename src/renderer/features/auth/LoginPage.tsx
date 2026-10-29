import { formatCpf } from '@shared/cpf'
import { loginSchema } from '@shared/schemas'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/form-controls'
import { useAuth } from '@/hooks/useAuth'
import { useFormSubmit } from '@/hooks/useFormSubmit'
import { schemaResolver, withMask } from '@/lib/form'
import { AuthLayout } from './AuthLayout'

interface LoginValues {
  cpf: string
  password: string
  keepSignedIn: boolean
}

export function LoginPage({ initialCpf, onRegister, onRecover }: { initialCpf: string; onRegister: () => void; onRecover: () => void }) {
  const { signIn } = useAuth()
  const form = useForm<LoginValues>({
    resolver: schemaResolver(loginSchema, (v: LoginValues) => v),
    defaultValues: { cpf: formatCpf(initialCpf), password: '', keepSignedIn: false },
  })
  const { submit, submitting } = useFormSubmit(form, (values) => signIn(values), 'Bem-vindo!', () => undefined)
  const errors = form.formState.errors

  return (
    <AuthLayout title="Entrar" description="Acesse sua conta com CPF e senha.">
      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        <Field label="CPF" error={errors.cpf?.message}>
          {(f) => (
            <Input
              {...withMask(form.register('cpf'), formatCpf)}
              id={f.id}
              aria-invalid={f.invalid}
              aria-describedby={f.describedBy}
              autoFocus={!initialCpf}
              inputMode="numeric"
              autoComplete="username"
              placeholder="000.000.000-00"
            />
          )}
        </Field>
        <Field label="Senha" error={errors.password?.message}>
          {(f) => (
            <Input
              {...form.register('password')}
              id={f.id}
              type="password"
              aria-invalid={f.invalid}
              aria-describedby={f.describedBy}
              autoFocus={Boolean(initialCpf)}
              autoComplete="current-password"
            />
          )}
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...form.register('keepSignedIn')} /> Manter conectado neste computador
        </label>
        <Button type="submit" disabled={submitting} className="mt-2">
          {submitting ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      <div className="mt-4 flex flex-wrap justify-between gap-2 text-sm">
        <button className="text-primary underline" onClick={onRecover}>
          Esqueci minha senha
        </button>
        <button className="text-primary underline" onClick={onRegister}>
          Criar conta
        </button>
      </div>
    </AuthLayout>
  )
}
