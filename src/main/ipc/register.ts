import { API_METHODS, channelName } from '@shared/api'
import type { Result } from '@shared/types'
import { ipcMain, type IpcMainInvokeEvent, type WebContents } from 'electron'
import { ZodError } from 'zod'
import { DomainError } from '../services/errors'
import { createHandlers, type HandlerContext } from './handlers'

/** Converte qualquer exceção em um erro seguro para o renderer (sem stack nem detalhes internos). */
export function toErrorResult(error: unknown): Result<never> {
  if (error instanceof DomainError) {
    return { ok: false, error: { code: error.code, message: error.message, ...(error.field ? { field: error.field } : {}) } }
  }
  if (error instanceof ZodError) {
    const issue = error.issues[0]
    const field = issue?.path[0]
    return {
      ok: false,
      error: { code: 'VALIDACAO', message: issue?.message ?? 'Dados inválidos.', ...(field !== undefined ? { field: String(field) } : {}) },
    }
  }
  if (error instanceof Error && /FOREIGN KEY constraint failed/.test(error.message)) {
    return { ok: false, error: { code: 'POSSUI_VINCULOS', message: 'O registro possui vínculos com outros dados e não pode ser alterado dessa forma.' } }
  }
  console.error('[ipc] erro inesperado:', error)
  return { ok: false, error: { code: 'ERRO_INTERNO', message: 'Não foi possível concluir a operação. Tente novamente.' } }
}

export interface TrustedOrigin {
  /** WebContents da única janela autorizada. */
  getWebContents(): WebContents | null
  /** URL inicial do renderer (servidor de desenvolvimento ou arquivo empacotado). */
  isTrustedUrl(url: string): boolean
}

function isTrustedSender(event: IpcMainInvokeEvent, trusted: TrustedOrigin): boolean {
  const webContents = trusted.getWebContents()
  if (!webContents || event.sender !== webContents) return false
  const frame = event.senderFrame
  // Apenas o frame principal da janela autorizada pode chamar a API.
  return frame !== null && frame === webContents.mainFrame && trusted.isTrustedUrl(frame.url)
}

/** Registra um canal IPC para cada método da allowlist; nenhum canal genérico é exposto. */
export function registerIpc(ctx: HandlerContext, trusted: TrustedOrigin): void {
  const handlers = createHandlers(ctx)
  for (const [group, methods] of Object.entries(API_METHODS)) {
    for (const method of methods) {
      const run = (handlers as Record<string, Record<string, (input: unknown) => unknown>>)[group]![method]!
      ipcMain.handle(channelName(group, method), async (event, input: unknown): Promise<Result<unknown>> => {
        if (!isTrustedSender(event, trusted)) {
          return { ok: false, error: { code: 'NAO_AUTORIZADO', message: 'Origem não autorizada.' } }
        }
        try {
          return { ok: true, data: await run(input) }
        } catch (error) {
          return toErrorResult(error)
        }
      })
    }
  }
}
