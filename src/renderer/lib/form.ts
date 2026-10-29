import { parseCents, parseNumber } from '@shared/money'
import type { FieldValues, Resolver, UseFormRegisterReturn } from 'react-hook-form'
import type { ZodTypeAny } from 'zod'

// Conversores de campos de texto do formulário para os tipos esperados pelos schemas compartilhados.
// Texto vazio vira undefined (campo obrigatório ausente); texto inválido vira NaN (mensagem "inválido").

export function moneyField(text: string | undefined): number | undefined {
  if (!text || text.trim() === '') return undefined
  return parseCents(text) ?? Number.NaN
}

export function numberField(text: string | undefined): number | undefined {
  if (!text || text.trim() === '') return undefined
  return parseNumber(text) ?? Number.NaN
}

export function optionalNumberField(text: string | undefined): number | null {
  if (!text || text.trim() === '') return null
  return parseNumber(text) ?? Number.NaN
}

export function idField(text: string | undefined): number | undefined {
  if (!text) return undefined
  return Number(text)
}

export function optionalIdField(text: string | undefined): number | null {
  return text ? Number(text) : null
}

/**
 * Cria um resolver do React Hook Form que converte os valores (strings) para a entrada da API
 * e valida com o schema compartilhado, mapeando cada erro para o campo de mesmo nome.
 */
export function schemaResolver<V extends FieldValues>(schema: ZodTypeAny, toInput: (values: V) => unknown): Resolver<V> {
  return (values) => {
    const parsed = schema.safeParse(toInput(values))
    if (parsed.success) return { values, errors: {} }
    const errors: Record<string, { type: string; message: string }> = {}
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'root')
      if (!errors[key]) errors[key] = { type: issue.code, message: issue.message }
    }
    return { values: {}, errors } as ReturnType<Resolver<V>>
  }
}

/** Aplica uma máscara de digitação (CPF, celular) a um campo registrado no React Hook Form. */
export function withMask(registration: UseFormRegisterReturn, mask: (value: string) => string): UseFormRegisterReturn {
  return {
    ...registration,
    onChange: (event) => {
      event.target.value = mask(event.target.value)
      return registration.onChange(event)
    },
  }
}
