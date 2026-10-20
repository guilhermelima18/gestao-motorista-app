import type { Result } from '@shared/types'

/** Erro devolvido pelo processo principal, já com mensagem segura para exibição. */
export class ApiCallError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly field?: string,
  ) {
    super(message)
    this.name = 'ApiCallError'
  }
}

/** Desembrulha o resultado da API; lança ApiCallError quando a operação falhou. */
export async function unwrap<T>(promise: Promise<Result<T>>): Promise<T> {
  let result: Result<T>
  try {
    result = await promise
  } catch {
    throw new ApiCallError('ERRO_COMUNICACAO', 'Falha de comunicação com o aplicativo.')
  }
  if (!result.ok) throw new ApiCallError(result.error.code, result.error.message, result.error.field)
  return result.data
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocorreu um erro inesperado.'
}

export const api = (): Window['api'] => window.api
