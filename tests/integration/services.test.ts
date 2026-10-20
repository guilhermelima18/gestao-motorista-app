import { beforeEach, describe, expect, it } from 'vitest'
import { openDatabase } from '../../src/main/database/connection'
import type { Db } from '../../src/main/services/common'
import { getDashboard } from '../../src/main/services/dashboard'
import { DomainError } from '../../src/main/services/errors'
import { createExpense } from '../../src/main/services/expenses'
import { createGoal, listGoalProgress } from '../../src/main/services/goals'
import { listPlatforms, createPlatform, deletePlatform } from '../../src/main/services/platforms'
import { createRefueling, listRefuelings } from '../../src/main/services/refuelings'
import { generateReport } from '../../src/main/services/reports'
import { deleteShift, endShift, getOpenShift, startShift } from '../../src/main/services/shifts'
import { createTrip, deleteTrip, listTrips, updateTrip } from '../../src/main/services/trips'
import { createVehicle, deleteVehicle, getVehicle } from '../../src/main/services/vehicles'
import { exportToCsv } from '../../src/main/services/csv'

let db: Db

beforeEach(() => {
  db = openDatabase(':memory:')
})

const at = (hour: number, day = 15) => new Date(2026, 0, day, hour, 0, 0).toISOString()

function setup() {
  const vehicle = createVehicle(db, { name: 'Onix', currentOdometer: 1000 })
  const uber = listPlatforms(db).find((p) => p.name === 'Uber')!
  return { vehicle, uber }
}

describe('jornadas', () => {
  it('inicia e encerra uma jornada, atualizando o odômetro do veículo', () => {
    const { vehicle } = setup()
    const shift = startShift(db, { vehicleId: vehicle.id, startOdometer: 1000, startedAt: at(8) })
    expect(shift.endedAt).toBeNull()
    expect(getOpenShift(db)?.id).toBe(shift.id)

    const ended = endShift(db, { id: shift.id, endOdometer: 1120, endedAt: at(16) })
    expect(ended.distanceKm).toBe(120)
    expect(getOpenShift(db)).toBeNull()
    expect(getVehicle(db, vehicle.id).currentOdometer).toBe(1120)
  })

  it('não permite duas jornadas abertas', () => {
    const { vehicle } = setup()
    startShift(db, { vehicleId: vehicle.id, startOdometer: 1000, startedAt: at(8) })
    expect(() => startShift(db, { vehicleId: vehicle.id, startOdometer: 1000 })).toThrow(/em andamento/)
  })

  it('não permite iniciar com quilometragem menor que a do veículo', () => {
    const { vehicle } = setup()
    expect(() => startShift(db, { vehicleId: vehicle.id, startOdometer: 900 })).toThrow(DomainError)
  })

  it('não permite encerrar com quilometragem final menor ou encerrar duas vezes', () => {
    const { vehicle } = setup()
    const shift = startShift(db, { vehicleId: vehicle.id, startOdometer: 1000, startedAt: at(8) })
    expect(() => endShift(db, { id: shift.id, endOdometer: 999, endedAt: at(16) })).toThrow(/inferior/)
    endShift(db, { id: shift.id, endOdometer: 1050, endedAt: at(16) })
    expect(() => endShift(db, { id: shift.id, endOdometer: 1060 })).toThrow(/já foi encerrada/)
  })

  it('bloqueia exclusão de jornada com viagens vinculadas', () => {
    const { vehicle, uber } = setup()
    const shift = startShift(db, { vehicleId: vehicle.id, startOdometer: 1000, startedAt: at(8) })
    createTrip(db, { shiftId: shift.id, platformId: uber.id, occurredAt: at(9), fareAmount: 2000, distanceKm: 5 })
    expect(() => deleteShift(db, shift.id)).toThrow(/vinculados/)
  })
})

