/** Mantém apenas os dígitos. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

/** Valida CPF pelos dígitos verificadores (rejeita sequências repetidas como 111.111.111-11). */
export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const check = (length: number) => {
    let sum = 0
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i)
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  return check(9) === Number(cpf[9]) && check(10) === Number(cpf[10])
}

/** 12345678909 -> 123.456.789-09 (aceita entrada parcial, para máscara durante a digitação). */
export function formatCpf(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  const parts = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean)
  const head = parts.join('.')
  return d.length > 9 ? `${head}-${d.slice(9)}` : head
}

/** Celular/telefone com DDD: 10 ou 11 dígitos. */
export function isValidPhone(value: string): boolean {
  const d = onlyDigits(value)
  return (d.length === 10 || d.length === 11) && d[0] !== '0' && d[1] !== '0'
}

/** 11987654321 -> (11) 98765-4321 (aceita entrada parcial). */
export function formatPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  const split = d.length > 10 ? 7 : 6
  const head = `(${d.slice(0, 2)}) ${d.slice(2, split)}`
  return d.length > split ? `${head}-${d.slice(split)}` : head
}
