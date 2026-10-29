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

/** Máscara monetária: os dígitos entram como centavos ("123456" -> "R$ 1.234,56"); sem dígitos, campo vazio. */
export function maskMoney(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits === '') return ''
  return (Number(digits) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Máscara de quilometragem: só dígitos, com ponto de milhar ("192722" -> "192.722"). */
export function maskKm(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits === '') return ''
  return new Intl.NumberFormat('pt-BR').format(Number(digits))
}

/** Máscara de distância da viagem: os dígitos entram como centésimos ("868" -> "8,68", "123456" -> "1.234,56"). */
export function maskDistance(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 9)
  if (digits === '') return ''
  return distanceToText(Number(digits) / 100)
}

/** Distância para campos de edição, já mascarada: 8.68 -> "8,68", 10 -> "10,00". */
export function distanceToText(km: number): string {
  return km.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Quilometragem para campos de edição: 192722 -> "192.722". */
export function kmToText(km: number): string {
  return km.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
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
