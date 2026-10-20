import type { Theme } from '@shared/domain'
import { useEffect } from 'react'

/** Aplica a classe `dark` na raiz conforme o tema escolhido (ou a preferência do sistema). */
export function useTheme(theme: Theme): void {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'escuro' || (theme === 'sistema' && media.matches)
      document.documentElement.classList.toggle('dark', dark)
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
}
