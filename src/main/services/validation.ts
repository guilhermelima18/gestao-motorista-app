// Regras de negócio puras (sem acesso ao banco), fáceis de testar.
import { DomainError } from './errors'

export interface ShiftStartCheck {
  hasOpenShift: boolean
  /** Maior quilometragem já conhecida do veículo (cadastro, jornadas e abastecimentos). */
  lastKnownOdometer: number | null
  startOdometer: number
}

export function validateShiftStart(check: ShiftStartCheck): void {
  if (check.hasOpenShift) {
    throw new DomainError('JORNADA_ABERTA', 'Já existe uma jornada em andamento. Encerre-a antes de iniciar outra.')
  }
  if (check.lastKnownOdometer !== null && check.startOdometer < check.lastKnownOdometer) {
    throw new DomainError(
      'QUILOMETRAGEM_INVALIDA',
      `A quilometragem inicial não pode ser inferior à última conhecida do veículo (${check.lastKnownOdometer}).`,
      'startOdometer',
    )
  }
}

export interface ShiftEndCheck {
  startedAt: string
  endedAt: string
  startOdometer: number
  endOdometer: number
}

export function validateShiftEnd(check: ShiftEndCheck): void {
  if (new Date(check.endedAt).getTime() <= new Date(check.startedAt).getTime()) {
    throw new DomainError('DATA_INVALIDA', 'A data de término deve ser posterior à data de início.', 'endedAt')
  }
  if (check.endOdometer < check.startOdometer) {
    throw new DomainError(
      'QUILOMETRAGEM_INVALIDA',
      'A quilometragem final não pode ser inferior à inicial.',
      'endOdometer',
    )
  }
}

export interface ShiftEditCheck {
  isOpen: boolean
  startedAt: string
  endedAt: string | null
  startOdometer: number
  endOdometer: number | null
  /** Menor e maior data de corrida já lançada na jornada; null quando não há corridas. */
  firstTripAt: string | null
  lastTripAt: string | null
}

/** Regras da edição de uma jornada já criada (aberta ou encerrada). */
export function validateShiftEdit(check: ShiftEditCheck): void {
  if (check.isOpen) {
    if (check.endedAt !== null || check.endOdometer !== null) {
      throw new DomainError('JORNADA_ABERTA', 'Uma jornada em andamento não tem término nem quilometragem final. Encerre-a primeiro.', 'endedAt')
    }
  } else {
    if (check.endedAt === null) throw new DomainError('DATA_INVALIDA', 'Informe a data de término.', 'endedAt')
    if (check.endOdometer === null) throw new DomainError('QUILOMETRAGEM_INVALIDA', 'Informe a quilometragem final.', 'endOdometer')
    validateShiftEnd({
      startedAt: check.startedAt,
      endedAt: check.endedAt,
      startOdometer: check.startOdometer,
      endOdometer: check.endOdometer,
    })
  }
  const start = new Date(check.startedAt).getTime()
  const end = check.endedAt ? new Date(check.endedAt).getTime() : Number.POSITIVE_INFINITY
  if (check.firstTripAt && new Date(check.firstTripAt).getTime() < start) {
    throw new DomainError('DATA_INVALIDA', 'O início não pode ser posterior a corridas já lançadas nesta jornada.', 'startedAt')
  }
  if (check.lastTripAt && new Date(check.lastTripAt).getTime() > end) {
    throw new DomainError('DATA_INVALIDA', 'O término não pode ser anterior a corridas já lançadas nesta jornada.', 'endedAt')
  }
}

export interface TripCheck {
  occurredAt: string
  distanceKm: number
  durationMinutes: number
  totalRevenue: number
  notes: string | null
  shift: { startedAt: string; endedAt: string | null }
}

export function validateTrip(check: TripCheck): void {
  if (check.totalRevenue <= 0) {
    throw new DomainError('VALOR_INVALIDO', 'A receita da corrida deve ser maior que zero.', 'fareAmount')
  }
  // Distância zero só é aceita com justificativa nas observações (ex.: corrida cancelada com taxa).
  if (check.distanceKm === 0 && !check.notes) {
    throw new DomainError(
      'DISTANCIA_INVALIDA',
      'Distância zero exige uma justificativa nas observações (ex.: corrida cancelada com taxa).',
      'distanceKm',
    )
  }
  const time = new Date(check.occurredAt).getTime()
  const start = new Date(check.shift.startedAt).getTime()
  const end = check.shift.endedAt ? new Date(check.shift.endedAt).getTime() : Number.POSITIVE_INFINITY
  if (time < start || time > end) {
    throw new DomainError('DATA_INVALIDA', 'A data da corrida deve estar dentro do período da jornada.', 'occurredAt')
  }
}

export interface RefuelingCheck {
  vehicleId: number
  shiftVehicleId: number | null
}

export function validateRefueling(check: RefuelingCheck): void {
  if (check.shiftVehicleId !== null && check.shiftVehicleId !== check.vehicleId) {
    throw new DomainError('JORNADA_INVALIDA', 'A jornada selecionada pertence a outro veículo.', 'shiftId')
  }
}

export interface ExpenseCheck {
  vehicleId: number | null
  shiftVehicleId: number | null
}

export function validateExpense(check: ExpenseCheck): void {
  if (check.vehicleId !== null && check.shiftVehicleId !== null && check.vehicleId !== check.shiftVehicleId) {
    throw new DomainError('JORNADA_INVALIDA', 'A jornada selecionada pertence a outro veículo.', 'shiftId')
  }
}
