import type { MotoristaApi } from '@shared/api'
import { idInputSchema, loginSchema, noInputSchema } from '@shared/schemas'
import type { ExportResult } from '@shared/types'
import type { Db } from '../services/common'
import { createBackup } from '../database/backup'
import {
  changePassword,
  createSession,
  endSession,
  endUserSessions,
  getUser,
  login,
  recoverPassword,
  registerUser,
  resumeSession,
  updateProfile,
} from '../services/auth'
import { exportToCsv } from '../services/csv'
import { getDashboard } from '../services/dashboard'
import { DomainError } from '../services/errors'
import { createExpense, deleteExpense, listExpenses, updateExpense } from '../services/expenses'
import { createGoal, deleteGoal, listGoalProgress, listGoals, updateGoal } from '../services/goals'
import { createPlatform, deletePlatform, listPlatforms, updatePlatform } from '../services/platforms'
import { createRefueling, deleteRefueling, listRefuelings, updateRefueling } from '../services/refuelings'
import { generateReport } from '../services/reports'
import { getSettings, saveSetting } from '../services/settings'
import { deleteShift, endShift, getShift, listShifts, startShift, updateShift } from '../services/shifts'
import { createTrip, deleteTrip, listTrips, updateTrip } from '../services/trips'
import { createVehicle, deleteVehicle, listVehicles, updateVehicle } from '../services/vehicles'

/** Guarda o token de "Manter conectado" fora do banco (no aplicativo, cifrado com o cofre do sistema). */
export interface SessionStore {
  save(token: string): void
  load(): string | null
  clear(): void
}

/** Dependências do sistema operacional injetadas pelo processo principal (facilita testes). */
export interface HandlerContext {
  db: Db
  version: string
  databasePath: string
  backupsPath: string
  sessionStore: SessionStore
  /** Pede ao usuário onde salvar e grava o arquivo; retorna cancelado se ele desistir. */
  saveFile(fileName: string, content: string): Promise<ExportResult>
}

type Handlers = {
  [G in keyof MotoristaApi]: { [M in keyof MotoristaApi[G]]: (input: unknown) => unknown }
}

