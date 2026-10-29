import type {
  ChangePasswordInput,
  DashboardInput,
  EndShiftInput,
  ExpenseFilter,
  ExpenseInput,
  ExportInput,
  GoalInput,
  LoginInput,
  PlatformInput,
  ProfileInput,
  RecoverInput,
  RefuelingFilter,
  RefuelingInput,
  RegisterInput,
  ReportInput,
  SettingInput,
  StartShiftInput,
  UpdateShiftInput,
  TripFilter,
  TripInput,
  VehicleInput,
} from './schemas'
import type {
  AppInfo,
  AuthUser,
  BackupResult,
  DashboardData,
  Expense,
  ExportResult,
  Goal,
  GoalProgress,
  Platform,
  RecoverResult,
  Refueling,
  RegisterResult,
  ReportData,
  Result,
  Settings,
  Shift,
  Trip,
  TripList,
  Vehicle,
} from './types'

type R<T> = Promise<Result<T>>
type Id = { id: number }

/** Superfície completa exposta ao renderer em `window.api`. */
export interface MotoristaApi {
  /** Únicos canais que funcionam sem usuário logado. */
  auth: {
    register(data: RegisterInput): R<RegisterResult>
    login(data: LoginInput): R<AuthUser>
    recover(data: RecoverInput): R<RecoverResult>
    logout(): R<null>
    /** Usuário atual (retoma a sessão salva, se houver); null quando não há login. */
    session(): R<AuthUser | null>
    updateProfile(data: ProfileInput): R<AuthUser>
    changePassword(data: ChangePasswordInput): R<null>
  }
  vehicles: {
    list(): R<Vehicle[]>
    create(data: VehicleInput): R<Vehicle>
    update(data: VehicleInput & Id): R<Vehicle>
    remove(data: Id): R<null>
  }
  platforms: {
    list(): R<Platform[]>
    create(data: PlatformInput): R<Platform>
    update(data: PlatformInput & Id): R<Platform>
    remove(data: Id): R<null>
  }
  shifts: {
    list(): R<Shift[]>
    get(data: Id): R<Shift>
    start(data: StartShiftInput): R<Shift>
    end(data: EndShiftInput): R<Shift>
    update(data: UpdateShiftInput): R<Shift>
    remove(data: Id): R<null>
  }
  trips: {
    list(data: TripFilter): R<TripList>
    create(data: TripInput): R<Trip>
    update(data: TripInput & Id): R<Trip>
    remove(data: Id): R<null>
  }
  refuelings: {
    list(data: RefuelingFilter): R<Refueling[]>
    create(data: RefuelingInput): R<Refueling>
    update(data: RefuelingInput & Id): R<Refueling>
    remove(data: Id): R<null>
  }
  expenses: {
    list(data: ExpenseFilter): R<Expense[]>
    create(data: ExpenseInput): R<Expense>
    update(data: ExpenseInput & Id): R<Expense>
    remove(data: Id): R<null>
  }
  goals: {
    list(): R<Goal[]>
    progress(): R<GoalProgress[]>
    create(data: GoalInput): R<Goal>
    update(data: GoalInput & Id): R<Goal>
    remove(data: Id): R<null>
  }
  dashboard: {
    get(data: DashboardInput): R<DashboardData>
  }
  reports: {
    generate(data: ReportInput): R<ReportData>
    exportCsv(data: ExportInput): R<ExportResult>
  }
  settings: {
    get(): R<Settings>
    save(data: SettingInput): R<Settings>
    appInfo(): R<AppInfo>
    backup(): R<BackupResult>
  }
}

type Groups = keyof MotoristaApi

/** Lista de métodos IPC permitidos. Fonte única para o preload e para o registro dos handlers. */
export const API_METHODS: { [G in Groups]: ReadonlyArray<keyof MotoristaApi[G] & string> } = {
  auth: ['register', 'login', 'recover', 'logout', 'session', 'updateProfile', 'changePassword'],
  vehicles: ['list', 'create', 'update', 'remove'],
  platforms: ['list', 'create', 'update', 'remove'],
  shifts: ['list', 'get', 'start', 'end', 'update', 'remove'],
  trips: ['list', 'create', 'update', 'remove'],
  refuelings: ['list', 'create', 'update', 'remove'],
  expenses: ['list', 'create', 'update', 'remove'],
  goals: ['list', 'progress', 'create', 'update', 'remove'],
  dashboard: ['get'],
  reports: ['generate', 'exportCsv'],
  settings: ['get', 'save', 'appInfo', 'backup'],
}

export function channelName(group: string, method: string): string {
  return `${group}:${method}`
}
