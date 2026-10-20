import type { DailyPoint, Summary, UnconsideredCost } from '@shared/types'
import type { Db } from './common'
import {
  attributedDistance,
  averageConsumption,
  averagePricePerLiter,
  cashResult,
  costPerKm,
  estimateFuelCost,
  grossRevenue,
  operatingProfit,
  revenuePerHour,
  revenuePerKm,
  totalHours,
  totalKm,
  type RefuelingFacts,
  type ShiftFacts,
  type TripFacts,
} from './financial'
import { dayKey, daysInRange } from './periods'

interface ShiftRow extends ShiftFacts {
  vehicleId: number
  id: number
}

/**
 * Consolida os indicadores do período [start, end).
 * - Faturamento, despesas e abastecimentos usam a data do próprio lançamento.
 * - Horas, km e as taxas por hora/km usam as jornadas ENCERRADAS que começaram no período, e a receita
 *   dessas mesmas jornadas, para não misturar receita de jornada aberta com horas ainda não fechadas.
 */
export function buildSummary(db: Db, start: Date, end: Date): Summary {
  const from = start.toISOString()
  const to = end.toISOString()

  const trips = db
    .prepare(
      `SELECT valor_corrida AS fareAmount, gorjeta AS tip, adicionais AS extras, distancia_km AS distanceKm,
         quilometragem_vazia_km AS deadheadKm FROM viagens WHERE realizada_em >= ? AND realizada_em < ?`,
    )
    .all(from, to) as TripFacts[]
  const revenue = grossRevenue(trips)

  const closedShifts = db
    .prepare(
      `SELECT id, veiculo_id AS vehicleId, inicio_em AS startedAt, fim_em AS endedAt,
         quilometragem_inicial AS startOdometer, quilometragem_final AS endOdometer
       FROM jornadas WHERE inicio_em >= ? AND inicio_em < ? AND fim_em IS NOT NULL`,
    )
    .all(from, to) as ShiftRow[]
  const kmDriven = totalKm(closedShifts)
  const hoursWorked = totalHours(closedShifts)
  const closedShiftsRevenue = (
    db
      .prepare(
        `SELECT COALESCE(SUM(t.valor_corrida + t.gorjeta + t.adicionais), 0) AS total
         FROM viagens t JOIN jornadas j ON j.id = t.jornada_id
         WHERE j.inicio_em >= ? AND j.inicio_em < ? AND j.fim_em IS NOT NULL`,
      )
      .get(from, to) as { total: number }
  ).total

  const expenseRows = db
    .prepare(
      `SELECT categoria AS category, tipo AS kind, COALESCE(SUM(valor), 0) AS total FROM despesas
       WHERE data_despesa >= ? AND data_despesa < ? GROUP BY categoria, tipo`,
    )
    .all(from, to) as { category: string; kind: string; total: number }[]
  const totalExpenses = expenseRows.reduce((sum, r) => sum + r.total, 0)
  // Financiamento é fluxo de caixa, não custo operacional; despesas fixas ficam fora do lucro operacional.
  const isOperating = (r: { category: string; kind: string }) => r.kind === 'operacional' && r.category !== 'Financiamento'
  const operatingExpenses = expenseRows.filter(isOperating).reduce((sum, r) => sum + r.total, 0)
  const financing = expenseRows.filter((r) => r.category === 'Financiamento').reduce((sum, r) => sum + r.total, 0)
  const fixedOther = expenseRows
    .filter((r) => r.kind === 'fixa' && r.category !== 'Financiamento')
    .reduce((sum, r) => sum + r.total, 0)

  const totalRefuelings = (
    db
      .prepare('SELECT COALESCE(SUM(valor_total), 0) AS total FROM abastecimentos WHERE abastecido_em >= ? AND abastecido_em < ?')
      .get(from, to) as { total: number }
  ).total

  // Combustível consumido estimado, por veículo, usando todo o histórico de abastecimentos até o fim do período.
  const kmByVehicle = new Map<number, number>()
  for (const s of closedShifts) kmByVehicle.set(s.vehicleId, (kmByVehicle.get(s.vehicleId) ?? 0) + (totalKm([s]) || 0))
  let estimatedFuel = 0
  let fuelKnownKm = 0
  let fuelUnknownKm = 0
  const refuelingsStatement = db.prepare(
    `SELECT abastecido_em AS refueledAt, litros AS liters, preco_por_litro AS pricePerLiter, valor_total AS totalAmount,
       quilometragem AS odometer, tanque_completo AS fullTank FROM abastecimentos WHERE veiculo_id = ? AND abastecido_em < ?`,
  )
  for (const [vehicleId, km] of kmByVehicle) {
    if (km <= 0) continue
    const history = (refuelingsStatement.all(vehicleId, to) as (Omit<RefuelingFacts, 'fullTank'> & { fullTank: number })[]).map(
      (r) => ({ ...r, fullTank: r.fullTank === 1 }),
    )
    const consumption = averageConsumption(history)
    const price = averagePricePerLiter(history)
    if (consumption && price !== null) {
      estimatedFuel += estimateFuelCost(km, consumption.kmPerLiter, price)
      fuelKnownKm += km
    } else {
      fuelUnknownKm += km
    }
  }

  const unconsidered: UnconsideredCost[] = []
  let estimatedFuelCost: number | null = estimatedFuel
  if (fuelUnknownKm > 0) {
    estimatedFuelCost = fuelKnownKm > 0 ? estimatedFuel : null
    unconsidered.push({
      item: 'Combustível consumido',
      reason:
        'Não há abastecimentos de tanque completo suficientes para estimar o consumo médio' +
        (fuelKnownKm > 0 ? ' de parte dos veículos.' : '.'),
      ...(totalRefuelings > 0 ? { amount: totalRefuelings } : {}),
    })
  }
  if (fixedOther > 0) {
    unconsidered.push({ item: 'Despesas fixas', reason: 'Custos fixos não são rateados por período.', amount: fixedOther })
  }
  if (financing > 0) {
    unconsidered.push({ item: 'Financiamento', reason: 'Tratado como fluxo de caixa, não como custo operacional.', amount: financing })
  }

  const { profit, partial } = operatingProfit({ grossRevenue: revenue, estimatedFuelCost, operatingExpenses })
  // Custos fixos e financiamento ficam listados, mas só a falta de estimativa de combustível torna o lucro parcial.
  const profitPartial = partial || fuelUnknownKm > 0
  const operatingCosts = (estimatedFuelCost ?? 0) + operatingExpenses

  return {
    periodStart: from,
    periodEnd: to,
    grossRevenue: revenue,
    tripCount: trips.length,
    totalExpenses,
    totalRefuelings,
    cashResult: cashResult(revenue, totalExpenses, totalRefuelings),
    kmDriven,
    hoursWorked,
    closedShifts: closedShifts.length,
    revenuePerHour: revenuePerHour(closedShiftsRevenue, hoursWorked),
    revenuePerKm: revenuePerKm(closedShiftsRevenue, kmDriven),
    attributedDistanceKm: attributedDistance(trips),
    estimatedFuelCost,
    operatingExpenses,
    operatingProfit: trips.length === 0 && operatingExpenses === 0 && kmDriven === 0 ? null : profit,
    profitIsPartial: profitPartial,
    unconsideredCosts: unconsidered,
    costPerKm: costPerKm(operatingCosts, kmDriven),
  }
}

