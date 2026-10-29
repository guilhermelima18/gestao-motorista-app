import { beforeEach, describe, expect, it } from 'vitest'
import type { Result } from '../../src/shared/types'
import { openDatabase } from '../../src/main/database/connection'
import { createHandlers, type HandlerContext, type SessionStore } from '../../src/main/ipc/handlers'
import { DomainError } from '../../src/main/services/errors'
import { API_METHODS } from '../../src/shared/api'

const CPF = '529.982.247-25'
const PASSWORD = 'senha-segura-1'

function memoryStore(): SessionStore & { token: string | null } {
  return {
    token: null,
    save(token) {
      this.token = token
    },
    load() {
      return this.token
    },
    clear() {
      this.token = null
    },
  }
}

let store: ReturnType<typeof memoryStore>
let ctx: HandlerContext
const db = () => ctx.db

function makeHandlers(shared?: HandlerContext) {
  ctx = shared ?? {
    db: openDatabase(':memory:'),
    version: 'teste',
    databasePath: 'x',
    backupsPath: 'y',
    sessionStore: store,
    saveFile: async () => ({ cancelled: true }),
  }
  return createHandlers(ctx)
}

async function call<T>(fn: (input: unknown) => unknown, input?: unknown): Promise<Result<T>> {
  try {
    return { ok: true, data: (await fn(input)) as T }
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, error: { code: error.code, message: error.message } }
    throw error
  }
}

beforeEach(() => {
  store = memoryStore()
})

const register = (h: ReturnType<typeof createHandlers>) =>
  h.auth.register({ name: 'Motorista', cpf: CPF, email: 'm@teste.com', password: PASSWORD, confirmPassword: PASSWORD })

describe('IPC: autenticação', () => {
  it('só os canais de auth funcionam sem login; todos os outros respondem NAO_AUTENTICADO', async () => {
    const h = makeHandlers()
    const open = ['register', 'login', 'recover', 'logout', 'session']
    for (const [group, methods] of Object.entries(API_METHODS)) {
      if (group === 'auth') continue
      for (const method of methods) {
        const run = (h as unknown as Record<string, Record<string, (i: unknown) => unknown>>)[group]![method]!
        const result = await call(run, undefined)
        expect(result, `${group}.${method}`).toMatchObject({ ok: false, error: { code: 'NAO_AUTENTICADO' } })
      }
    }
    expect(await call(h.auth.updateProfile, { name: 'X', email: 'x@teste.com' })).toMatchObject({ ok: false, error: { code: 'NAO_AUTENTICADO' } })
    expect(await call(h.auth.changePassword, {})).toMatchObject({ ok: false, error: { code: 'NAO_AUTENTICADO' } })
    expect(await call(h.auth.session)).toEqual({ ok: true, data: null })
    expect(open.every((m) => m in h.auth)).toBe(true)
  })

  it('cadastro não faz login; depois do login as telas passam a responder', async () => {
    const h = makeHandlers()
    const registered = await call<{ recoveryCode: string }>(h.auth.register, {
      name: 'Motorista', cpf: CPF, email: 'm@teste.com', password: PASSWORD, confirmPassword: PASSWORD,
    })
    expect(registered).toMatchObject({ ok: true })
    expect(registered.ok && registered.data.recoveryCode).toMatch(/^[A-Z2-9-]{19}$/)
    expect(await call(h.auth.session)).toEqual({ ok: true, data: null })
    expect(await call(h.vehicles.list)).toMatchObject({ ok: false, error: { code: 'NAO_AUTENTICADO' } })

    expect(await call(h.auth.login, { cpf: CPF, password: PASSWORD })).toMatchObject({ ok: true, data: { email: 'm@teste.com' } })
    expect(await call(h.vehicles.list)).toEqual({ ok: true, data: [] })
    expect(await call(h.auth.session)).toMatchObject({ ok: true, data: { cpf: '52998224725' } })
  })

  it('o renderer não consegue escolher o usuário: userId enviado na entrada é ignorado', async () => {
    const h = makeHandlers()
    await register(h)
    await h.auth.login({ cpf: CPF, password: PASSWORD })
    const created = await call<{ id: number }>(h.vehicles.create, { name: 'Meu carro', userId: 999, usuario_id: 999 })
    expect(created.ok).toBe(true)
    const owner = db().prepare('SELECT usuario_id FROM veiculos WHERE nome = ?').get('Meu carro') as { usuario_id: number }
    expect(owner.usuario_id).toBe(1)
  })

  it('logout bloqueia os canais novamente e apaga o token salvo', async () => {
    const h = makeHandlers()
    await register(h)
    await h.auth.login({ cpf: CPF, password: PASSWORD, keepSignedIn: true })
    expect(store.token).not.toBeNull()
    await h.auth.logout(undefined)
    expect(store.token).toBeNull()
    expect(await call(h.vehicles.list)).toMatchObject({ ok: false, error: { code: 'NAO_AUTENTICADO' } })
    expect((db().prepare('SELECT COUNT(*) AS n FROM sessoes').get() as { n: number }).n).toBe(0)
  })

  it('sem "Manter conectado" nada é salvo e a abertura seguinte pede login', async () => {
    const first = makeHandlers()
    await register(first)
    await first.auth.login({ cpf: CPF, password: PASSWORD, keepSignedIn: false })
    expect(store.token).toBeNull()
    const reopened = makeHandlers(ctx)
    expect(await call(reopened.auth.session)).toEqual({ ok: true, data: null })
  })

  it('com "Manter conectado" a abertura seguinte retoma a sessão', async () => {
    const first = makeHandlers()
    await register(first)
    await first.auth.login({ cpf: CPF, password: PASSWORD, keepSignedIn: true })
    const reopened = makeHandlers(ctx)
    expect(await call(reopened.auth.session)).toMatchObject({ ok: true, data: { cpf: '52998224725' } })
    expect(await call(reopened.vehicles.list)).toEqual({ ok: true, data: [] })
  })

  it('token expirado ou desconhecido não retoma a sessão e é descartado', async () => {
    const first = makeHandlers()
    await register(first)
    await first.auth.login({ cpf: CPF, password: PASSWORD, keepSignedIn: true })
    db().prepare('UPDATE sessoes SET expira_em = ?').run(new Date(Date.now() - 1000).toISOString())
    const reopened = makeHandlers(ctx)
    expect(await call(reopened.auth.session)).toEqual({ ok: true, data: null })
    expect(store.token).toBeNull()
  })

  it('um novo login sem a caixa marcada descarta o token salvo antes', async () => {
    const h = makeHandlers()
    await register(h)
    await h.auth.login({ cpf: CPF, password: PASSWORD, keepSignedIn: true })
    await h.auth.login({ cpf: CPF, password: PASSWORD, keepSignedIn: false })
    expect(store.token).toBeNull()
    expect((db().prepare('SELECT COUNT(*) AS n FROM sessoes').get() as { n: number }).n).toBe(0)
  })
})
