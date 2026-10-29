import {
  changePasswordSchema,
  loginSchema,
  profileSchema,
  recoverSchema,
  registerSchema,
  type ChangePasswordInput,
  type LoginInput,
  type ProfileInput,
  type RecoverInput,
  type RegisterInput,
} from '@shared/schemas'
import type { AuthUser, RecoverResult, RegisterResult } from '@shared/types'
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { isUniqueViolation, nowIso, type Db } from './common'
import { DomainError } from './errors'
import { seedDefaultPlatforms } from './platforms'

export const MAX_FAILED_ATTEMPTS = 5
export const LOCK_MINUTES = 5
export const SESSION_DAYS = 30

const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 32 símbolos, sem I/O/0/1 que se confundem
const RECOVERY_LENGTH = 16

// ---------- Hash de senha e código de recuperação (scrypt, sem dependência externa) ----------

const KEY_LENGTH = 64

export function hashSecret(secret: string): string {
  const salt = randomBytes(16)
  const key = scryptSync(secret, salt, KEY_LENGTH)
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`
}

export function verifySecret(secret: string, stored: string): boolean {
  const [scheme, salt, key] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !key) return false
  const expected = Buffer.from(key, 'base64')
  const actual = scryptSync(secret, Buffer.from(salt, 'base64'), expected.length)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

// Verificado quando o CPF não existe, para que o tempo de resposta não revele se a conta existe.
const DUMMY_HASH = hashSecret('senha-inexistente')

/** 16 caracteres legíveis agrupados de 4 em 4 (ex.: K7QM-2XWD-9PHT-4RNB). */
export function generateRecoveryCode(): string {
  const bytes = randomBytes(RECOVERY_LENGTH)
  let code = ''
  for (let i = 0; i < RECOVERY_LENGTH; i++) code += RECOVERY_ALPHABET[bytes[i]! & 31]
  return code.match(/.{4}/g)!.join('-')
}

const normalizeCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '')

// ---------- Usuários ----------

interface UserRow {
  id: number
  name: string
  cpf: string
  email: string
  phone: string | null
  createdAt: string
}

const USER_SELECT = 'SELECT id, nome AS name, cpf, email, celular AS phone, criado_em AS createdAt FROM usuarios'

export function getUser(db: Db, userId: number): AuthUser {
  const row = db.prepare(`${USER_SELECT} WHERE id = ? AND ativo = 1`).get(userId) as UserRow | undefined
  if (!row) throw new DomainError('NAO_AUTENTICADO', 'Faça login para continuar.')
  return row
}

const duplicateCpf = () => new DomainError('CPF_DUPLICADO', 'Já existe uma conta com este CPF.', 'cpf')
const duplicateEmail = () => new DomainError('EMAIL_DUPLICADO', 'Já existe uma conta com este e-mail.', 'email')
const invalidCredentials = () => new DomainError('CREDENCIAIS_INVALIDAS', 'CPF ou senha inválidos.')

function mapUniqueViolation(error: unknown): DomainError | null {
  if (!isUniqueViolation(error)) return null
  return /usuarios\.email/.test((error as Error).message) ? duplicateEmail() : duplicateCpf()
}

/** Tabelas de dados cujas linhas antigas (sem dono) passam para o primeiro usuário cadastrado. */
const OWNED_TABLES = ['veiculos', 'plataformas', 'jornadas', 'viagens', 'abastecimentos', 'despesas', 'metas', 'configuracoes']

/**
 * Cria a conta e devolve o código de recuperação (única vez em que ele existe em texto claro).
 * O primeiro usuário adota os dados que já existiam no banco; os seguintes começam com Uber e 99.
 */
export function registerUser(db: Db, input: RegisterInput): RegisterResult & { user: AuthUser } {
  const data = registerSchema.parse(input)
  const recoveryCode = generateRecoveryCode()
  const passwordHash = hashSecret(data.password)
  const recoveryHash = hashSecret(normalizeCode(recoveryCode))

  const run = db.transaction(() => {
    const isFirst = (db.prepare('SELECT COUNT(*) AS total FROM usuarios').get() as { total: number }).total === 0
    const now = nowIso()
    const result = db
      .prepare(
        `INSERT INTO usuarios (nome, cpf, email, celular, senha_hash, codigo_recuperacao_hash, criado_em, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(data.name, data.cpf, data.email, data.phone, passwordHash, recoveryHash, now, now)
    const userId = Number(result.lastInsertRowid)
    if (isFirst) {
      for (const table of OWNED_TABLES) db.prepare(`UPDATE ${table} SET usuario_id = ? WHERE usuario_id IS NULL`).run(userId)
    } else {
      seedDefaultPlatforms(db, userId)
    }
    return userId
  })

  try {
    const userId = run()
    return { user: getUser(db, userId), recoveryCode }
  } catch (error) {
    throw mapUniqueViolation(error) ?? error
  }
}

interface LoginRow {
  id: number
  senha_hash: string
  tentativas_falhas: number
  bloqueado_ate: string | null
}

