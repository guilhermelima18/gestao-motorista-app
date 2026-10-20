import * as Dialog from '@radix-ui/react-dialog'
import { CheckCircle2, CircleAlert } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from './button'

// ---------- Toasts ----------

interface ToastItem {
  id: number
  kind: 'success' | 'error'
  message: string
}

interface ToastApi {
  success(message: string): void
  error(message: string): void
}

const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast fora do FeedbackProvider')
  return context
}

// ---------- Confirmação ----------

interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

/** Abre um diálogo de confirmação e resolve com a escolha do usuário. */
export function useConfirm(): ConfirmFn {
  const context = useContext(ConfirmContext)
  if (!context) throw new Error('useConfirm fora do FeedbackProvider')
  return context
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (value: boolean) => void }) | null>(null)
  const nextId = useRef(1)

  const push = useCallback((kind: ToastItem['kind'], message: string) => {
    const id = nextId.current++
    setToasts((current) => [...current, { id, kind, message }])
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), kind === 'error' ? 7000 : 3500)
  }, [])

  const toast = useMemo<ToastApi>(
    () => ({ success: (m) => push('success', m), error: (m) => push('error', m) }),
    [push],
  )

  const confirm = useCallback<ConfirmFn>(
    (options) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  )

  const close = (value: boolean) => {
    pending?.resolve(value)
    setPending(null)
  }

  return (
    <ToastContext.Provider value={toast}>
      <ConfirmContext.Provider value={confirm}>
        {children}
        <div className="fixed right-4 bottom-4 z-[60] flex flex-col gap-2" aria-live="polite">
          {toasts.map((t) => (
            <div
              key={t.id}
              role={t.kind === 'error' ? 'alert' : 'status'}
              className="flex max-w-sm items-start gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-lg"
            >
              {t.kind === 'success' ? (
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" />
              ) : (
                <CircleAlert size={18} className="mt-0.5 shrink-0 text-danger" />
              )}
              <span>{t.message}</span>
            </div>
          ))}
        </div>
        <Dialog.Root open={pending !== null} onOpenChange={(open) => !open && close(false)}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/50" />
            <Dialog.Content className="fixed top-1/2 left-1/2 z-[80] w-[min(420px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-5 shadow-xl">
              <Dialog.Title className="text-lg font-semibold">{pending?.title}</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-muted">{pending?.message}</Dialog.Description>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="outline" onClick={() => close(false)}>
                  Cancelar
                </Button>
                <Button variant="danger" onClick={() => close(true)}>
                  {pending?.confirmLabel ?? 'Excluir'}
                </Button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  )
}