/** Série diária de faturamento e despesas (despesas + abastecimentos) para os gráficos. */
export function buildDailySeries(db: Db, start: Date, end: Date): DailyPoint[] {
  const from = start.toISOString()
  const to = end.toISOString()
  const points = new Map<string, DailyPoint>(daysInRange(start, end).map((day) => [day, { day, revenue: 0, expenses: 0 }]))

  const add = (rows: { at: string; amount: number }[], field: 'revenue' | 'expenses') => {
    for (const row of rows) {
      const point = points.get(dayKey(new Date(row.at)))
      if (point) point[field] += row.amount
    }
  }
  add(
    db
      .prepare('SELECT realizada_em AS at, valor_corrida + gorjeta + adicionais AS amount FROM viagens WHERE realizada_em >= ? AND realizada_em < ?')
      .all(from, to) as { at: string; amount: number }[],
    'revenue',
  )
  add(
    db.prepare('SELECT data_despesa AS at, valor AS amount FROM despesas WHERE data_despesa >= ? AND data_despesa < ?').all(from, to) as {
      at: string
      amount: number
    }[],
    'expenses',
  )
  add(
    db
      .prepare('SELECT abastecido_em AS at, valor_total AS amount FROM abastecimentos WHERE abastecido_em >= ? AND abastecido_em < ?')
      .all(from, to) as { at: string; amount: number }[],
    'expenses',
  )
  return [...points.values()]
}
