import { beforeEach, describe, expect, it } from 'vitest'
import { openDatabase } from '../../src/main/database/connection'
import type { Db } from '../../src/main/services/common'
import { registerUser } from '../../src/main/services/auth'
import { getDashboard } from '../../src/main/services/dashboard'
import { DomainError } from '../../src/main/services/errors'
import { createExpense } from '../../src/main/services/expenses'
import { createGoal, listGoalProgress, updateGoal } from '../../src/main/services/goals'
import { listPlatforms, createPlatform, deletePlatform } from '../../src/main/services/platforms'
import { createRefueling, listRefuelings } from '../../src/main/services/refuelings'
import { generateReport } from '../../src/main/services/reports'
import { deleteShift, endShift, getOpenShift, startShift, updateShift } from '../../src/main/services/shifts'
import { createTrip, deleteTrip, listTrips, updateTrip } from '../../src/main/services/trips'
import { createVehicle, deleteVehicle, getVehicle } from '../../src/main/services/vehicles'
import { exportToCsv } from '../../src/main/services/csv'

let db: Db
let uid: number

beforeEach(() => {
  db = openDatabase(':memory:')
  uid = registerUser(db, { name: 'Motorista', cpf: '529.982.247-25', email: 'm@teste.com', password: 'senha-segura-1', confirmPassword: 'senha-segura-1' }).user.id
})

const at = (hour: number, day = 15) => new Date(2026, 0, day, hour, 0, 0).toISOString()

function setup() {
  const vehicle = createVehicle(db, uid, { name: 'Onix', currentOdometer: 1000 })
  const uber = listPlatforms(db, uid).find((p) => p.name === 'Uber')!
  return { vehicle, uber }
}

describe('edição de jornada', () => {
  it('corrige datas e quilometragens de uma jornada encerrada', () => {
    const { vehicle } = setup()
    const shift = startShift(db, uid, { vehicleId: vehicle.id, startOdometer: 1000, startedAt: at(8) })
    endShift(db, uid, { id: shift.id, endOdometer: 1100, endedAt: at(16) })
    const edited = updateShift(db, uid, { id: shift.id, startedAt: at(7), endedAt: at(17), startOdometer: 990, endOdometer: 1120, notes: 'ajustada' })
    expect(edited.startedAt).toBe(at(7))
    expect(edited.distanceKm).toBe(130)
    expect(edited.notes).toBe('ajustada')
    expect(getVehicle(db, uid, vehicle.id).currentOdometer).toBe(1120)
  })

  it('jornada em andamento não aceita término', () => {
    const { vehicle } = setup()
    const shift = startShift(db, uid, { vehicleId: vehicle.id, startOdometer: 1000, startedAt: at(8) })
    expect(() => updateShift(db, uid, { id: shift.id, startedAt: at(8), endedAt: at(10), startOdometer: 1000, endOdometer: 1010 })).toThrow(/em andamento/)
    expect(updateShift(db, uid, { id: shift.id, startedAt: at(9), startOdometer: 1005 }).startOdometer).toBe(1005)
  })

  it('rejeita período que deixa corridas de fora ou sobrepõe outra jornada', () => {
    const { vehicle, uber } = setup()
    const first = startShift(db, uid, { vehicleId: vehicle.id, startOdometer: 1000, startedAt: at(8) })
    createTrip(db, uid, { shiftId: first.id, platformId: uber.id, occurredAt: at(9), fareAmount: 2000, distanceKm: 5 })
    endShift(db, uid, { id: first.id, endOdometer: 1050, endedAt: at(12) })
    const second = startShift(db, uid, { vehicleId: vehicle.id, startOdometer: 1050, startedAt: at(14) })
    endShift(db, uid, { id: second.id, endOdometer: 1100, endedAt: at(18) })

    expect(() => updateShift(db, uid, { id: first.id, startedAt: at(10), endedAt: at(12), startOdometer: 1000, endOdometer: 1050 })).toThrow(/corridas/)
    expect(() => updateShift(db, uid, { id: first.id, startedAt: at(8), endedAt: at(15), startOdometer: 1000, endOdometer: 1050 })).toThrow(/sobrepõe/)
    expect(() => updateShift(db, uid, { id: second.id, startedAt: at(14), endedAt: at(18), startOdometer: 1050, endOdometer: 1000 })).toThrow(/inferior/)
  })
})

