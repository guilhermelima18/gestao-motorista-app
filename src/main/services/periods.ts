import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfDay,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import type { DashboardPeriod, GoalPeriod } from '@shared/domain'

export interface PeriodBounds {
  /** Início inclusivo (hora local). */
  start: Date
  /** Fim exclusivo (hora local). */
  end: Date
}

/** Limites do dia, da semana (começa na segunda-feira) ou do mês que contém `reference`. */
export function getPeriodBounds(period: DashboardPeriod, reference: Date): PeriodBounds {
  switch (period) {
    case 'dia': {
      const start = startOfDay(reference)
      return { start, end: addDays(start, 1) }
    }
    case 'semana': {
      const start = startOfWeek(reference, { weekStartsOn: 1 })
      return { start, end: addWeeks(start, 1) }
    }
    case 'mes': {
      const start = startOfMonth(reference)
      return { start, end: addMonths(start, 1) }
    }
  }
}

const GOAL_TO_DASHBOARD: Record<GoalPeriod, DashboardPeriod> = {
  diaria: 'dia',
  semanal: 'semana',
  mensal: 'mes',
}

/** yyyy-MM-dd -> meia-noite local desse dia. */
export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year!, month! - 1, day!)
}

/** Período da meta: o dia, a semana (segunda a segunda) ou o mês que contém a data de referência. */
export function getGoalBounds(period: GoalPeriod, referenceDate: string): PeriodBounds {
  return getPeriodBounds(GOAL_TO_DASHBOARD[period], parseLocalDate(referenceDate))
}

export function dayKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

/** Todos os dias (chaves yyyy-MM-dd) do intervalo [start, end). */
export function daysInRange(start: Date, end: Date): string[] {
  return eachDayOfInterval({ start, end: endOfDay(addDays(end, -1)) }).map(dayKey)
}