describe('viagens', () => {
  it('registra, edita, filtra e exclui viagens vinculadas à jornada', () => {
    const { vehicle, uber } = setup()
    const shift = startShift(db, { vehicleId: vehicle.id, startOdometer: 1000, startedAt: at(8) })
    const trip = createTrip(db, {
      shiftId: shift.id, platformId: uber.id, occurredAt: at(9), fareAmount: 2000, tip: 300, extras: 100, distanceKm: 8, durationMinutes: 20,
    })
    expect(trip.totalRevenue).toBe(2400)

    const updated = updateTrip(db, { id: trip.id, shiftId: shift.id, platformId: uber.id, occurredAt: at(9), fareAmount: 2500, distanceKm: 8 })
    expect(updated.totalRevenue).toBe(2500)

    const list = listTrips(db, { shiftId: shift.id })
    expect(list.totals).toEqual({ tripCount: 1, totalRevenue: 2500 })
    expect(listTrips(db, { platformId: 999 }).items).toHaveLength(0)

    deleteTrip(db, trip.id)
    expect(listTrips(db, {}).items).toHaveLength(0)
  })

  it('rejeita viagem fora do período da jornada e plataforma inativa', () => {
    const { vehicle, uber } = setup()
    const shift = startShift(db, { vehicleId: vehicle.id, startOdometer: 1000, startedAt: at(8) })
    expect(() => createTrip(db, { shiftId: shift.id, platformId: uber.id, occurredAt: at(6), fareAmount: 1000, distanceKm: 3 })).toThrow(/dentro/)
    db.prepare('UPDATE plataformas SET ativa = 0 WHERE id = ?').run(uber.id)
    expect(() => createTrip(db, { shiftId: shift.id, platformId: uber.id, occurredAt: at(9), fareAmount: 1000, distanceKm: 3 })).toThrow(/inativa/)
  })
})

describe('abastecimentos e despesas', () => {
  it('calcula o valor total a partir de litros e preço e atualiza o odômetro', () => {
    const { vehicle } = setup()
    const refueling = createRefueling(db, {
      vehicleId: vehicle.id, refueledAt: at(10), fuel: 'Gasolina', liters: 40, pricePerLiter: 380, odometer: 1200, fullTank: true,
    })
    expect(refueling.totalAmount).toBe(15200)
    expect(refueling.fullTank).toBe(true)
    expect(getVehicle(db, vehicle.id).currentOdometer).toBe(1200)
    expect(listRefuelings(db, { vehicleId: vehicle.id })).toHaveLength(1)
  })

  it('não duplica abastecimentos como despesas', () => {
    const { vehicle } = setup()
    createRefueling(db, { vehicleId: vehicle.id, refueledAt: at(10), fuel: 'Gasolina', liters: 10, pricePerLiter: 500, odometer: 1010 })
    expect(db.prepare('SELECT COUNT(*) AS n FROM despesas').get()).toEqual({ n: 0 })
  })

  it('rejeita jornada de outro veículo', () => {
    const { vehicle } = setup()
    const other = createVehicle(db, { name: 'Outro' })
    const shift = startShift(db, { vehicleId: vehicle.id, startOdometer: 1000, startedAt: at(8) })
    expect(() =>
      createRefueling(db, { vehicleId: other.id, shiftId: shift.id, refueledAt: at(9), fuel: 'Etanol', liters: 5, pricePerLiter: 400, odometer: 5 }),
    ).toThrow(/outro veículo/)
  })

  it('filtra despesas por categoria', () => {
    createExpense(db, { description: 'Lavagem', category: 'Lavagem', amount: 3000, expenseDate: at(10) })
    createExpense(db, { description: 'Pedágio', category: 'Pedágio', amount: 900, expenseDate: at(11) })
    const csv = exportToCsv(db, { entity: 'expenses' })
    expect(csv.content).toContain('Lavagem')
    expect(csv.content).toContain('9,00')
  })
})

describe('integridade dos cadastros', () => {
  it('impede excluir veículo e plataforma com vínculos', () => {
    const { vehicle, uber } = setup()
    const shift = startShift(db, { vehicleId: vehicle.id, startOdometer: 1000, startedAt: at(8) })
    createTrip(db, { shiftId: shift.id, platformId: uber.id, occurredAt: at(9), fareAmount: 1000, distanceKm: 2 })
    expect(() => deleteVehicle(db, vehicle.id)).toThrow(/vinculado/)
    expect(() => deletePlatform(db, uber.id)).toThrow(/viagem/)
  })

  it('permite excluir cadastros sem vínculos e rejeita plataforma duplicada', () => {
    const extra = createPlatform(db, { name: 'InDrive' })
    expect(() => createPlatform(db, { name: 'indrive' })).toThrow(/Já existe/)
    deletePlatform(db, extra.id)
    const vehicle = createVehicle(db, { name: 'Descartável' })
    deleteVehicle(db, vehicle.id)
  })
})

