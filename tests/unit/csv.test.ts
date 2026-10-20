import { describe, expect, it } from 'vitest'
import { buildCsv, csvMoney, escapeCsvCell } from '../../src/main/services/csv'

describe('exportação CSV', () => {
  it('formata valores monetários com vírgula decimal', () => {
    expect(csvMoney(1250)).toBe('12,50')
    expect(csvMoney(5)).toBe('0,05')
  })

  it('escapa aspas, separador e quebras de linha', () => {
    expect(escapeCsvCell('Rua "A"; 10')).toBe('"Rua ""A""; 10"')
    expect(escapeCsvCell('linha1\nlinha2')).toBe('"linha1\nlinha2"')
  })

  it('neutraliza injeção de fórmula', () => {
    expect(escapeCsvCell('=SOMA(A1)')).toBe("'=SOMA(A1)")
  })

  it('gera BOM, cabeçalhos em português e preserva acentos', () => {
    const csv = buildCsv(['Descrição', 'Valor (R$)'], [['Pedágio', '12,50'], ['Lavagem', null]])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('Descrição;Valor (R$)')
    expect(csv).toContain('Lavagem;')
  })
})
