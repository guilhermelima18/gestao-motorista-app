import type { LoginInput } from '@shared/schemas'
import type { AuthUser } from '@shared/types'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, unwrap } from '@/lib/api'

interface AuthContextValue {
  user: AuthUser | null
  /** Verdadeiro enquanto o app verifica se há sessão salva ("Manter conectado"). */
  loading: boolean
  signIn(input: LoginInput): Promise<void>
  signOut(): Promise<void>
  setUser(user: AuthUser): void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth fora do AuthProvider')
  return context
}

/** Mantém o usuário atual. A identidade em si vive no processo principal; aqui fica só o espelho para a interface. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    unwrap(api().auth.session())
      .then((current) => {
        if (!cancelled) setUser(current)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const signIn = useCallback(async (input: LoginInput) => {
    setUser(await unwrap(api().auth.login(input)))
  }, [])

  const signOut = useCallback(async () => {
    await unwrap(api().auth.logout())
    window.location.hash = ''
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, loading, signIn, signOut, setUser }), [user, loading, signIn, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