// Os serviços validam a própria entrada com Zod; aqui só os casts de tipo e os ids são verificados.
export function createHandlers(ctx: HandlerContext): Handlers {
  const { db } = ctx
  const idOf = (input: unknown) => idInputSchema.parse(input).id
  const none = (input: unknown) => noInputSchema.parse(input)
  type In<F> = F extends (db: Db, userId: number, input: infer I) => unknown ? I : never

  // O usuário logado vive só aqui, no processo principal; o renderer nunca informa o userId.
  let currentUserId: number | null = null
  const requireUser = (): number => {
    if (currentUserId === null) throw new DomainError('NAO_AUTENTICADO', 'Faça login para continuar.')
    return currentUserId
  }
  /** Envolve um handler que só funciona com usuário logado. */
  const authed =
    (fn: (userId: number, input: unknown) => unknown) =>
    (input: unknown): unknown =>
      fn(requireUser(), input)

  /** Descarta o token salvo de "Manter conectado" (arquivo e banco). */
  const dropStoredSession = () => {
    const token = ctx.sessionStore.load()
    if (token) endSession(db, token)
    ctx.sessionStore.clear()
  }

  return {
    auth: {
      register: (i) => ({ recoveryCode: registerUser(db, i as Parameters<typeof registerUser>[1]).recoveryCode }),
      login: (i) => {
        const user = login(db, i as Parameters<typeof login>[1])
        dropStoredSession()
        currentUserId = user.id
        if (loginSchema.parse(i).keepSignedIn) ctx.sessionStore.save(createSession(db, user.id))
        return user
      },
      recover: (i) => recoverPassword(db, i as Parameters<typeof recoverPassword>[1]),
      logout: (i) => {
        none(i)
        dropStoredSession()
        if (currentUserId !== null) endUserSessions(db, currentUserId)
        currentUserId = null
        return null
      },
      session: (i) => {
        none(i)
        if (currentUserId === null) {
          const token = ctx.sessionStore.load()
          const user = token ? resumeSession(db, token) : null
          if (user) currentUserId = user.id
          else if (token) ctx.sessionStore.clear()
        }
        return currentUserId === null ? null : getUser(db, currentUserId)
      },
      updateProfile: authed((uid, i) => updateProfile(db, uid, i as In<typeof updateProfile>)),
      changePassword: authed((uid, i) => (changePassword(db, uid, i as In<typeof changePassword>), null)),
    },
    vehicles: {
      list: authed((uid, i) => (none(i), listVehicles(db, uid))),
      create: authed((uid, i) => createVehicle(db, uid, i as In<typeof createVehicle>)),
      update: authed((uid, i) => updateVehicle(db, uid, i as In<typeof updateVehicle>)),
      remove: authed((uid, i) => (deleteVehicle(db, uid, idOf(i)), null)),
    },
    platforms: {
      list: authed((uid, i) => (none(i), listPlatforms(db, uid))),
      create: authed((uid, i) => createPlatform(db, uid, i as In<typeof createPlatform>)),
      update: authed((uid, i) => updatePlatform(db, uid, i as In<typeof updatePlatform>)),
      remove: authed((uid, i) => (deletePlatform(db, uid, idOf(i)), null)),
    },
    shifts: {
      list: authed((uid, i) => (none(i), listShifts(db, uid))),
      get: authed((uid, i) => getShift(db, uid, idOf(i))),
      start: authed((uid, i) => startShift(db, uid, i as In<typeof startShift>)),
      end: authed((uid, i) => endShift(db, uid, i as In<typeof endShift>)),
      update: authed((uid, i) => updateShift(db, uid, i as In<typeof updateShift>)),
      remove: authed((uid, i) => (deleteShift(db, uid, idOf(i)), null)),
    },
    trips: {
      list: authed((uid, i) => listTrips(db, uid, i as In<typeof listTrips>)),
      create: authed((uid, i) => createTrip(db, uid, i as In<typeof createTrip>)),
      update: authed((uid, i) => updateTrip(db, uid, i as In<typeof updateTrip>)),
      remove: authed((uid, i) => (deleteTrip(db, uid, idOf(i)), null)),
    },
    refuelings: {
      list: authed((uid, i) => listRefuelings(db, uid, i as In<typeof listRefuelings>)),
      create: authed((uid, i) => createRefueling(db, uid, i as In<typeof createRefueling>)),
      update: authed((uid, i) => updateRefueling(db, uid, i as In<typeof updateRefueling>)),
      remove: authed((uid, i) => (deleteRefueling(db, uid, idOf(i)), null)),
    },
    expenses: {
      list: authed((uid, i) => listExpenses(db, uid, i as In<typeof listExpenses>)),
      create: authed((uid, i) => createExpense(db, uid, i as In<typeof createExpense>)),
      update: authed((uid, i) => updateExpense(db, uid, i as In<typeof updateExpense>)),
      remove: authed((uid, i) => (deleteExpense(db, uid, idOf(i)), null)),
    },
    goals: {
      list: authed((uid, i) => (none(i), listGoals(db, uid))),
      progress: authed((uid, i) => (none(i), listGoalProgress(db, uid))),
      create: authed((uid, i) => createGoal(db, uid, i as In<typeof createGoal>)),
      update: authed((uid, i) => updateGoal(db, uid, i as In<typeof updateGoal>)),
      remove: authed((uid, i) => (deleteGoal(db, uid, idOf(i)), null)),
    },
    dashboard: {
      get: authed((uid, i) => getDashboard(db, uid, i as In<typeof getDashboard>)),
    },
    reports: {
      generate: authed((uid, i) => generateReport(db, uid, i as In<typeof generateReport>)),
      exportCsv: authed((uid, i) => {
        const { fileName, content } = exportToCsv(db, uid, i as In<typeof exportToCsv>)
        return ctx.saveFile(fileName, content)
      }),
    },
    settings: {
      get: authed((uid, i) => (none(i), getSettings(db, uid))),
      save: authed((uid, i) => saveSetting(db, uid, i as In<typeof saveSetting>)),
      appInfo: authed((_uid, i) => (none(i), { version: ctx.version, databasePath: ctx.databasePath, backupsPath: ctx.backupsPath })),
      backup: authed((_uid, i) => (none(i), { path: createBackup(db, ctx.backupsPath, 'manual') })),
    },
  }
}