describe('jornadas', () => {
  it('inicia e encerra uma jornada, atualizando o odômetro do veículo', () => {
    const { vehicle } = setup()
    const shift = startShift(db, uid, { vehicleId: vehicle.id, startOdometer: 1000, startedAt: at(8) })
    expect(shift.endedAt).toBeNull()
    expect(getOpenShift(db, uid)?.id).toBe(shift.id)

    const ended = endShift(db, uid, { id: shift.id, endOdometer: 1120, endedAt: at(16) })
    expect(ended.distanceKm).toBe(120)
    expect(getOpenShift(db, uid)).toBeNull()
    expect(getVehicle(db, uid, vehicle.id).currentOdometer).toBe(1120)
  })

  it('não permite duas jornadas abertas', () => {
    const { vehicle } = setup()
    startShift(db, uid, { vehicleId: vehicle.id, startOdometer: 1000, startedAt: at(8) })
    expect(() => startShift(db, uid, { vehicleId: vehicle.id, startOdometer: 1000 })).toThrow(/em andamento/)
  })

  it('não permite iniciar com quilometragem menor que a do veículo', () => {
    const { vehicle } = setup()
    expect(() => startShift(db, uid, { vehicleId: vehicle.id, startOdometer: 900 })).toThrow(DomainError)
  })

  it('não permite encerrar com quilometragem final menor ou encerrar duas vezes', () => {
    const { vehicle } = setup()
    const shift = startShift(db, uid, { vehicleId: vehicle.id, startOdometer: 1000, startedAt: at(8) })
    expect(() => endShift(db, uid, { id: shift.id, endOdometer: 999, endedAt: at(16) })).toThrow(/inferior/)
    endShift(db, uid, { id: shift.id, endOdometer: 1050, endedAt: at(16) })
    expect(() => endShift(db, uid, { id: shift.id, endOdometer: 1060 })).toThrow(/já foi encerrada/)
  })

  it('bloqueia exclusão de jornada com viagens vinculadas', () => {
    const { vehicle, uber } = setup()
    const shift = startShift(db, uid, { vehicleId: vehicle.id, startOdometer: 1000, startedAt: at(8) })
    createTrip(db, uid, { shiftId: shift.id, platformId: uber.id, occurredAt: at(9), fareAmount: 2000, distanceKm: 5 })
    expect(() => deleteShift(db, uid, shift.id)).toThrow(/vinculados/)
  })
})

describe('viagens', () => {
  it('registra, edita, filtra e exclui viagens vinculadas à jornada', () => {
    const { vehicle, uber } = setup()
    const shift = startShift(db, uid, { vehicleId: vehicle.id, startOdometer: 1000, startedAt: at(8) })
    const trip = createTrip(db, uid, {
      shiftId: shift.id, platformId: uber.id, occurredAt: at(9), fareAmount: 2000, tip: 300, extras: 100, distanceKm: 8, durationMinutes: 20,
    })
    expect(trip.totalRevenue).toBe(2400)

    const updated = updateTrip(db, uid, { id: trip.id, shiftId: shift.id, platformId: uber.id, occurredAt: at(9), fareAmount: 2500, distanceKm: 8 })
    expect(updated.totalRevenue).toBe(2500)

    const list = listTrips(db, uid, { shiftId: shift.id })
    expect(list.totals).toEqual({ tripCount: 1, totalRevenue: 2500 })
    expect(listTrips(db, uid, { platformId: 999 }).items).toHaveLength(0)

    deleteTrip(db, uid, trip.id)
    expect(listTrips(db, uid, {}).items).toHaveLength(0)
  })

  it('rejeita viagem fora do período da jornada e plataforma inativa', () => {
    const { vehicle, uber } = setup()
    const shift = startShift(db, uid, { vehicleId: vehicle.id, startOdometer: 1000, startedAt: at(8) })
    expect(() => createTrip(db, uid, { shiftId: shift.id, platformId: uber.id, occurredAt: at(6), fareAmount: 1000, distanceKm: 3 })).toThrow(/dentro/)
    db.prepare('UPDATE plataformas SET ativa = 0 WHERE id = ?').run(uber.id)
    expect(() => createTrip(db, uid, { shiftId: shift.id, platformId: uber.id, occurredAt: at(9), fareAmount: 1000, distanceKm: 3 })).toThrow(/inativa/)
  })
})

