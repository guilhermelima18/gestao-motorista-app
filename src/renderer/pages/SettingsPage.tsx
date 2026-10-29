import { THEMES, type Theme } from '@shared/domain'
import { DatabaseBackup } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, ErrorBlock, LoadingBlock, PageHeader } from '@/components/ui/display'
import { useToast } from '@/components/ui/feedback'
import { AccountSection } from '@/features/auth/AccountSection'
import { Field, Select } from '@/components/ui/form-controls'
import { useApiQuery } from '@/hooks/useApiQuery'
import { api, errorMessage, unwrap } from '@/lib/api'

const THEME_LABEL: Record<Theme, string> = { claro: 'Claro', escuro: 'Escuro', sistema: 'Seguir o sistema' }

export function SettingsPage({ onThemeChange }: { onThemeChange: (theme: Theme) => void }) {
  const settings = useApiQuery(() => api().settings.get(), [])
  const info = useApiQuery(() => api().settings.appInfo(), [])
  const toast = useToast()
  const [backingUp, setBackingUp] = useState(false)

  const changeTheme = async (theme: Theme) => {
    try {
      await unwrap(api().settings.save({ key: 'tema', value: theme }))
      onThemeChange(theme)
      settings.reload()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const backup = async () => {
    setBackingUp(true)
    try {
      const result = await unwrap(api().settings.backup())
      toast.success(`Backup criado em ${result.path}`)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBackingUp(false)
    }
  }

  return (
    <>
      <PageHeader title="Configurações" description="Preferências locais e proteção dos seus dados." />
      {settings.loading && !settings.data ? <LoadingBlock /> : null}
      {settings.error ? <ErrorBlock message={settings.error} onRetry={settings.reload} /> : null}
      <div className="flex max-w-2xl flex-col gap-4">
        <AccountSection />
        {settings.data ? (
          <Card>
            <h2 className="mb-3 text-sm font-semibold">Aparência</h2>
            <Field label="Tema">
              {(f) => (
                <Select id={f.id} value={settings.data?.theme} onChange={(e) => void changeTheme(e.target.value as Theme)}>
                  {THEMES.map((t) => (
                    <option key={t} value={t}>
                      {THEME_LABEL[t]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <p className="mt-2 text-xs text-muted">O veículo padrão é escolhido na tela de Veículos.</p>
          </Card>
        ) : null}
        <Card>
          <h2 className="mb-1 text-sm font-semibold">Banco de dados e backup</h2>
          <p className="mb-3 text-sm text-muted">
            Os dados ficam somente neste computador e são preservados nas atualizações. Um backup automático é criado antes de qualquer migração do banco.
          </p>
          {info.data ? (
            <dl className="mb-3 grid gap-2 text-sm">
              <div>
                <dt className="text-xs text-muted">Arquivo do banco</dt>
                <dd className="font-mono text-xs break-all">{info.data.databasePath}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Pasta de backups</dt>
                <dd className="font-mono text-xs break-all">{info.data.backupsPath}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Versão</dt>
                <dd>{info.data.version}</dd>
              </div>
            </dl>
          ) : null}
          <Button variant="outline" disabled={backingUp} onClick={() => void backup()}>
            <DatabaseBackup size={16} /> {backingUp ? 'Criando backup…' : 'Fazer backup agora'}
          </Button>
        </Card>
      </div>
    </>
  )
}
