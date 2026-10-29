import { describe, expect, it } from 'vitest'
import { formatCpf, formatPhone, isValidCpf, isValidPhone, onlyDigits } from '../../src/shared/cpf'

describe('CPF', () => {
  it('valida pelos dígitos verificadores, com ou sem máscara', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('52998224725')).toBe(true)
    expect(isValidCpf('168.995.350-09')).toBe(true)
  })

  it('rejeita dígito verificador errado, tamanho errado e sequências repetidas', () => {
    expect(isValidCpf('529.982.247-24')).toBe(false)
    expect(isValidCpf('529.982.247')).toBe(false)
    expect(isValidCpf('111.111.111-11')).toBe(false)
    expect(isValidCpf('')).toBe(false)
  })

  it('aplica a máscara durante a digitação', () => {
    expect(onlyDigits('529.982.247-25')).toBe('52998224725')
    expect(formatCpf('5')).toBe('5')
    expect(formatCpf('5299')).toBe('529.9')
    expect(formatCpf('529982247')).toBe('529.982.247')
    expect(formatCpf('52998224725999')).toBe('529.982.247-25')
  })
})

describe('celular', () => {
  it('exige DDD e 8 ou 9 dígitos', () => {
    expect(isValidPhone('(11) 98765-4321')).toBe(true)
    expect(isValidPhone('1133334444')).toBe(true)
    expect(isValidPhone('987654321')).toBe(false)
    expect(isValidPhone('(00) 98765-4321')).toBe(false)
  })

  it('aplica a máscara durante a digitação', () => {
    expect(formatPhone('1')).toBe('(1')
    expect(formatPhone('119')).toBe('(11) 9')
    expect(formatPhone('1133334444')).toBe('(11) 3333-4444')
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321')
  })
})
