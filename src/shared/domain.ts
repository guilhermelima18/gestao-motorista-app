// Constantes de domínio compartilhadas entre main e renderer.
// Os valores dos enums (ex.: 'operacional', nomes de categorias) são dados persistidos e rótulos da interface, por isso ficam em português.

export const EXPENSE_CATEGORIES = [
  'Combustível',
  'Manutenção',
  'Pneus',
  'Lavagem',
  'Pedágio',
  'Estacionamento',
  'Seguro',
  'IPVA e documentação',
  'Financiamento',
  'Outros',
] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const EXPENSE_KINDS = ['operacional', 'fixa'] as const
export type ExpenseKind = (typeof EXPENSE_KINDS)[number]

export const FUEL_TYPES = ['Gasolina', 'Etanol', 'Diesel', 'GNV', 'Flex', 'Elétrico'] as const

export const GOAL_TYPES = ['faturamento', 'lucro'] as const
export type GoalType = (typeof GOAL_TYPES)[number]

export const GOAL_PERIODS = ['diaria', 'semanal', 'mensal'] as const
export type GoalPeriod = (typeof GOAL_PERIODS)[number]

export const DASHBOARD_PERIODS = ['dia', 'semana', 'mes'] as const
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number]

export const THEMES = ['claro', 'escuro', 'sistema'] as const
export type Theme = (typeof THEMES)[number]
