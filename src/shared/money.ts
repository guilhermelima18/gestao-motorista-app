// Valores monetários são sempre inteiros em centavos. Conversões e formatação ficam aqui.

/** Regra única de arredondamento do sistema: meio centavo arredonda para cima (half-up). */
export function roundCents(value: number): number {
  // O epsilon evita surpresas de ponto flutuante como 1.005 * 100 = 100.49999...
  return Math.round(value + Math.sign(value) * Number.EPSILON * Math.abs(value) * 4)
}

/** Total do abastecimento: litros × preço por litro (em centavos), arredondado ao centavo. */
export function calculateTotalAmount(liters: number, pricePerLiterCents: number): number {
  return roundCents(liters * pricePerLiterCents)
}

/**
 * Converte texto digitado ("12,50", "1.234,56", "12.5", "R$ 3,80") em centavos.
 * Retorna null quando o texto não é um valor monetário válido.
 */
export function parseCents(text: string): number | null {
  const clean = text.replace(/R\$/gi, '').replace(/\s/g, '')
  if (clean === '') return null
  let normalized: string
  if (clean.includes(',')) {
    normalized = clean.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(clean)) {
    normalized = clean.replace(/\./g, '') // separador de milhar
  } else {
    normalized = clean
  }
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null
  return roundCents(Number(normalized) * 100)
}

/** Converte texto numérico pt-BR ("12,5") em número; null se inválido. */
export function parseNumber(text: string): number | null {
  const clean = text.replace(/\s/g, '')
  if (clean === '') return null
  // Sem vírgula, "123.450" é milhar (como a máscara gera); "7.80" é decimal.
  const normalized = clean.includes(',')
    ? clean.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(\.\d{3})+$/.test(clean)
      ? clean.replace(/\./g, '')
      : clean
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null
  return Number(normalized)
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatCurrency(cents: number): string {
  return currencyFormatter.format(cents / 100)
}

/** Valor para campos de edição, no formato da máscara monetária: 123456 -> "R$ 1.234,56". */
export function centsToText(cents: number): string {
  return formatCurrency(cents)
}

export function formatNumber(value: number, digits = 1): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}