describe('abastecimentos e despesas', () => {
  it('calcula o valor total a partir de litros e preço e atualiza o odômetro', () => {
    const { vehicle } = setup()
    const refueling = createRefueling(db, uid, {
      vehicleId: vehicle.id, refueledAt: at(10), fuel: 'Gasolina', liters: 40, pricePerLiter: 380, odometer: 1200, fullTank: true,
    })
    expect(refueling.totalAmount).toBe(15200)
    expect(refueling.fullTank).toBe(true)
    expect(getVehicle(db, uid, vehicle.id).currentOdometer).toBe(1200)
    expect(listRefuelings(db, uid, { vehicleId: vehicle.id })).toHaveLength(1)
  })

  it('não duplica abastecimentos como despesas', () => {
    const { vehicle } = setup()
    createRefueling(db, uid, { vehicleId: vehicle.id, refueledAt: at(10), fuel: 'Gasolina', liters: 10, pricePerLiter: 500, odometer: 1010 })
    expect(db.prepare('SELECT COUNT(*) AS n FROM despesas').get()).toEqual({ n: 0 })
  })

  it('rejeita jornada de outro veículo', () => {
    const { vehicle } = setup()
    const other = createVehicle(db, uid, { name: 'Outro' })
    const shift = startShift(db, uid, { vehicleId: vehicle.id, startOdometer: 1000, startedAt: at(8) })
    expect(() =>
      createRefueling(db, uid, { vehicleId: other.id, shiftId: shift.id, refueledAt: at(9), fuel: 'Etanol', liters: 5, pricePerLiter: 400, odometer: 5 }),
    ).toThrow(/outro veículo/)
  })

  it('filtra despesas por categoria', () => {
    createExpense(db, uid, { description: 'Lavagem', category: 'Lavagem', amount: 3000, expenseDate: at(10) })
    createExpense(db, uid, { description: 'Pedágio', category: 'Pedágio', amount: 900, expenseDate: at(11) })
    const csv = exportToCsv(db, uid, { entity: 'expenses' })
    expect(csv.content).toContain('Lavagem')
    expect(csv.content).toContain('9,00')
  })
})

describe('integridade dos cadastros', () => {
  it('impede excluir veículo e plataforma com vínculos', () => {
    const { vehicle, uber } = setup()
    const shift = startShift(db, uid, { vehicleId: vehicle.id, startOdometer: 1000, startedAt: at(8) })
    createTrip(db, uid, { shiftId: shift.id, platformId: uber.id, occurredAt: at(9), fareAmount: 1000, distanceKm: 2 })
    expect(() => deleteVehicle(db, uid, vehicle.id)).toThrow(/vinculado/)
    expect(() => deletePlatform(db, uid, uber.id)).toThrow(/viagem/)
  })

  it('permite excluir cadastros sem vínculos e rejeita plataforma duplicada', () => {
    const extra = createPlatform(db, uid, { name: 'InDrive' })
    expect(() => createPlatform(db, uid, { name: 'indrive' })).toThrow(/Já existe/)
    deletePlatform(db, uid, extra.id)
    const vehicle = createVehicle(db, uid, { name: 'Descartável' })
    deleteVehicle(db, uid, vehicle.id)
  })
})

