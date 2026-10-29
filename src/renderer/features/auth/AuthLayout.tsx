import { Car } from 'lucide-react'
import type { ReactNode } from 'react'

/** Moldura das telas de login, cadastro e recuperação. */
export function AuthLayout({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center overflow-y-auto p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-muted">
          <Car size={18} aria-hidden /> Gestão do Motorista
        </div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {description ? <p className="mt-1 mb-4 text-sm text-muted">{description}</p> : <div className="mb-4" />}
        {children}
      </div>
    </div>
  )
}
