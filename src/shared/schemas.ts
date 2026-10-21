import { z } from 'zod'
import {
  DASHBOARD_PERIODS,
  EXPENSE_CATEGORIES,
  EXPENSE_KINDS,
  GOAL_PERIODS,
  GOAL_TYPES,
  THEMES,
} from './domain'

// Mensagens de validação exibidas ao usuário em português; identificadores em inglês.

const text = (max: number) => z.string().trim().max(max, `Máximo de ${max} caracteres`)
const requiredText = (max: number, label: string) =>
  z
    .string({ required_error: `${label} é obrigatório` })
    .trim()
    .min(1, `${label} é obrigatório`)
    .max(max, `Máximo de ${max} caracteres`)
const optionalText = (max: number) => text(max).nullish().transform((v) => (v ? v : null))

export const idSchema = z.number().int().positive()
const optionalId = z
  .number()
  .int()
  .positive()
  .nullish()
  .transform((v) => v ?? null)
const dateTime = (label: string) =>
  z
    .string({ required_error: `${label} é obrigatória` })
    .datetime({ offset: true, message: `${label} inválida` })
const cents = (label: string) =>
  z
    .number({ required_error: `${label} é obrigatório`, invalid_type_error: `${label} inválido` })
    .int(`${label} inválido`)
    .min(0, `${label} não pode ser negativo`)
const positiveCents = (label: string) =>
  cents(label).refine((v) => v > 0, `${label} deve ser maior que zero`)
const kilometers = (label: string) =>
  z
    .number({ required_error: `${label} é obrigatória`, invalid_type_error: `${label} inválida` })
    .min(0, `${label} não pode ser negativa`)
    .max(10_000_000, `${label} inválida`)
const selection = (message: string) =>
  z.number({ required_error: message, invalid_type_error: message }).int(message).positive(message)

export const idInputSchema = z.object({ id: idSchema })

// ---------- Vehicles ----------
export const vehicleSchema = z.object({
  name: requiredText(80, 'Nome'),
  brand: optionalText(60),
  model: optionalText(60),
  year: z
    .number({ invalid_type_error: 'Ano inválido' })
    .int('Ano inválido')
    .min(1950, 'Ano inválido')
    .max(2100, 'Ano inválido')
    .nullish()
    .transform((v) => v ?? null),
  plate: optionalText(10).transform((v) => (v ? v.toUpperCase() : null)),
  mainFuel: optionalText(30),
  currentOdometer: kilometers('Quilometragem')
    .nullish()
    .transform((v) => v ?? null),
  active: z.boolean().default(true),
})
export type VehicleInput = z.input<typeof vehicleSchema>
export const vehicleUpdateSchema = vehicleSchema.extend({ id: idSchema })

// ---------- Platforms ----------
export const platformSchema = z.object({
  name: requiredText(40, 'Nome'),
  active: z.boolean().default(true),
})
export type PlatformInput = z.input<typeof platformSchema>
export const platformUpdateSchema = platformSchema.extend({ id: idSchema })

// ---------- Shifts (jornadas) ----------
export const startShiftSchema = z.object({
  vehicleId: selection('Selecione o veículo'),
  startedAt: dateTime('Data de início').optional(),
  startOdometer: kilometers('Quilometragem inicial'),
  notes: optionalText(500),
})
export type StartShiftInput = z.input<typeof startShiftSchema>

export const endShiftSchema = z.object({
  id: idSchema,
  endedAt: dateTime('Data de término').optional(),
  endOdometer: kilometers('Quilometragem final'),
  notes: optionalText(500),
})
export type EndShiftInput = z.input<typeof endShiftSchema>

/** Edição completa: jornada aberta mantém término e km final vazios; encerrada exige os dois. */
export const updateShiftSchema = z.object({
  id: idSchema,
  startedAt: dateTime('Data de início'),
  endedAt: dateTime('Data de término').nullish().transform((v) => v ?? null),
  startOdometer: kilometers('Quilometragem inicial'),
  endOdometer: kilometers('Quilometragem final').nullish().transform((v) => v ?? null),
  notes: optionalText(500),
})
export type UpdateShiftInput = z.input<typeof updateShiftSchema>

// ---------- Trips (viagens) ----------
export const tripSchema = z.object({
  shiftId: selection('Selecione a jornada'),
  platformId: selection('Selecione a plataforma'),
  occurredAt: dateTime('Data da corrida'),
  origin: optionalText(120),
  destination: optionalText(120),
  fareAmount: cents('Valor da corrida'),
  tip: cents('Gorjeta').default(0),
  extras: cents('Adicionais').default(0),
  distanceKm: kilometers('Distância').default(0),
  durationMinutes: z
    .number({ invalid_type_error: 'Duração inválida' })
    .int('Duração inválida')
    .min(0, 'Duração não pode ser negativa')
    .max(24 * 60, 'Duração inválida')
    .default(0),
  deadheadKm: kilometers('Quilometragem vazia').default(0),
  notes: optionalText(500),
})
export type TripInput = z.input<typeof tripSchema>
export type TripData = z.output<typeof tripSchema>
export const tripUpdateSchema = tripSchema.extend({ id: idSchema })