describe('painel, metas e relatórios', () => {
  function seed() {
    const { vehicle, uber } = setup()
    const shift = startShift(db, uid, { vehicleId: vehicle.id, startOdometer: 1000, startedAt: at(8) })
    createTrip(db, uid, { shiftId: shift.id, platformId: uber.id, occurredAt: at(9), fareAmount: 4000, tip: 500, distanceKm: 10 })
    createTrip(db, uid, { shiftId: shift.id, platformId: uber.id, occurredAt: at(11), fareAmount: 6000, distanceKm: 15 })
    endShift(db, uid, { id: shift.id, endOdometer: 1100, endedAt: at(12) })
    createExpense(db, uid, { description: 'Pedágio', category: 'Pedágio', amount: 1000, expenseDate: at(10) })
    return { vehicle }
  }

  it('estado vazio sem registros', () => {
    const data = getDashboard(db, uid, { period: 'dia' })
    expect(data.hasRecords).toBe(false)
    expect(data.summary.grossRevenue).toBe(0)
    expect(data.summary.revenuePerHour).toBeNull()
  })

  it('calcula indicadores a partir dos dados persistidos', () => {
    seed()
    const data = getDashboard(db, uid, { period: 'dia', reference: at(12) })
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
    const s = getDashboard(db, uid, { period: 'dia', reference: at(12) }).summary
    expect(s.estimatedFuelCost).toBeNull()
    expect(s.profitIsPartial).toBe(true)
    expect(s.operatingProfit).toBe(9500)
    expect(s.unconsideredCosts.map((c) => c.item)).toContain('Combustível consumido')
  })

  it('estima combustível quando há dois tanques completos e não subtrai o abastecimento inteiro', () => {
    const { vehicle } = seed()
    createRefueling(db, uid, { vehicleId: vehicle.id, refueledAt: at(7, 10), fuel: 'Gasolina', liters: 30, pricePerLiter: 500, odometer: 800, fullTank: true })
    createRefueling(db, uid, { vehicleId: vehicle.id, refueledAt: at(7, 12), fuel: 'Gasolina', liters: 20, pricePerLiter: 500, odometer: 1000, fullTank: true })
    // consumo: 200 km / 20 L = 10 km/L; 100 km rodados -> 10 L -> R$ 50,00
    const s = getDashboard(db, uid, { period: 'dia', reference: at(12) }).summary
    expect(s.estimatedFuelCost).toBe(5000)
    expect(s.profitIsPartial).toBe(false)
    expect(s.operatingProfit).toBe(10500 - 5000 - 1000)
    expect(s.costPerKm).toBe(60)
  })

  it('progresso de metas respeita o tipo e o período', () => {
    seed()
    createGoal(db, uid, { description: 'Meta do dia', type: 'faturamento', period: 'diaria', targetAmount: 21000, referenceDate: '2026-01-15' })
    const progress = listGoalProgress(db, uid, new Date(at(12)))
    expect(progress).toHaveLength(1)
    expect(progress[0]).toMatchObject({ achieved: 10500, remaining: 10500, ratio: 0.5, reached: false })
  })

  describe('metas por data', () => {
    const goal = (referenceDate: string, extra: Partial<Parameters<typeof createGoal>[2]> = {}) =>
      createGoal(db, uid, { description: `Meta ${referenceDate}`, type: 'faturamento', period: 'diaria', targetAmount: 10000, referenceDate, ...extra })

    /** Corridas em dias diferentes: 15/01 R$ 105, 16/01 R$ 60 e 20/01 R$ 40. */
    function seedDays() {
      const { vehicle, uber } = setup()
      const trip = (day: number, fareAmount: number) => {
        const shift = startShift(db, uid, { vehicleId: vehicle.id, startOdometer: 1000 + day * 100, startedAt: at(8, day) })
        createTrip(db, uid, { shiftId: shift.id, platformId: uber.id, occurredAt: at(9, day), fareAmount, distanceKm: 5 })
        endShift(db, uid, { id: shift.id, endOdometer: 1000 + day * 100 + 10, endedAt: at(12, day) })
      }
      trip(15, 10500)
      trip(16, 6000)
      trip(20, 4000)
    }

    it('cada meta diária soma apenas as corridas do seu próprio dia', () => {
      seedDays()
      goal('2026-01-15')
      goal('2026-01-16', { targetAmount: 5000 })
      goal('2026-01-17')
      const byDate = Object.fromEntries(listGoalProgress(db, uid, new Date(at(12, 17))).map((p) => [p.goal.referenceDate, p]))
      expect(byDate['2026-01-15']).toMatchObject({ achieved: 10500, reached: true, phase: 'past' })
      expect(byDate['2026-01-16']).toMatchObject({ achieved: 6000, reached: true, phase: 'past' })
      expect(byDate['2026-01-17']).toMatchObject({ achieved: 0, reached: false, phase: 'current' })
    })

    it('semanal e mensal usam a semana (segunda a segunda) e o mês que contêm a data', () => {
      seedDays() // 15/01/2026 é quinta-feira: a semana vai de 12/01 a 18/01
      goal('2026-01-14', { period: 'semanal', description: 'Semana' })
      goal('2026-01-31', { period: 'mensal', description: 'Mês' })
      const progress = Object.fromEntries(listGoalProgress(db, uid, new Date(at(12, 22))).map((p) => [p.goal.description, p]))
      expect(progress['Semana']).toMatchObject({ achieved: 16500, phase: 'past' }) // 15 e 16, não o dia 20
      expect(progress['Mês']).toMatchObject({ achieved: 20500, phase: 'current' }) // 15, 16 e 20; janeiro ainda não terminou
    })

    it('classifica a fase em relação a agora e o painel mostra só as metas ativas do período atual', () => {
      seedDays()
      goal('2026-01-15', { description: 'Passada' })
      goal('2026-01-20', { description: 'Hoje' })
      goal('2026-01-20', { description: 'Hoje inativa', active: false })
      goal('2026-01-21', { description: 'Futura' })
      goal('2026-01-19', { description: 'Semana atual', period: 'semanal' })
      const phases = Object.fromEntries(listGoalProgress(db, uid, new Date(at(12, 20))).map((p) => [p.goal.description, p.phase]))
      expect(phases).toEqual({ Passada: 'past', Hoje: 'current', 'Hoje inativa': 'current', Futura: 'future', 'Semana atual': 'current' })

      const dashboard = getDashboard(db, uid, { period: 'dia', reference: at(12, 20) })
      expect(dashboard.goals.map((g) => g.goal.description).sort()).toEqual(['Hoje', 'Semana atual'])
      expect(dashboard.goals.find((g) => g.goal.description === 'Hoje')).toMatchObject({ achieved: 4000 })
    })

    it('meta de lucro usa o resultado do período da própria meta', () => {
      seedDays()
      createExpense(db, uid, { description: 'Pedágio', category: 'Pedágio', amount: 1000, expenseDate: at(10, 16) })
      goal('2026-01-16', { type: 'lucro', targetAmount: 5000 })
      expect(listGoalProgress(db, uid, new Date(at(12, 22)))[0]).toMatchObject({ achieved: 5000, reached: true })
    })

    it('editar a data muda o período da meta; data inválida é rejeitada', () => {
      seedDays()
      const created = goal('2026-01-15')
      updateGoal(db, uid, { id: created.id, description: created.description, type: 'faturamento', period: 'diaria', targetAmount: 10000, referenceDate: '2026-01-20' })
      expect(listGoalProgress(db, uid, new Date(at(12, 22)))[0]).toMatchObject({ achieved: 4000 })
      expect(() => goal('2026-02-30')).toThrow(/Data inválida/)
      expect(() => goal('15/01/2026')).toThrow(/Data inválida/)
    })
  })

  it('relatório compara plataformas e agrupa despesas por categoria', () => {
    seed()
    const report = generateReport(db, uid, { from: at(0, 1), to: at(0, 31) })
    expect(report.platforms).toEqual([{ platform: 'Uber', trips: 2, revenue: 10500, distanceKm: 25, revenuePerKm: 420 }])
    expect(report.expensesByCategory).toEqual([{ category: 'Pedágio', total: 1000 }])
    const csv = exportToCsv(db, uid, { entity: 'report', from: at(0, 1), to: at(0, 31) })
    expect(csv.content).toContain('Faturamento bruto (R$);105,00')
  })
})