describe('painel, metas e relatórios', () => {
  function seed() {
    const { vehicle, uber } = setup()
    const shift = startShift(db, { vehicleId: vehicle.id, startOdometer: 1000, startedAt: at(8) })
    createTrip(db, { shiftId: shift.id, platformId: uber.id, occurredAt: at(9), fareAmount: 4000, tip: 500, distanceKm: 10 })
    createTrip(db, { shiftId: shift.id, platformId: uber.id, occurredAt: at(11), fareAmount: 6000, distanceKm: 15 })
    endShift(db, { id: shift.id, endOdometer: 1100, endedAt: at(12) })
    createExpense(db, { description: 'Pedágio', category: 'Pedágio', amount: 1000, expenseDate: at(10) })
    return { vehicle }
  }

  it('estado vazio sem registros', () => {
    const data = getDashboard(db, { period: 'dia' })
    expect(data.hasRecords).toBe(false)
    expect(data.summary.grossRevenue).toBe(0)
    expect(data.summary.revenuePerHour).toBeNull()
  })

  it('calcula indicadores a partir dos dados persistidos', () => {
    seed()
    const data = getDashboard(db, { period: 'dia', reference: at(12) })
    const s = data.summary
    expect(data.hasRecords).toBe(true)
    expect(s.grossRevenue).toBe(10500)
    expect(s.tripCount).toBe(2)
    expect(s.totalExpenses).toBe(1000)
    expect(s.cashResult).toBe(9500)
    expect(s.kmDriven).toBe(100)
    expect(s.hoursWorked).toBe(4)
    expect(s.revenuePerHour).toBe(2625)
    expect(s.revenuePerKm).toBe(105)
    expect(s.attributedDistanceKm).toBe(25)
    expect(data.todayRevenue).toBe(10500)
    expect(data.weekRevenue).toBe(10500)
    expect(data.monthRevenue).toBe(10500)
    expect(data.series.find((p) => p.revenue > 0)?.expenses).toBe(1000)
  })

  it('marca o lucro como parcial sem consumo estimável', () => {
    seed()
    const s = getDashboard(db, { period: 'dia', reference: at(12) }).summary
    expect(s.estimatedFuelCost).toBeNull()
    expect(s.profitIsPartial).toBe(true)
    expect(s.operatingProfit).toBe(9500)
    expect(s.unconsideredCosts.map((c) => c.item)).toContain('Combustível consumido')
  })

  it('estima combustível quando há dois tanques completos e não subtrai o abastecimento inteiro', () => {
    const { vehicle } = seed()
    createRefueling(db, { vehicleId: vehicle.id, refueledAt: at(7, 10), fuel: 'Gasolina', liters: 30, pricePerLiter: 500, odometer: 800, fullTank: true })
    createRefueling(db, { vehicleId: vehicle.id, refueledAt: at(7, 12), fuel: 'Gasolina', liters: 20, pricePerLiter: 500, odometer: 1000, fullTank: true })
    // consumo: 200 km / 20 L = 10 km/L; 100 km rodados -> 10 L -> R$ 50,00
    const s = getDashboard(db, { period: 'dia', reference: at(12) }).summary
    expect(s.estimatedFuelCost).toBe(5000)
    expect(s.profitIsPartial).toBe(false)
    expect(s.operatingProfit).toBe(10500 - 5000 - 1000)
    expect(s.costPerKm).toBe(60)
  })

  it('progresso de metas respeita o tipo e o período', () => {
    seed()
    createGoal(db, { description: 'Meta do dia', type: 'faturamento', period: 'diaria', targetAmount: 21000 })
    const progress = listGoalProgress(db, new Date(at(12)))
    expect(progress).toHaveLength(1)
    expect(progress[0]).toMatchObject({ achieved: 10500, remaining: 10500, ratio: 0.5, reached: false })
  })

  it('relatório compara plataformas e agrupa despesas por categoria', () => {
    seed()
    const report = generateReport(db, { from: at(0, 1), to: at(0, 31) })
    expect(report.platforms).toEqual([{ platform: 'Uber', trips: 2, revenue: 10500, distanceKm: 25, revenuePerKm: 420 }])
    expect(report.expensesByCategory).toEqual([{ category: 'Pedágio', total: 1000 }])
    const csv = exportToCsv(db, { entity: 'report', from: at(0, 1), to: at(0, 31) })
    expect(csv.content).toContain('Faturamento bruto (R$);105,00')
  })
})