/** Valida CPF e senha. Cinco falhas seguidas bloqueiam o CPF por cinco minutos. */
export function login(db: Db, input: LoginInput): AuthUser {
  const data = loginSchema.parse(input)
  const row = db
    .prepare('SELECT id, senha_hash, tentativas_falhas, bloqueado_ate FROM usuarios WHERE cpf = ? AND ativo = 1')
    .get(data.cpf) as LoginRow | undefined
  if (!row) {
    verifySecret(data.password, DUMMY_HASH)
    throw invalidCredentials()
  }

  const now = new Date()
  if (row.bloqueado_ate && new Date(row.bloqueado_ate) > now) {
    const minutes = Math.max(1, Math.ceil((new Date(row.bloqueado_ate).getTime() - now.getTime()) / 60_000))
    throw new DomainError('CONTA_BLOQUEADA', `Muitas tentativas incorretas. Tente novamente em ${minutes} minuto(s).`)
  }

  if (!verifySecret(data.password, row.senha_hash)) {
    const failures = row.tentativas_falhas + 1
    const lockedUntil = failures >= MAX_FAILED_ATTEMPTS ? new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString() : null
    db.prepare('UPDATE usuarios SET tentativas_falhas = ?, bloqueado_ate = ? WHERE id = ?').run(
      lockedUntil ? 0 : failures,
      lockedUntil,
      row.id,
    )
    throw invalidCredentials()
  }

  db.prepare('UPDATE usuarios SET tentativas_falhas = 0, bloqueado_ate = NULL, ultimo_login_em = ? WHERE id = ?').run(
    now.toISOString(),
    row.id,
  )
  return getUser(db, row.id)
}

/** CPF + código de recuperação definem uma nova senha; um novo código é gerado e as sessões salvas são encerradas. */
export function recoverPassword(db: Db, input: RecoverInput): RecoverResult {
  const data = recoverSchema.parse(input)
  const invalid = () => new DomainError('RECUPERACAO_INVALIDA', 'CPF ou código de recuperação inválidos.')
  const row = db.prepare('SELECT id, codigo_recuperacao_hash AS hash FROM usuarios WHERE cpf = ? AND ativo = 1').get(data.cpf) as
    | { id: number; hash: string }
    | undefined
  if (!row) {
    verifySecret(data.recoveryCode, DUMMY_HASH)
    throw invalid()
  }
  if (!verifySecret(data.recoveryCode, row.hash)) throw invalid()

  const recoveryCode = generateRecoveryCode()
  const run = db.transaction(() => {
    db.prepare(
      `UPDATE usuarios SET senha_hash = ?, codigo_recuperacao_hash = ?, tentativas_falhas = 0, bloqueado_ate = NULL,
         atualizado_em = ? WHERE id = ?`,
    ).run(hashSecret(data.newPassword), hashSecret(normalizeCode(recoveryCode)), nowIso(), row.id)
    db.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(row.id)
  })
  run()
  return { recoveryCode }
}

export function changePassword(db: Db, userId: number, input: ChangePasswordInput): void {
  const data = changePasswordSchema.parse(input)
  const row = db.prepare('SELECT senha_hash AS hash FROM usuarios WHERE id = ? AND ativo = 1').get(userId) as { hash: string } | undefined
  if (!row) throw new DomainError('NAO_AUTENTICADO', 'Faça login para continuar.')
  if (!verifySecret(data.currentPassword, row.hash)) {
    throw new DomainError('SENHA_INCORRETA', 'Senha atual incorreta.', 'currentPassword')
  }
  db.prepare('UPDATE usuarios SET senha_hash = ?, atualizado_em = ? WHERE id = ?').run(hashSecret(data.newPassword), nowIso(), userId)
}

export function updateProfile(db: Db, userId: number, input: ProfileInput): AuthUser {
  const data = profileSchema.parse(input)
  getUser(db, userId)
  try {
    db.prepare('UPDATE usuarios SET nome = ?, email = ?, celular = ?, atualizado_em = ? WHERE id = ?').run(
      data.name,
      data.email,
      data.phone,
      nowIso(),
      userId,
    )
  } catch (error) {
    throw mapUniqueViolation(error) ?? error
  }
  return getUser(db, userId)
}

// ---------- Sessões ("Manter conectado") ----------

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

/** Cria uma sessão de 30 dias e devolve o token bruto; só o hash fica no banco. */
export function createSession(db: Db, userId: number): string {
  const token = randomBytes(32).toString('base64url')
  const now = new Date()
  db.prepare('DELETE FROM sessoes WHERE expira_em <= ?').run(now.toISOString())
  db.prepare('INSERT INTO sessoes (usuario_id, token_hash, expira_em, criado_em) VALUES (?, ?, ?, ?)').run(
    userId,
    hashToken(token),
    new Date(now.getTime() + SESSION_DAYS * 86_400_000).toISOString(),
    now.toISOString(),
  )
  return token
}

/** Usuário dono do token, ou null se o token for desconhecido, expirado ou de conta inativa. */
export function resumeSession(db: Db, token: string): AuthUser | null {
  const row = db
    .prepare('SELECT usuario_id AS userId FROM sessoes WHERE token_hash = ? AND expira_em > ?')
    .get(hashToken(token), nowIso()) as { userId: number } | undefined
  if (!row) return null
  try {
    return getUser(db, row.userId)
  } catch {
    return null
  }
}

export function endSession(db: Db, token: string): void {
  db.prepare('DELETE FROM sessoes WHERE token_hash = ?').run(hashToken(token))
}

/** Encerra todas as sessões salvas do usuário (usado no logout). */
export function endUserSessions(db: Db, userId: number): void {
  db.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(userId)
}
