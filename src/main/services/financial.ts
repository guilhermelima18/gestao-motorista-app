// Cálculos financeiros puros (valores em centavos). Fórmulas documentadas em docs/indicadores.md.
import { roundCents } from '@shared/money'

export interface TripFacts {
  fareAmount: number
  tip: number
  extras: number
  distanceKm: number
  deadheadKm: number
}

export interface ShiftFacts {
  startedAt: string
  endedAt: string | null
  startOdometer: number
  endOdometer: number | null
}

export interface RefuelingFacts {
  refueledAt: string
  liters: number
  /** Em centavos por litro. */
  pricePerLiter: number
  totalAmount: number
  odometer: number
  fullTank: boolean
}

/** Receita total de uma corrida: valor + gorjeta + adicionais. */
export function tripRevenue(trip: Pick<TripFacts, 'fareAmount' | 'tip' | 'extras'>): number {
  return trip.fareAmount + trip.tip + trip.extras
}

export function grossRevenue(trips: Pick<TripFacts, 'fareAmount' | 'tip' | 'extras'>[]): number {
  return trips.reduce((sum, t) => sum + tripRevenue(t), 0)
}

/** Horas de uma jornada encerrada; jornadas abertas não contam. */
export function shiftHours(shift: Pick<ShiftFacts, 'startedAt' | 'endedAt'>): number {
  if (!shift.endedAt) return 0
  const ms = new Date(shift.endedAt).getTime() - new Date(shift.startedAt).getTime()
  return ms > 0 ? ms / 3_600_000 : 0
}

export function totalHours(shifts: Pick<ShiftFacts, 'startedAt' | 'endedAt'>[]): number {
  return shifts.reduce((sum, s) => sum + shiftHours(s), 0)
}

/** Quilômetros de uma jornada encerrada (final - inicial). */
export function shiftKm(shift: Pick<ShiftFacts, 'startOdometer' | 'endOdometer'>): number {
  if (shift.endOdometer === null) return 0
  return Math.max(0, shift.endOdometer - shift.startOdometer)
}

export function totalKm(shifts: Pick<ShiftFacts, 'startOdometer' | 'endOdometer'>[]): number {
  return shifts.reduce((sum, s) => sum + shiftKm(s), 0)
}

/** Receita por hora em centavos; null sem horas (evita divisão por zero). */
export function revenuePerHour(revenue: number, hours: number): number | null {
  if (!(hours > 0)) return null
  return roundCents(revenue / hours)
}

/** Receita por km em centavos; null quando a quilometragem é desconhecida ou zero. */
export function revenuePerKm(revenue: number, km: number): number | null {
  if (!(km > 0)) return null
  return roundCents(revenue / km)
}

/**
 * Deslocamento total atribuído às corridas: distância + quilometragem vazia.
 * É uma métrica própria e NÃO deve ser somada à quilometragem da jornada (risco de dupla contagem).
 */
export function attributedDistance(trips: Pick<TripFacts, 'distanceKm' | 'deadheadKm'>[]): number {
  return trips.reduce((sum, t) => sum + t.distanceKm + t.deadheadKm, 0)
}

/**
 * Resultado de caixa: receitas menos despesas e abastecimentos lançados no período.
 * Aproximação: o sistema não registra o estado de pagamento das despesas.
 */
export function cashResult(revenue: number, expenses: number, refuelings: number): number {
  return revenue - expenses - refuelings
}

export interface Consumption {
  kmPerLiter: number
  km: number
  liters: number
}

/**
 * Consumo médio de UM veículo, calculado apenas entre abastecimentos de tanque completo consecutivos.
 * Os litros dos abastecimentos parciais intermediários entram na conta do segmento; o primeiro
 * abastecimento completo só serve de marco inicial. Retorna null sem dados comparáveis.
 */
export function averageConsumption(refuelings: RefuelingFacts[]): Consumption | null {
  const sorted = [...refuelings].sort((a, b) => a.odometer - b.odometer || a.refueledAt.localeCompare(b.refueledAt))
  let km = 0
  let liters = 0
  let anchor = -1
  sorted.forEach((current, index) => {
    if (!current.fullTank) return
    if (anchor >= 0) {
      const previous = sorted[anchor]!
      const segmentKm = current.odometer - previous.odometer
      if (segmentKm > 0) {
        km += segmentKm
        liters += sorted.slice(anchor + 1, index + 1).reduce((sum, r) => sum + r.liters, 0)
      }
    }
    anchor = index
  })
  if (km <= 0 || liters <= 0) return null
  return { kmPerLiter: km / liters, km, liters }
}

/** Preço médio por litro (centavos), ponderado pelos litros; null sem abastecimentos. */
export function averagePricePerLiter(refuelings: Pick<RefuelingFacts, 'liters' | 'totalAmount'>[]): number | null {
  const liters = refuelings.reduce((sum, r) => sum + r.liters, 0)
  if (!(liters > 0)) return null
  return roundCents(refuelings.reduce((sum, r) => sum + r.totalAmount, 0) / liters)
}

/** Combustível consumido estimado (centavos) para `km` rodados. */
export function estimateFuelCost(km: number, kmPerLiter: number, pricePerLiter: number): number {
  return roundCents((km / kmPerLiter) * pricePerLiter)
}

export interface OperatingProfitInput {
  grossRevenue: number
  /** null quando o consumo não pôde ser estimado com segurança. */
  estimatedFuelCost: number | null
  operatingExpenses: number
}

export function operatingProfit(input: OperatingProfitInput): { profit: number; partial: boolean } {
  return {
    profit: input.grossRevenue - (input.estimatedFuelCost ?? 0) - input.operatingExpenses,
    partial: input.estimatedFuelCost === null,
  }
}

/** Custo por km (centavos): custos operacionais atribuídos ÷ quilometragem. */
export function costPerKm(costs: number, km: number): number | null {
  if (!(km > 0)) return null
  return roundCents(costs / km)
}

export interface GoalProgressResult {
  remaining: number
  ratio: number
  reached: boolean
}

export function goalProgress(target: number, achieved: number): GoalProgressResult {
  const ratio = target > 0 ? Math.min(1, Math.max(0, achieved / target)) : 0
  return { remaining: Math.max(0, target - achieved), ratio, reached: achieved >= target }
}
