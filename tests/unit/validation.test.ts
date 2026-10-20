import { describe, expect, it } from 'vitest'
import { expenseSchema, refuelingSchema, startShiftSchema, tripSchema } from '../../src/shared/schemas'
import { DomainError } from '../../src/main/services/errors'
import { validateShiftEnd, validateShiftStart, validateTrip } from '../../src/main/services/validation'

describe('validação de jornadas', () => {
  it('bloqueia segunda jornada aberta', () => {
    expect(() => validateShiftStart({ hasOpenShift: true, lastKnownOdometer: 100, startOdometer: 100 })).toThrow(DomainError)
  })

  it('bloqueia quilometragem inicial menor que a última conhecida', () => {
    expect(() => validateShiftStart({ hasOpenShift: false, lastKnownOdometer: 500, startOdometer: 499 })).toThrow(/inferior/)
    expect(() => validateShiftStart({ hasOpenShift: false, lastKnownOdometer: 500, startOdometer: 500 })).not.toThrow()
    expect(() => validateShiftStart({ hasOpenShift: false, lastKnownOdometer: null, startOdometer: 0 })).not.toThrow()
  })

  it('bloqueia encerramento com quilometragem ou data inválidas', () => {
    const base = { startedAt: '2026-01-01T10:00:00.000Z', endedAt: '2026-01-01T12:00:00.000Z', startOdometer: 100, endOdometer: 150 }
    expect(() => validateShiftEnd(base)).not.toThrow()
    expect(() => validateShiftEnd({ ...base, endOdometer: 99 })).toThrow(/inferior/)
    expect(() => validateShiftEnd({ ...base, endedAt: '2026-01-01T10:00:00.000Z' })).toThrow(/posterior/)
  })

  it('exige quilometragem inicial no schema', () => {
    expect(startShiftSchema.safeParse({ vehicleId: 1 }).success).toBe(false)
    expect(startShiftSchema.safeParse({ vehicleId: 1, startOdometer: 10 }).success).toBe(true)
  })
})

describe('validação de viagens', () => {
  const shift = { startedAt: '2026-01-01T10:00:00.000Z', endedAt: null }
  const base = { occurredAt: '2026-01-01T11:00:00.000Z', distanceKm: 5, durationMinutes: 10, totalRevenue: 1000, notes: null, shift }

  it('aceita viagem válida', () => {
    expect(() => validateTrip(base)).not.toThrow()
  })

  it('distância zero exige justificativa', () => {
    expect(() => validateTrip({ ...base, distanceKm: 0 })).toThrow(/justificativa/)
    expect(() => validateTrip({ ...base, distanceKm: 0, notes: 'Cancelada com taxa' })).not.toThrow()
  })

  it('exige data dentro da jornada e receita positiva', () => {
    expect(() => validateTrip({ ...base, occurredAt: '2026-01-01T09:00:00.000Z' })).toThrow(/jornada/)
    expect(() => validateTrip({ ...base, totalRevenue: 0 })).toThrow(/maior que zero/)
  })

  it('rejeita valores monetários negativos no schema', () => {
    const result = tripSchema.safeParse({ shiftId: 1, platformId: 1, occurredAt: base.occurredAt, fareAmount: -1 })
    expect(result.success).toBe(false)
  })
})

describe('validação de abastecimentos', () => {
  const valid = { vehicleId: 1, refueledAt: '2026-01-01T10:00:00.000Z', fuel: 'Gasolina', liters: 40, pricePerLiter: 580, odometer: 1000 }

  it('aceita abastecimento válido e aplica padrões', () => {
    const result = refuelingSchema.parse(valid)
    expect(result.fullTank).toBe(false)
    expect(result.shiftId).toBeNull()
  })

  it('rejeita litros e preço inválidos', () => {
    expect(refuelingSchema.safeParse({ ...valid, liters: -1 }).success).toBe(false)
    expect(refuelingSchema.safeParse({ ...valid, liters: 0 }).success).toBe(false)
    expect(refuelingSchema.safeParse({ ...valid, pricePerLiter: -5 }).success).toBe(false)
  })
})

describe('validação de despesas', () => {
  const valid = { description: 'Troca de óleo', category: 'Manutenção', amount: 15000, expenseDate: '2026-01-01T10:00:00.000Z' }

  it('aceita despesa válida e assume tipo operacional', () => {
    expect(expenseSchema.parse(valid).kind).toBe('operacional')
  })

  it('rejeita valor negativo, categoria desconhecida e descrição vazia', () => {
    expect(expenseSchema.safeParse({ ...valid, amount: -1 }).success).toBe(false)
    expect(expenseSchema.safeParse({ ...valid, category: 'Lazer' }).success).toBe(false)
    expect(expenseSchema.safeParse({ ...valid, description: '  ' }).success).toBe(false)
  })
})
