import { describe, expect, it } from 'vitest'
import {
  attributedDistance,
  averageConsumption,
  averagePricePerLiter,
  cashResult,
  costPerKm,
  estimateFuelCost,
  goalProgress,
  grossRevenue,
  operatingProfit,
  revenuePerHour,
  revenuePerKm,
  totalHours,
  totalKm,
  tripRevenue,
  type RefuelingFacts,
} from '../../src/main/services/financial'

describe('faturamento', () => {
  it('soma corrida, gorjeta e adicionais de cada viagem', () => {
    expect(tripRevenue({ fareAmount: 1250, tip: 300, extras: 50 })).toBe(1600)
  })

  it('soma o faturamento bruto de várias viagens em centavos', () => {
    const trips = [
      { fareAmount: 1250, tip: 0, extras: 0 },
      { fareAmount: 3380, tip: 500, extras: 120 },
    ]
    expect(grossRevenue(trips)).toBe(5250)
    expect(grossRevenue([])).toBe(0)
  })
})

describe('receita por hora e por km', () => {
  const shifts = [
    { startedAt: '2026-01-01T10:00:00.000Z', endedAt: '2026-01-01T14:00:00.000Z', startOdometer: 100, endOdometer: 180 },
    { startedAt: '2026-01-02T10:00:00.000Z', endedAt: null, startOdometer: 180, endOdometer: null },
  ]

  it('considera apenas jornadas encerradas', () => {
    expect(totalHours(shifts)).toBe(4)
    expect(totalKm(shifts)).toBe(80)
  })

  it('calcula receita por hora e por km em centavos', () => {
    expect(revenuePerHour(20000, 4)).toBe(5000)
    expect(revenuePerKm(20000, 80)).toBe(250)
  })

  it('não divide por zero', () => {
    expect(revenuePerHour(20000, 0)).toBeNull()
    expect(revenuePerKm(20000, 0)).toBeNull()
  })
})

describe('deslocamento atribuído', () => {
  it('soma distância e quilometragem vazia sem tocar na quilometragem da jornada', () => {
    expect(attributedDistance([{ distanceKm: 10, deadheadKm: 2.5 }, { distanceKm: 5, deadheadKm: 0 }])).toBe(17.5)
  })
})

describe('resultado de caixa e lucro', () => {
  it('subtrai despesas e abastecimentos da receita', () => {
    expect(cashResult(10000, 2000, 3000)).toBe(5000)
  })

  it('lucro operacional completo quando o combustível foi estimado', () => {
    expect(operatingProfit({ grossRevenue: 10000, estimatedFuelCost: 2000, operatingExpenses: 1000 })).toEqual({ profit: 7000, partial: false })
  })

  it('lucro parcial quando o combustível não pôde ser estimado', () => {
    expect(operatingProfit({ grossRevenue: 10000, estimatedFuelCost: null, operatingExpenses: 1000 })).toEqual({ profit: 9000, partial: true })
  })

  it('custo por km', () => {
    expect(costPerKm(3000, 100)).toBe(30)
    expect(costPerKm(3000, 0)).toBeNull()
  })
})

describe('consumo médio', () => {
  const refueling = (odometer: number, liters: number, fullTank: boolean, price = 500): RefuelingFacts => ({
    refueledAt: `2026-01-${String(Math.floor(odometer / 100) + 1).padStart(2, '0')}T10:00:00.000Z`,
    odometer,
    liters,
    pricePerLiter: price,
    totalAmount: Math.round(liters * price),
    fullTank,
  })

  it('retorna null com menos de dois tanques completos', () => {
    expect(averageConsumption([refueling(1000, 40, true)])).toBeNull()
    expect(averageConsumption([refueling(1000, 40, false), refueling(1400, 40, false)])).toBeNull()
  })

  it('calcula entre dois tanques completos consecutivos', () => {
    const result = averageConsumption([refueling(1000, 40, true), refueling(1400, 40, true)])
    expect(result).toEqual({ kmPerLiter: 10, km: 400, liters: 40 })
  })

  it('soma abastecimentos parciais intermediários ao segmento', () => {
    const result = averageConsumption([refueling(1000, 40, true), refueling(1200, 20, false), refueling(1400, 20, true)])
    expect(result?.kmPerLiter).toBe(10)
    expect(result?.liters).toBe(40)
  })

  it('ignora segmentos com odômetro não crescente', () => {
    expect(averageConsumption([refueling(1000, 40, true), refueling(1000, 40, true)])).toBeNull()
  })

  it('preço médio ponderado e custo estimado', () => {
    const list = [refueling(1000, 10, true, 400), refueling(1400, 30, true, 600)]
    expect(averagePricePerLiter(list)).toBe(550)
    expect(averagePricePerLiter([])).toBeNull()
    expect(estimateFuelCost(100, 10, 550)).toBe(5500)
  })
})

describe('metas', () => {
  it('calcula restante, percentual e conclusão', () => {
    expect(goalProgress(10000, 2500)).toEqual({ remaining: 7500, ratio: 0.25, reached: false })
    expect(goalProgress(10000, 12000)).toEqual({ remaining: 0, ratio: 1, reached: true })
  })

  it('não permite percentual negativo', () => {
    expect(goalProgress(10000, -500).ratio).toBe(0)
  })
})
