import { describe, expect, it } from 'vitest'
import { calculateTotalAmount, centsToText, formatCurrency, parseCents, parseNumber, roundCents } from '../../src/shared/money'

describe('valores em centavos', () => {
  it('converte texto digitado em centavos', () => {
    expect(parseCents('12,50')).toBe(1250)
    expect(parseCents('R$ 3,80')).toBe(380)
    expect(parseCents('1.234,56')).toBe(123456)
    expect(parseCents('12.5')).toBe(1250)
    expect(parseCents('1.234')).toBe(123400)
    expect(parseCents('')).toBeNull()
    expect(parseCents('abc')).toBeNull()
  })

  it('formata em reais (pt-BR)', () => {
    expect(formatCurrency(1250).replace(/\s/g, ' ')).toBe('R$ 12,50')
    expect(centsToText(1250)).toBe('12,50')
  })

  it('arredonda meio centavo para cima', () => {
    expect(roundCents(100.5)).toBe(101)
    expect(roundCents(1.005 * 100)).toBe(101)
  })

  it('calcula o total do abastecimento a partir de litros e preço', () => {
    expect(calculateTotalAmount(40, 380)).toBe(15200)
    expect(calculateTotalAmount(33.33, 579)).toBe(19298) // 19297.57 -> arredonda
    expect(calculateTotalAmount(10.5, 499)).toBe(5240) // 5239.5 -> meio centavo sobe
  })

  it('converte números pt-BR', () => {
    expect(parseNumber('12,5')).toBe(12.5)
    expect(parseNumber('1.000,5')).toBe(1000.5)
    expect(parseNumber('x')).toBeNull()
  })
})
