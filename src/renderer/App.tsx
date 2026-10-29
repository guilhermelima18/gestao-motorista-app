import type { Theme } from '@shared/domain'
import {
  Car,
  Fuel,
  LayoutDashboard,
  LogOut,
  Receipt,
  Route,
  Settings as SettingsIcon,
  Target,
  Users,
  Waypoints,
  BarChart3,
  type LucideIcon,
} from 'lucide-react'
import { Component, useCallback, useEffect, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { FeedbackProvider, useToast } from '@/components/ui/feedback'
import { LoadingBlock } from '@/components/ui/display'
import { AuthScreens } from '@/features/auth/AuthScreens'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { useSettings } from '@/hooks/useLookups'
import { useShortcut } from '@/hooks/useShortcut'
import { useTheme } from '@/hooks/useTheme'
import { errorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import { DashboardPage } from '@/pages/DashboardPage'
import { ExpensesPage } from '@/pages/ExpensesPage'
import { GoalsPage } from '@/pages/GoalsPage'
import { PlatformsPage } from '@/pages/PlatformsPage'
import { RefuelingsPage } from '@/pages/RefuelingsPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ShiftsPage } from '@/pages/ShiftsPage'
import { TripsPage } from '@/pages/TripsPage'
import { VehiclesPage } from '@/pages/VehiclesPage'

type PageKey = 'dashboard' | 'shifts' | 'trips' | 'refuelings' | 'expenses' | 'goals' | 'vehicles' | 'platforms' | 'reports' | 'settings'

const NAV: { key: PageKey; label: string; icon: LucideIcon }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'shifts', label: 'Jornadas', icon: Route },
  { key: 'trips', label: 'Viagens', icon: Users },
  { key: 'refuelings', label: 'Abastecimentos', icon: Fuel },
  { key: 'expenses', label: 'Despesas', icon: Receipt },
  { key: 'goals', label: 'Metas', icon: Target },
  { key: 'vehicles', label: 'Veículos', icon: Car },
  { key: 'platforms', label: 'Plataformas', icon: Waypoints },
  { key: 'reports', label: 'Relatórios', icon: BarChart3 },
  { key: 'settings', label: 'Configurações', icon: SettingsIcon },
]

function pageFromHash(): PageKey {
  const key = window.location.hash.replace('#/', '')
  return NAV.some((n) => n.key === key) ? (key as PageKey) : 'dashboard'
}

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  override render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center" role="alert">
        <h1 className="text-lg font-semibold">Algo deu errado nesta tela</h1>
        <p className="text-sm text-muted">Seus dados estão salvos. Tente recarregar a tela.</p>
        <Button onClick={() => this.setState({ failed: false })}>Tentar novamente</Button>
      </div>
    )
  }
}

function Shell() {
  const [page, setPage] = useState<PageKey>(pageFromHash)
  const { user, signOut } = useAuth()
  const toast = useToast()
  const settings = useSettings()
  const [theme, setTheme] = useState<Theme>('sistema')
  useTheme(theme)

  useEffect(() => {
    if (settings.data) setTheme(settings.data.theme)
  }, [settings.data])

  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = useCallback((key: PageKey) => {
    window.location.hash = `#/${key}`
    setPage(key)
  }, [])

  // Atalhos Alt+1…Alt+0 para navegar entre as telas.
  useShortcut('1', () => navigate('dashboard'), { alt: true })
  useShortcut('2', () => navigate('shifts'), { alt: true })
  useShortcut('3', () => navigate('trips'), { alt: true })
  useShortcut('4', () => navigate('refuelings'), { alt: true })
  useShortcut('5', () => navigate('expenses'), { alt: true })
  useShortcut('6', () => navigate('goals'), { alt: true })
  useShortcut('7', () => navigate('vehicles'), { alt: true })
  useShortcut('8', () => navigate('platforms'), { alt: true })
  useShortcut('9', () => navigate('reports'), { alt: true })
  useShortcut('0', () => navigate('settings'), { alt: true })

  return (
    <div className="flex h-full">
      <nav aria-label="Navegação principal" className="flex w-56 shrink-0 flex-col gap-1 border-r border-border bg-surface p-3 max-md:w-14">
        <div className="mb-3 px-2 text-sm font-semibold max-md:hidden">Gestão do Motorista</div>
        {NAV.map((item, index) => {
          const Icon = item.icon
          const active = page === item.key
          return (
            <button
              key={item.key}
              onClick={() => navigate(item.key)}
              aria-current={active ? 'page' : undefined}
              title={`${item.label} (Alt+${(index + 1) % 10})`}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm max-md:justify-center max-md:px-0',
                active ? 'bg-primary text-primary-fg' : 'text-fg hover:bg-surface-2',
              )}
            >
              <Icon size={18} aria-hidden />
              <span className="max-md:sr-only">{item.label}</span>
            </button>
          )
        })}
        <div className="mt-auto flex flex-col gap-1 border-t border-border pt-3">
          <div className="truncate px-2 text-xs text-muted max-md:hidden" title={user?.email}>
            {user?.name}
          </div>
          <button
            onClick={() => void signOut().catch((error: unknown) => toast.error(errorMessage(error)))}
            title="Sair da conta"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-fg hover:bg-surface-2 max-md:justify-center max-md:px-0"
          >
            <LogOut size={18} aria-hidden />
            <span className="max-md:sr-only">Sair</span>
          </button>
        </div>
      </nav>
      <main className="min-w-0 flex-1 overflow-y-auto p-6 max-md:p-4">
        <ErrorBoundary key={page}>
          {page === 'dashboard' && <DashboardPage onNavigate={navigate} />}
          {page === 'shifts' && <ShiftsPage />}
          {page === 'trips' && <TripsPage />}
          {page === 'refuelings' && <RefuelingsPage />}
          {page === 'expenses' && <ExpensesPage />}
          {page === 'goals' && <GoalsPage />}
          {page === 'vehicles' && <VehiclesPage />}
          {page === 'platforms' && <PlatformsPage />}
          {page === 'reports' && <ReportsPage />}
          {page === 'settings' && <SettingsPage onThemeChange={setTheme} />}
        </ErrorBoundary>
      </main>
    </div>
  )
}

/** Portão de acesso: sem usuário logado só as telas de autenticação existem. */
function AuthGate() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingBlock />
  if (!user) return <AuthScreens />
  // `key` remonta toda a interface ao trocar de usuário, descartando qualquer dado carregado do anterior.
  return <Shell key={user.id} />
}

export function App() {
  return (
    <FeedbackProvider>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </FeedbackProvider>
  )
}
