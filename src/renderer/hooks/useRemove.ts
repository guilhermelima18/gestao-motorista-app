import type { Result } from '@shared/types'
import { useCallback } from 'react'
import { errorMessage, unwrap } from '@/lib/api'
import { useConfirm, useToast } from '@/components/ui/feedback'

/** Pede confirmação, executa a exclusão e atualiza a lista; erros viram toast. */
export function useRemove(remove: (id: number) => Promise<Result<null>>, entityLabel: string, onRemoved: () => void) {
  const confirm = useConfirm()
  const toast = useToast()

  return useCallback(
    async (id: number, detail?: string) => {
      const ok = await confirm({
        title: `Excluir ${entityLabel}?`,
        message: `${detail ? `${detail}. ` : ''}Esta ação não pode ser desfeita.`,
      })
      if (!ok) return
      try {
        await unwrap(remove(id))
        toast.success(`${entityLabel[0]?.toUpperCase()}${entityLabel.slice(1)} excluído(a).`)
        onRemoved()
      } catch (error) {
        toast.error(errorMessage(error))
      }
    },
    [confirm, toast, remove, entityLabel, onRemoved],
  )
}
