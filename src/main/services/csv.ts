import type { ExportInput } from '@shared/schemas'
import { exportSchema } from '@shared/schemas'
import { format } from 'date-fns'
import type { Db } from './common'
import { listExpenses } from './expenses'
import { generateReport } from './reports'
import { listRefuelings } from './refuelings'
import { listShifts } from './shifts'
import { listTrips } from './trips'

export type CsvCell = string | number | null

const SEPARATOR = ';'
const BOM = '﻿'

/** Valor monetário em reais com vírgula decimal, sem símbolo: 1250 -> "12,50". */
export function csvMoney(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

export function csvNumber(value: number, digits = 1): string {
  return value.toFixed(digits).replace('.', ',')
}

export function csvDate(iso: string): string {
  return format(new Date(iso), 'dd/MM/yyyy HH:mm')
}

/**
 * Escapa uma célula: aspas duplicadas e campo entre aspas quando necessário. Células de texto que começam
 * com =, +, - ou @ recebem um apóstrofo para impedir execução de fórmula em planilhas (CSV injection).
 */
export function escapeCsvCell(cell: CsvCell, isText = true): string {
  if (cell === null) return ''
  let text = String(cell)
  if (isText && typeof cell === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** Monta o CSV (UTF-8 com BOM para o Excel reconhecer acentos; separador ponto e vírgula). */
export function buildCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map((cell) => escapeCsvCell(cell)).join(SEPARATOR))
  return BOM + lines.join('\r\n') + '\r\n'
}

const yesNo = (value: boolean) => (value ? 'Sim' : 'Não')

export function exportToCsv(db: Db, userId: number, input: ExportInput): { fileName: string; content: string } {
  const data = exportSchema.parse(input)
  const period = { from: data.from ?? null, to: data.to ?? null }
  const stamp = format(new Date(), 'yyyyMMdd')

  switch (data.entity) {
    case 'trips':
      return {
        fileName: `viagens-${stamp}.csv`,
        content: buildCsv(
          ['Data', 'Plataforma', 'Origem', 'Destino', 'Valor da corrida (R$)', 'Gorjeta (R$)', 'Adicionais (R$)', 'Receita total (R$)', 'Distância (km)', 'Duração (min)', 'Km vazio', 'Jornada', 'Observações'],
          listTrips(db, userId, period).items.map((t) => [
            csvDate(t.occurredAt), t.platformName, t.origin, t.destination, csvMoney(t.fareAmount), csvMoney(t.tip),
            csvMoney(t.extras), csvMoney(t.totalRevenue), csvNumber(t.distanceKm), t.durationMinutes,
            csvNumber(t.deadheadKm), t.shiftId, t.notes,
          ]),
        ),
      }
    case 'shifts':
      return {
        fileName: `jornadas-${stamp}.csv`,
        content: buildCsv(
          ['Início', 'Término', 'Veículo', 'Km inicial', 'Km final', 'Distância (km)', 'Viagens', 'Faturamento (R$)', 'Observações'],
          listShifts(db, userId).map((s) => [
            csvDate(s.startedAt), s.endedAt ? csvDate(s.endedAt) : 'Em andamento', s.vehicleName, csvNumber(s.startOdometer),
            s.endOdometer === null ? null : csvNumber(s.endOdometer), s.distanceKm === null ? null : csvNumber(s.distanceKm),
            s.tripCount, csvMoney(s.revenue), s.notes,
          ]),
        ),
      }
    case 'refuelings':
      return {
        fileName: `abastecimentos-${stamp}.csv`,
        content: buildCsv(
          ['Data', 'Veículo', 'Combustível', 'Litros', 'Preço por litro (R$)', 'Valor total (R$)', 'Odômetro (km)', 'Tanque completo', 'Posto', 'Observações'],
          listRefuelings(db, userId, { from: period.from, to: period.to }).map((a) => [
            csvDate(a.refueledAt), a.vehicleName, a.fuel, csvNumber(a.liters, 2), csvMoney(a.pricePerLiter),
            csvMoney(a.totalAmount), csvNumber(a.odometer), yesNo(a.fullTank), a.station, a.notes,
          ]),
        ),
      }
    case 'expenses':
      return {
        fileName: `despesas-${stamp}.csv`,
        content: buildCsv(
          ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor (R$)', 'Veículo', 'Observações'],
          listExpenses(db, userId, period).map((d) => [
            csvDate(d.expenseDate), d.description, d.category, d.kind === 'fixa' ? 'Fixa' : 'Operacional',
            csvMoney(d.amount), d.vehicleName, d.notes,
          ]),
        ),
      }
    case 'report': {
      if (!data.from || !data.to) throw new Error('Período obrigatório para o relatório.')
      const report = generateReport(db, userId, { from: data.from, to: data.to })
      const s = report.summary
      const opt = (v: number | null) => (v === null ? 'n/d' : csvMoney(v))
      const rows: CsvCell[][] = [
        ['Faturamento bruto (R$)', csvMoney(s.grossRevenue)],
        ['Despesas (R$)', csvMoney(s.totalExpenses)],
        ['Abastecimentos (R$)', csvMoney(s.totalRefuelings)],
        ['Resultado de caixa (R$)', csvMoney(s.cashResult)],
        ['Combustível estimado (R$)', opt(s.estimatedFuelCost)],
        ['Lucro operacional estimado (R$)', opt(s.operatingProfit) + (s.profitIsPartial ? ' (parcial)' : '')],
        ['Quilometragem percorrida (km)', csvNumber(s.kmDriven)],
        ['Horas trabalhadas', csvNumber(s.hoursWorked, 2)],
        ['Receita por hora (R$)', opt(s.revenuePerHour)],
        ['Receita por km (R$)', opt(s.revenuePerKm)],
        [],
        ['Plataforma', 'Viagens', 'Faturamento (R$)', 'Distância (km)', 'Receita por km (R$)'],
        ...report.platforms.map((p) => [p.platform, p.trips, csvMoney(p.revenue), csvNumber(p.distanceKm), opt(p.revenuePerKm)]),
        [],
        ['Dia', 'Faturamento (R$)', 'Despesas (R$)'],
        ...report.series.map((d) => [format(new Date(`${d.day}T12:00:00`), 'dd/MM/yyyy'), csvMoney(d.revenue), csvMoney(d.expenses)]),
      ]
      return {
        fileName: `relatorio-${stamp}.csv`,
        content: buildCsv(['Indicador', 'Valor'], rows),
      }
    }
  }
}
