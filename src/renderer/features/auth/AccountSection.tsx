import { formatCpf, formatPhone } from '@shared/cpf'
import { changePasswordSchema, profileSchema } from '@shared/schemas'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/display'
import { Field, Input } from '@/components/ui/form-controls'
import { useAuth } from '@/hooks/useAuth'
import { useFormSubmit } from '@/hooks/useFormSubmit'
import { api, unwrap } from '@/lib/api'
import { schemaResolver, withMask } from '@/lib/form'

interface ProfileValues {
  name: string
  email: string
  phone: string
}

interface PasswordValues {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

function ProfileForm() {
  const { user, setUser } = useAuth()
  const form = useForm<ProfileValues>({
    resolver: schemaResolver(profileSchema, (v: ProfileValues) => v),
    defaultValues: { name: user?.name ?? '', email: user?.email ?? '', phone: formatPhone(user?.phone ?? '') },
  })
  const { submit, submitting } = useFormSubmit(
    form,
    async (values) => setUser(await unwrap(api().auth.updateProfile(values))),
    'Dados atualizados.',
    () => undefined,
  )
  const errors = form.formState.errors

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <Field label="CPF" hint="O CPF identifica a conta e não pode ser alterado.">
        {(f) => <Input id={f.id} value={formatCpf(user?.cpf ?? '')} readOnly disabled aria-describedby={f.describedBy} />}
      </Field>
      <Field label="Nome *" error={errors.name?.message}>
        {(f) => <Input {...form.register('name')} id={f.id} aria-invalid={f.invalid} aria-describedby={f.describedBy} autoComplete="name" />}
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
      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Salvando…' : 'Salvar dados'}
        </Button>
      </div>
    </form>
  )
}

function PasswordForm() {
  const form = useForm<PasswordValues>({
    resolver: schemaResolver(changePasswordSchema, (v: PasswordValues) => v),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })
  const { submit, submitting } = useFormSubmit(
    form,
    (values) => unwrap(api().auth.changePassword(values)),
    'Senha alterada.',
    () => form.reset(),
  )
  const errors = form.formState.errors

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <Field label="Senha atual *" error={errors.currentPassword?.message}>
        {(f) => (
          <Input {...form.register('currentPassword')} id={f.id} type="password" aria-invalid={f.invalid} aria-describedby={f.describedBy} autoComplete="current-password" />
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
      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Alterando…' : 'Alterar senha'}
        </Button>
      </div>
    </form>
  )
}

/** Seção "Minha conta" das Configurações: dados pessoais e troca de senha. */
export function AccountSection() {
  return (
    <>
      <Card>
        <h2 className="mb-3 text-sm font-semibold">Minha conta</h2>
        <ProfileForm />
      </Card>
      <Card>
        <h2 className="mb-3 text-sm font-semibold">Alterar senha</h2>
        <PasswordForm />
      </Card>
    </>
  )
}
