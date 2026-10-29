import { useState } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { LoginPage } from './LoginPage'
import { RecoverPage } from './RecoverPage'
import { RegisterPage } from './RegisterPage'

type Screen = 'login' | 'register' | 'recover'

/** Telas exibidas sem usuário logado. O tema segue o sistema, pois a preferência é guardada por usuário. */
export function AuthScreens() {
  useTheme('sistema')
  const [screen, setScreen] = useState<Screen>('login')
  const [cpf, setCpf] = useState('')

  if (screen === 'register') return <RegisterPage onBack={() => setScreen('login')} />
  if (screen === 'recover') {
    return (
      <RecoverPage
        initialCpf={cpf}
        onBack={(value) => {
          setCpf(value)
          setScreen('login')
        }}
      />
    )
  }
  return <LoginPage initialCpf={cpf} onRegister={() => setScreen('register')} onRecover={() => setScreen('recover')} />
}
