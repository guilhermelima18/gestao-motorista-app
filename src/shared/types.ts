import type {
  DashboardPeriod,
  ExpenseCategory,
  ExpenseKind,
  GoalPeriod,
  GoalType,
  Theme,
} from './domain'

// Os DTOs de domínio usam camelCase em inglês. As colunas do banco continuam em português (snake_case) e são mapeadas nos repositórios.

export interface Vehicle {
  id: number
  name: string
  brand: string | null
  model: string | null
  year: number | null
  plate: string | null
  mainFuel: string | null
  currentOdometer: number | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface Platform {
  id: number
  name: string
  active: boolean
  createdAt: string
}

export interface Shift {
  id: number
  vehicleId: number
  vehicleName: string
  startedAt: string
  endedAt: string | null
  startOdometer: number
  endOdometer: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
  /** Distância percorrida (final - inicial); null enquanto a jornada estiver aberta. */
  distanceKm: number | null
  /** Faturamento bruto das viagens vinculadas, em centavos. */
  revenue: number
  tripCount: number
}

export interface Trip {
  id: number
  shiftId: number
  platformId: number
  platformName: string
  occurredAt: string
  origin: string | null
  destination: string | null
  fareAmount: number
  tip: number
  extras: number
  distanceKm: number
  durationMinutes: number
  deadheadKm: number
  notes: string | null
  createdAt: string
  updatedAt: string
  /** fareAmount + tip + extras */
  totalRevenue: number
}

export interface Refueling {
  id: number
  vehicleId: number
  vehicleName: string
  shiftId: number | null
  refueledAt: string
  fuel: string
  liters: number
  pricePerLiter: number
  totalAmount: number
  odometer: number
  fullTank: boolean
  station: string | null
  notes: string | null
  createdAt: string
}

export interface Expense {
  id: number
  vehicleId: number | null
  vehicleName: string | null
  shiftId: number | null
  description: string
  category: ExpenseCategory
  amount: number
  expenseDate: string
  kind: ExpenseKind
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface Goal {
  id: number
  description: string
  type: GoalType
  period: GoalPeriod
  targetAmount: number
  /** yyyy-MM-dd: o período da meta é o dia, a semana ou o mês que contém esta data. */
  referenceDate: string
  active: boolean
  createdAt: string
  updatedAt: string
}

/** Em relação a agora: período em andamento, já encerrado (histórico) ou ainda por vir. */
export type GoalPhase = 'current' | 'past' | 'future'

export interface GoalProgress {
  goal: Goal
  phase: GoalPhase
  achieved: number
  remaining: number
  /** De 0 a 1 (limitado em 1). */
  ratio: number
  reached: boolean
  /** Verdadeiro quando a meta é de lucro e o lucro calculado é parcial. */
  partial: boolean
  periodStart: string
  periodEnd: string
}

export interface Settings {
  theme: Theme
  defaultVehicleId: number | null
}

// ---------- Indicadores ----------

export interface UnconsideredCost {
  item: string
  reason: string
  /** Valor conhecido, em centavos, quando disponível. */
  amount?: number
}

export interface Summary {
  periodStart: string
  periodEnd: string
  grossRevenue: number
  tripCount: number
  totalExpenses: number
  totalRefuelings: number
  cashResult: number
  kmDriven: number
  hoursWorked: number
  closedShifts: number
  revenuePerHour: number | null
  revenuePerKm: number | null
  attributedDistanceKm: number
  estimatedFuelCost: number | null
  operatingExpenses: number
  operatingProfit: number | null
  profitIsPartial: boolean
  unconsideredCosts: UnconsideredCost[]
  costPerKm: number | null
}

export interface DailyPoint {
  /** yyyy-MM-dd (data local). */
  day: string
  revenue: number
  expenses: number
}

export interface DashboardData {
  period: DashboardPeriod
  summary: Summary
  todayRevenue: number
  weekRevenue: number
  monthRevenue: number
  series: DailyPoint[]
  goals: GoalProgress[]
  openShift: Shift | null
  hasRecords: boolean
}

export interface PlatformRow {
  platform: string
  trips: number
  revenue: number
  distanceKm: number
  revenuePerKm: number | null
}

export interface CategoryRow {
  category: string
  total: number
}

export interface ReportData {
  summary: Summary
  series: DailyPoint[]
  platforms: PlatformRow[]
  expensesByCategory: CategoryRow[]
}

export interface TripTotals {
  tripCount: number
  totalRevenue: number
}

export interface TripList {
  items: Trip[]
  totals: TripTotals
}

// ---------- Autenticação ----------

export interface AuthUser {
  id: number
  name: string
  /** Somente dígitos. */
  cpf: string
  email: string
  phone: string | null
  createdAt: string
}

export interface RegisterResult {
  /** Mostrado uma única vez; só o hash fica guardado. */
  recoveryCode: string
}

export interface RecoverResult {
  /** Novo código, também mostrado uma única vez. */
  recoveryCode: string
}

// ---------- Contrato IPC ----------

export interface ApiError {
  code: string
  message: string
  field?: string
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: ApiError }

export interface ExportResult {
  cancelled: boolean
  path?: string
}

export interface AppInfo {
  version: string
  databasePath: string
  backupsPath: string
}

export interface BackupResult {
  path: string
}
