import type { MotoristaApi } from '@shared/api'
import { idInputSchema, noInputSchema } from '@shared/schemas'
import type { ExportResult } from '@shared/types'
import type { Db } from '../services/common'
import { createBackup } from '../database/backup'
import { exportToCsv } from '../services/csv'
import { getDashboard } from '../services/dashboard'
import { createExpense, deleteExpense, listExpenses, updateExpense } from '../services/expenses'
import { createGoal, deleteGoal, listGoalProgress, listGoals, updateGoal } from '../services/goals'
import { createPlatform, deletePlatform, listPlatforms, updatePlatform } from '../services/platforms'
import { createRefueling, deleteRefueling, listRefuelings, updateRefueling } from '../services/refuelings'
import { generateReport } from '../services/reports'
import { getSettings, saveSetting } from '../services/settings'
import { deleteShift, endShift, getShift, listShifts, startShift, updateShift } from '../services/shifts'
import { createTrip, deleteTrip, listTrips, updateTrip } from '../services/trips'
import { createVehicle, deleteVehicle, listVehicles, updateVehicle } from '../services/vehicles'

/** Dependências do sistema operacional injetadas pelo processo principal (facilita testes). */
export interface HandlerContext {
  db: Db
  version: string
  databasePath: string
  backupsPath: string
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
  type In<F> = F extends (db: Db, input: infer I) => unknown ? I : never

  return {
    vehicles: {
      list: (i) => (none(i), listVehicles(db)),
      create: (i) => createVehicle(db, i as In<typeof createVehicle>),
      update: (i) => updateVehicle(db, i as In<typeof updateVehicle>),
      remove: (i) => (deleteVehicle(db, idOf(i)), null),
    },
    platforms: {
      list: (i) => (none(i), listPlatforms(db)),
      create: (i) => createPlatform(db, i as In<typeof createPlatform>),
      update: (i) => updatePlatform(db, i as In<typeof updatePlatform>),
      remove: (i) => (deletePlatform(db, idOf(i)), null),
    },
    shifts: {
      list: (i) => (none(i), listShifts(db)),
      get: (i) => getShift(db, idOf(i)),
      start: (i) => startShift(db, i as In<typeof startShift>),
      end: (i) => endShift(db, i as In<typeof endShift>),
      update: (i) => updateShift(db, i as In<typeof updateShift>),
      remove: (i) => (deleteShift(db, idOf(i)), null),
    },
    trips: {
      list: (i) => listTrips(db, i as In<typeof listTrips>),
      create: (i) => createTrip(db, i as In<typeof createTrip>),
      update: (i) => updateTrip(db, i as In<typeof updateTrip>),
      remove: (i) => (deleteTrip(db, idOf(i)), null),
    },
    refuelings: {
      list: (i) => listRefuelings(db, i as In<typeof listRefuelings>),
      create: (i) => createRefueling(db, i as In<typeof createRefueling>),
      update: (i) => updateRefueling(db, i as In<typeof updateRefueling>),
      remove: (i) => (deleteRefueling(db, idOf(i)), null),
    },
    expenses: {
      list: (i) => listExpenses(db, i as In<typeof listExpenses>),
      create: (i) => createExpense(db, i as In<typeof createExpense>),
      update: (i) => updateExpense(db, i as In<typeof updateExpense>),
      remove: (i) => (deleteExpense(db, idOf(i)), null),
    },
    goals: {
      list: (i) => (none(i), listGoals(db)),
      progress: (i) => (none(i), listGoalProgress(db)),
      create: (i) => createGoal(db, i as In<typeof createGoal>),
      update: (i) => updateGoal(db, i as In<typeof updateGoal>),
      remove: (i) => (deleteGoal(db, idOf(i)), null),
    },
    dashboard: {
      get: (i) => getDashboard(db, i as In<typeof getDashboard>),
    },
    reports: {
      generate: (i) => generateReport(db, i as In<typeof generateReport>),
      exportCsv: (i) => {
        const { fileName, content } = exportToCsv(db, i as In<typeof exportToCsv>)
        return ctx.saveFile(fileName, content)
      },
    },
    settings: {
      get: (i) => (none(i), getSettings(db)),
      save: (i) => saveSetting(db, i as In<typeof saveSetting>),
      appInfo: (i) => (none(i), { version: ctx.version, databasePath: ctx.databasePath, backupsPath: ctx.backupsPath }),
      backup: (i) => (none(i), { path: createBackup(db, ctx.backupsPath, 'manual') }),
    },
  }
}