const periodFilter = {
  from: dateTime('Data inicial').nullish(),
  to: dateTime('Data final').nullish(),
}
export const tripFilterSchema = z.object({
  ...periodFilter,
  platformId: optionalId,
  shiftId: optionalId,
})
export type TripFilter = z.input<typeof tripFilterSchema>

// ---------- Refuelings (abastecimentos) ----------
export const refuelingSchema = z.object({
  vehicleId: selection('Selecione o veículo'),
  shiftId: optionalId,
  refueledAt: dateTime('Data do abastecimento'),
  fuel: requiredText(30, 'Combustível'),
  liters: z
    .number({ required_error: 'Litros é obrigatório', invalid_type_error: 'Litros inválido' })
    .positive('Litros deve ser maior que zero')
    .max(2000, 'Litros inválido'),
  pricePerLiter: positiveCents('Preço por litro'),
  odometer: kilometers('Odômetro'),
  fullTank: z.boolean().default(false),
  station: optionalText(80),
  notes: optionalText(500),
})
export type RefuelingInput = z.input<typeof refuelingSchema>
export type RefuelingData = z.output<typeof refuelingSchema>
export const refuelingUpdateSchema = refuelingSchema.extend({ id: idSchema })

export const refuelingFilterSchema = z.object({ ...periodFilter, vehicleId: optionalId })
export type RefuelingFilter = z.input<typeof refuelingFilterSchema>

// ---------- Expenses (despesas) ----------
export const expenseSchema = z.object({
  vehicleId: optionalId,
  shiftId: optionalId,
  description: requiredText(120, 'Descrição'),
  category: z.enum(EXPENSE_CATEGORIES, { errorMap: () => ({ message: 'Categoria inválida' }) }),
  amount: positiveCents('Valor'),
  expenseDate: dateTime('Data da despesa'),
  kind: z.enum(EXPENSE_KINDS, { errorMap: () => ({ message: 'Tipo inválido' }) }).default('operacional'),
  notes: optionalText(500),
})
export type ExpenseInput = z.input<typeof expenseSchema>
export type ExpenseData = z.output<typeof expenseSchema>
export const expenseUpdateSchema = expenseSchema.extend({ id: idSchema })

export const expenseFilterSchema = z.object({
  ...periodFilter,
  category: z
    .enum(EXPENSE_CATEGORIES)
    .nullish()
    .transform((v) => v ?? null),
  vehicleId: optionalId,
})
export type ExpenseFilter = z.input<typeof expenseFilterSchema>

// ---------- Goals (metas) ----------
export const goalSchema = z.object({
  description: requiredText(80, 'Descrição'),
  type: z.enum(GOAL_TYPES, { errorMap: () => ({ message: 'Tipo inválido' }) }),
  period: z.enum(GOAL_PERIODS, { errorMap: () => ({ message: 'Periodicidade inválida' }) }),
  targetAmount: positiveCents('Valor objetivo'),
  active: z.boolean().default(true),
})
export type GoalInput = z.input<typeof goalSchema>
export const goalUpdateSchema = goalSchema.extend({ id: idSchema })

// ---------- Settings ----------
export const settingSchema = z.discriminatedUnion('key', [
  z.object({ key: z.literal('tema'), value: z.enum(THEMES) }),
  z.object({ key: z.literal('veiculo_padrao_id'), value: z.string().regex(/^\d*$/) }),
])
export type SettingInput = z.input<typeof settingSchema>

// ---------- Dashboard, reports and export ----------
export const dashboardSchema = z.object({
  period: z.enum(DASHBOARD_PERIODS),
  reference: dateTime('Referência').optional(),
})
export type DashboardInput = z.input<typeof dashboardSchema>

export const reportSchema = z.object({
  from: dateTime('Data inicial'),
  to: dateTime('Data final'),
})
export type ReportInput = z.input<typeof reportSchema>

export const exportSchema = z.object({
  entity: z.enum(['trips', 'shifts', 'refuelings', 'expenses', 'report']),
  from: dateTime('Data inicial').nullish(),
  to: dateTime('Data final').nullish(),
})
export type ExportInput = z.input<typeof exportSchema>

export const noInputSchema = z
  .undefined()
  .or(z.null())
  .transform(() => undefined)
