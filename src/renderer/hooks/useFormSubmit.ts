import { useCallback, useState } from 'react'
import type { FieldPath, FieldValues, UseFormReturn } from 'react-hook-form'
import { ApiCallError, errorMessage } from '@/lib/api'
import { useToast } from '@/components/ui/feedback'

/**
 * Envolve o envio de um formulário: executa a ação, mostra o resultado em toast e
 * leva erros de campo vindos do processo principal para o campo correspondente.
 */
export function useFormSubmit<V extends FieldValues>(
  form: UseFormReturn<V>,
  action: (values: V) => Promise<unknown>,
  successMessage: string,
  onDone: () => void,
) {
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)

  const submit = useCallback(
    form.handleSubmit(async (values) => {
      setSubmitting(true)
      try {
        await action(values)
        toast.success(successMessage)
        onDone()
      } catch (error) {
        if (error instanceof ApiCallError && error.field && error.field in form.getValues()) {
          form.setError(error.field as FieldPath<V>, { message: error.message }, { shouldFocus: true })
        } else {
          toast.error(errorMessage(error))
        }
      } finally {
        setSubmitting(false)
      }
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form, action, successMessage, onDone],
  )

  return { submit, submitting }
}
