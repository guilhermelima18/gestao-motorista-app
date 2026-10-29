import { beforeEach, describe, expect, it } from 'vitest'
import { openDatabase } from '../../src/main/database/connection'
import {
  changePassword,
  createSession,
  endUserSessions,
  generateRecoveryCode,
  hashSecret,
  login,
  recoverPassword,
  registerUser,
  resumeSession,
  updateProfile,
  verifySecret,
} from '../../src/main/services/auth'
import type { Db } from '../../src/main/services/common'
import { exportToCsv } from '../../src/main/services/csv'
import { getDashboard } from '../../src/main/services/dashboard'
import { DomainError } from '../../src/main/services/errors'
import { createExpense, deleteExpense, getExpense, listExpenses, updateExpense } from '../../src/main/services/expenses'
import { createGoal, deleteGoal, listGoalProgress, listGoals, updateGoal } from '../../src/main/services/goals'
import { createPlatform, deletePlatform, getPlatform, listPlatforms, updatePlatform } from '../../src/main/services/platforms'
import { createRefueling, deleteRefueling, listRefuelings, updateRefueling } from '../../src/main/services/refuelings'
import { generateReport } from '../../src/main/services/reports'
import { getSettings, saveSetting } from '../../src/main/services/settings'
import { deleteShift, endShift, getOpenShift, getShift, listShifts, startShift, updateShift } from '../../src/main/services/shifts'
import { createTrip, deleteTrip, getTrip, listTrips, updateTrip } from '../../src/main/services/trips'
import { createVehicle, deleteVehicle, getVehicle, listVehicles, updateVehicle } from '../../src/main/services/vehicles'

const PASSWORD = 'senha-segura-1'
const CPF_A = '529.982.247-25'
const CPF_B = '168.995.350-09'

let db: Db

beforeEach(() => {
  db = openDatabase(':memory:')
})

const at = (hour: number, day = 15) => new Date(2026, 0, day, hour, 0, 0).toISOString()

function register(cpf: string, email: string, password = PASSWORD) {
  return registerUser(db, { name: 'Motorista', cpf, email, password, confirmPassword: password })
}

function codeOf(error: unknown): string | undefined {
  return error instanceof DomainError ? error.code : undefined
}

function expectNotFound(fn: () => unknown) {
  try {
    fn()
  } catch (error) {
    expect(codeOf(error)).toBe('NAO_ENCONTRADO')
    return
  }
  throw new Error('Era esperado NAO_ENCONTRADO, mas nada foi lançado.')
}

describe('hash de senha e código de recuperação', () => {
  it('verifica a senha correta e rejeita a errada, com sal diferente a cada hash', () => {
    const a = hashSecret('abc12345')
    const b = hashSecret('abc12345')
    expect(a).not.toBe(b)
    expect(verifySecret('abc12345', a)).toBe(true)
    expect(verifySecret('abc12346', a)).toBe(false)
    expect(verifySecret('abc12345', 'formato-invalido')).toBe(false)
  })

  it('gera código legível de 16 caracteres, sem símbolos ambíguos', () => {
    const codes = new Set(Array.from({ length: 50 }, generateRecoveryCode))
    expect(codes.size).toBe(50)
    for (const code of codes) expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){3}$/)
  })
})

describe('cadastro', () => {
  it('cria a conta sem guardar senha nem código em texto claro', () => {
    const { user, recoveryCode } = register(CPF_A, 'a@teste.com')
    expect(user).toMatchObject({ name: 'Motorista', cpf: '52998224725', email: 'a@teste.com', phone: null })
    const row = db.prepare('SELECT senha_hash, codigo_recuperacao_hash FROM usuarios').get() as Record<string, string>
    expect(row.senha_hash).not.toContain(PASSWORD)
    expect(row.codigo_recuperacao_hash).not.toContain(recoveryCode.replace(/-/g, ''))
  })

  it('valida CPF, senha, confirmação e celular', () => {
    const base = { name: 'X', cpf: CPF_A, email: 'x@teste.com', password: PASSWORD, confirmPassword: PASSWORD }
    expect(() => registerUser(db, { ...base, cpf: '111.111.111-11' })).toThrow(/CPF inválido/)
    expect(() => registerUser(db, { ...base, password: 'curta', confirmPassword: 'curta' })).toThrow(/pelo menos 8/)
    expect(() => registerUser(db, { ...base, confirmPassword: 'outra-senha-1' })).toThrow(/não conferem/)
    expect(() => registerUser(db, { ...base, phone: '123' })).toThrow(/Celular inválido/)
    expect(() => registerUser(db, { ...base, email: 'sem-arroba' })).toThrow(/E-mail inválido/)
    expect(registerUser(db, { ...base, phone: '(11) 98765-4321' }).user.phone).toBe('11987654321')
  })

  it('rejeita CPF e e-mail já cadastrados', () => {
    register(CPF_A, 'a@teste.com')
    try {
      register(CPF_A, 'outro@teste.com')
      throw new Error('deveria falhar')
    } catch (error) {
      expect(codeOf(error)).toBe('CPF_DUPLICADO')
    }
    try {
      register(CPF_B, 'A@TESTE.COM')
      throw new Error('deveria falhar')
    } catch (error) {
      expect(codeOf(error)).toBe('EMAIL_DUPLICADO')
    }
    expect((db.prepare('SELECT COUNT(*) AS n FROM usuarios').get() as { n: number }).n).toBe(1)
  })

  it('o primeiro usuário adota os dados que já existiam; o segundo começa só com Uber e 99', () => {
    db.prepare("INSERT INTO veiculos (id, nome, criado_em, atualizado_em) VALUES (1, 'Antigo', 'x', 'x')").run()
    db.prepare(
      "INSERT INTO jornadas (veiculo_id, inicio_em, quilometragem_inicial, criado_em, atualizado_em) VALUES (1, '2026-01-01T08:00:00.000Z', 5, 'x', 'x')",
    ).run()
    db.prepare("INSERT INTO metas (descricao, tipo, periodicidade, valor_objetivo, criado_em, atualizado_em) VALUES ('M', 'faturamento', 'diaria', 100, 'x', 'x')").run()
    db.prepare("INSERT INTO configuracoes (chave, valor, atualizado_em) VALUES ('tema', 'escuro', 'x')").run()

    const a = register(CPF_A, 'a@teste.com').user
    expect(listVehicles(db, a.id).map((v) => v.name)).toEqual(['Antigo'])
    expect(listShifts(db, a.id)).toHaveLength(1)
    expect(getOpenShift(db, a.id)).not.toBeNull()
    expect(listGoals(db, a.id)).toHaveLength(1)
    expect(getSettings(db, a.id).theme).toBe('escuro')
    expect(listPlatforms(db, a.id).map((p) => p.name).sort()).toEqual(['99', 'Uber'])

    const b = register(CPF_B, 'b@teste.com').user
    expect(listVehicles(db, b.id)).toEqual([])
    expect(listShifts(db, b.id)).toEqual([])
    expect(listGoals(db, b.id)).toEqual([])
    expect(getSettings(db, b.id).theme).toBe('sistema')
    expect(listPlatforms(db, b.id).map((p) => p.name).sort()).toEqual(['99', 'Uber'])
    expect((db.prepare('SELECT COUNT(*) AS n FROM plataformas WHERE usuario_id IS NULL').get() as { n: number }).n).toBe(0)
  })
})

describe('login', () => {
  beforeEach(() => {
    register(CPF_A, 'a@teste.com')
  })

  it('entra com CPF (com ou sem máscara) e senha corretos', () => {
    expect(login(db, { cpf: CPF_A, password: PASSWORD }).email).toBe('a@teste.com')
    expect(login(db, { cpf: '52998224725', password: PASSWORD }).email).toBe('a@teste.com')
  })

  it('usa a mesma mensagem para CPF inexistente e senha errada', () => {
    const messages = [
      () => login(db, { cpf: CPF_B, password: PASSWORD }),
      () => login(db, { cpf: CPF_A, password: 'senha-errada' }),
    ].map((fn) => {
      try {
        fn()
      } catch (error) {
        return (error as Error).message
      }
      return ''
    })
    expect(messages[0]).toBe('CPF ou senha inválidos.')
    expect(messages[1]).toBe(messages[0])
  })

  it('bloqueia por 5 minutos após 5 falhas seguidas, mesmo com a senha certa', () => {
    for (let i = 0; i < 5; i++) expect(() => login(db, { cpf: CPF_A, password: 'errada-123' })).toThrow(/inválidos/)
    try {
      login(db, { cpf: CPF_A, password: PASSWORD })
      throw new Error('deveria estar bloqueado')
    } catch (error) {
      expect(codeOf(error)).toBe('CONTA_BLOQUEADA')
      expect((error as Error).message).toMatch(/5 minuto/)
    }
    // Passado o prazo, o acesso volta.
    db.prepare('UPDATE usuarios SET bloqueado_ate = ?').run(new Date(Date.now() - 1000).toISOString())
    expect(login(db, { cpf: CPF_A, password: PASSWORD }).cpf).toBe('52998224725')
  })

  it('um login correto zera a contagem de falhas', () => {
    for (let i = 0; i < 4; i++) expect(() => login(db, { cpf: CPF_A, password: 'errada-123' })).toThrow()
    login(db, { cpf: CPF_A, password: PASSWORD })
    for (let i = 0; i < 4; i++) expect(() => login(db, { cpf: CPF_A, password: 'errada-123' })).toThrow(/inválidos/)
    expect(login(db, { cpf: CPF_A, password: PASSWORD }).cpf).toBe('52998224725')
  })
})

describe('recuperação e troca de senha', () => {
  it('CPF + código definem nova senha, geram novo código e invalidam o antigo', () => {
    const { user, recoveryCode } = register(CPF_A, 'a@teste.com')
    createSession(db, user.id)

    const recovered = recoverPassword(db, { cpf: CPF_A, recoveryCode: recoveryCode.toLowerCase(), newPassword: 'nova-senha-99', confirmPassword: 'nova-senha-99' })
    expect(recovered.recoveryCode).not.toBe(recoveryCode)
    expect(() => login(db, { cpf: CPF_A, password: PASSWORD })).toThrow(/inválidos/)
    expect(login(db, { cpf: CPF_A, password: 'nova-senha-99' }).id).toBe(user.id)
    expect((db.prepare('SELECT COUNT(*) AS n FROM sessoes').get() as { n: number }).n).toBe(0)

    expect(() => recoverPassword(db, { cpf: CPF_A, recoveryCode, newPassword: 'outra-senha-99', confirmPassword: 'outra-senha-99' })).toThrow(/inválidos/)
    expect(
      recoverPassword(db, { cpf: CPF_A, recoveryCode: recovered.recoveryCode, newPassword: 'mais-uma-99', confirmPassword: 'mais-uma-99' }).recoveryCode,
    ).toBeTruthy()
  })

  it('recuperar também desbloqueia a conta', () => {
    const { recoveryCode } = register(CPF_A, 'a@teste.com')
    for (let i = 0; i < 5; i++) expect(() => login(db, { cpf: CPF_A, password: 'errada-123' })).toThrow()
    recoverPassword(db, { cpf: CPF_A, recoveryCode, newPassword: 'nova-senha-99', confirmPassword: 'nova-senha-99' })
    expect(login(db, { cpf: CPF_A, password: 'nova-senha-99' }).cpf).toBe('52998224725')
  })

  it('não revela se o CPF existe ao recuperar', () => {
    expect(() => recoverPassword(db, { cpf: CPF_B, recoveryCode: 'AAAA-BBBB', newPassword: 'nova-senha-99', confirmPassword: 'nova-senha-99' })).toThrow(
      'CPF ou código de recuperação inválidos.',
    )
  })

  it('troca a senha exigindo a atual', () => {
    const { user } = register(CPF_A, 'a@teste.com')
    expect(() => changePassword(db, user.id, { currentPassword: 'errada-123', newPassword: 'nova-senha-99', confirmPassword: 'nova-senha-99' })).toThrow(/Senha atual incorreta/)
    changePassword(db, user.id, { currentPassword: PASSWORD, newPassword: 'nova-senha-99', confirmPassword: 'nova-senha-99' })
    expect(() => login(db, { cpf: CPF_A, password: PASSWORD })).toThrow()
    expect(login(db, { cpf: CPF_A, password: 'nova-senha-99' }).id).toBe(user.id)
  })

  it('atualiza o perfil e impede e-mail de outra conta', () => {
    const a = register(CPF_A, 'a@teste.com').user
    register(CPF_B, 'b@teste.com')
    expect(updateProfile(db, a.id, { name: 'Novo Nome', email: 'novo@teste.com', phone: '(21) 3333-4444' })).toMatchObject({
      name: 'Novo Nome',
      email: 'novo@teste.com',
      phone: '2133334444',
    })
    expect(() => updateProfile(db, a.id, { name: 'X', email: 'b@teste.com' })).toThrow(/e-mail/)
  })
})

describe('sessões ("Manter conectado")', () => {
  it('retoma a sessão com um token válido e guarda só o hash', () => {
    const { user } = register(CPF_A, 'a@teste.com')
    const token = createSession(db, user.id)
    expect(resumeSession(db, token)?.id).toBe(user.id)
    expect((db.prepare('SELECT token_hash FROM sessoes').get() as { token_hash: string }).token_hash).not.toBe(token)
    expect(resumeSession(db, 'token-desconhecido')).toBeNull()
  })

  it('não retoma sessão expirada nem encerrada', () => {
    const { user } = register(CPF_A, 'a@teste.com')
    const expired = createSession(db, user.id)
    db.prepare('UPDATE sessoes SET expira_em = ?').run(new Date(Date.now() - 1000).toISOString())
    expect(resumeSession(db, expired)).toBeNull()

    const token = createSession(db, user.id)
    expect(resumeSession(db, token)?.id).toBe(user.id)
    endUserSessions(db, user.id)
    expect(resumeSession(db, token)).toBeNull()
  })
})

describe('isolamento entre usuários', () => {
  let a: number
  let b: number

  beforeEach(() => {
    a = register(CPF_A, 'a@teste.com').user.id
    b = register(CPF_B, 'b@teste.com').user.id
  })

  /** Monta um conjunto completo de registros para o usuário. */
  function populate(userId: number, label: string) {
    const vehicle = createVehicle(db, userId, { name: `Carro ${label}`, currentOdometer: 1000 })
    const uber = listPlatforms(db, userId).find((p) => p.name === 'Uber')!
    const shift = startShift(db, userId, { vehicleId: vehicle.id, startOdometer: 1000, startedAt: at(8) })
    const trip = createTrip(db, userId, { shiftId: shift.id, platformId: uber.id, occurredAt: at(9), fareAmount: label === 'A' ? 4000 : 9000, distanceKm: 10 })
    endShift(db, userId, { id: shift.id, endOdometer: 1100, endedAt: at(12) })
    const refueling = createRefueling(db, userId, { vehicleId: vehicle.id, refueledAt: at(7), fuel: 'Gasolina', liters: 10, pricePerLiter: 500, odometer: 1010 })
    const expense = createExpense(db, userId, { description: `Despesa ${label}`, category: 'Pedágio', amount: 700, expenseDate: at(10) })
    const goal = createGoal(db, userId, { description: `Meta ${label}`, type: 'faturamento', period: 'diaria', targetAmount: 10000, referenceDate: '2026-01-15' })
    return { vehicle, uber, shift, trip, refueling, expense, goal }
  }

  it('as listas mostram apenas os dados de cada usuário', () => {
    populate(a, 'A')
    populate(b, 'B')
    expect(listVehicles(db, a).map((v) => v.name)).toEqual(['Carro A'])
    expect(listVehicles(db, b).map((v) => v.name)).toEqual(['Carro B'])
    expect(listShifts(db, a)).toHaveLength(1)
    expect(listTrips(db, a, {}).totals).toEqual({ tripCount: 1, totalRevenue: 4000 })
    expect(listTrips(db, b, {}).totals).toEqual({ tripCount: 1, totalRevenue: 9000 })
    expect(listRefuelings(db, a, {})).toHaveLength(1)
    expect(listExpenses(db, b, {}).map((e) => e.description)).toEqual(['Despesa B'])
    expect(listGoals(db, a).map((g) => g.description)).toEqual(['Meta A'])
    expect(listPlatforms(db, a).every((p) => listPlatforms(db, b).every((q) => q.id !== p.id))).toBe(true)
  })

  it('buscar, editar ou excluir por id de outro usuário retorna NAO_ENCONTRADO', () => {
    const mine = populate(a, 'A')
    const foreign = populate(b, 'B')

    expectNotFound(() => getVehicle(db, a, foreign.vehicle.id))
    expectNotFound(() => updateVehicle(db, a, { id: foreign.vehicle.id, name: 'Roubado' }))
    expectNotFound(() => deleteVehicle(db, a, foreign.vehicle.id))
    expectNotFound(() => getPlatform(db, a, foreign.uber.id))
    expectNotFound(() => updatePlatform(db, a, { id: foreign.uber.id, name: 'X' }))
    expectNotFound(() => deletePlatform(db, a, foreign.uber.id))
    expectNotFound(() => getShift(db, a, foreign.shift.id))
    expectNotFound(() => endShift(db, a, { id: foreign.shift.id, endOdometer: 2000 }))
    expectNotFound(() =>
      updateShift(db, a, { id: foreign.shift.id, startedAt: at(8), endedAt: at(12), startOdometer: 1000, endOdometer: 1100 }),
    )
    expectNotFound(() => deleteShift(db, a, foreign.shift.id))
    expectNotFound(() => getTrip(db, a, foreign.trip.id))
    expectNotFound(() => updateTrip(db, a, { id: foreign.trip.id, shiftId: mine.shift.id, platformId: mine.uber.id, occurredAt: at(9), fareAmount: 1 }))
    expectNotFound(() => deleteTrip(db, a, foreign.trip.id))
    expectNotFound(() => updateRefueling(db, a, { id: foreign.refueling.id, vehicleId: mine.vehicle.id, refueledAt: at(7), fuel: 'Etanol', liters: 1, pricePerLiter: 100, odometer: 1 }))
    expectNotFound(() => deleteRefueling(db, a, foreign.refueling.id))
    expectNotFound(() => getExpense(db, a, foreign.expense.id))
    expectNotFound(() => updateExpense(db, a, { id: foreign.expense.id, description: 'X', category: 'Outros', amount: 1, expenseDate: at(9) }))
    expectNotFound(() => deleteExpense(db, a, foreign.expense.id))
    expectNotFound(() => updateGoal(db, a, { id: foreign.goal.id, description: 'X', type: 'lucro', period: 'mensal', targetAmount: 1, referenceDate: '2026-01-15' }))
    expectNotFound(() => deleteGoal(db, a, foreign.goal.id))

    // Nada do usuário B foi alterado.
    expect(getVehicle(db, b, foreign.vehicle.id).name).toBe('Carro B')
    expect(getTrip(db, b, foreign.trip.id).fareAmount).toBe(9000)
    expect(getShift(db, b, foreign.shift.id).endedAt).not.toBeNull()
  })

  it('vínculos entre registros só aceitam registros do mesmo usuário', () => {
    const mine = populate(a, 'A')
    const foreign = populate(b, 'B')
    const open = startShift(db, a, { vehicleId: mine.vehicle.id, startOdometer: 1100, startedAt: at(14) })

    expectNotFound(() => startShift(db, a, { vehicleId: foreign.vehicle.id, startOdometer: 5000 }))
    expectNotFound(() => createTrip(db, a, { shiftId: foreign.shift.id, platformId: mine.uber.id, occurredAt: at(9), fareAmount: 1000 }))
    expectNotFound(() => createTrip(db, a, { shiftId: open.id, platformId: foreign.uber.id, occurredAt: at(15), fareAmount: 1000 }))
    expectNotFound(() => createRefueling(db, a, { vehicleId: foreign.vehicle.id, refueledAt: at(7), fuel: 'Gasolina', liters: 5, pricePerLiter: 500, odometer: 1 }))
    expectNotFound(() => createRefueling(db, a, { vehicleId: mine.vehicle.id, shiftId: foreign.shift.id, refueledAt: at(9), fuel: 'Gasolina', liters: 5, pricePerLiter: 500, odometer: 1100 }))
    expectNotFound(() => createExpense(db, a, { vehicleId: foreign.vehicle.id, description: 'X', category: 'Outros', amount: 100, expenseDate: at(9) }))
    expectNotFound(() => createExpense(db, a, { shiftId: foreign.shift.id, description: 'X', category: 'Outros', amount: 100, expenseDate: at(9) }))
    expectNotFound(() => saveSetting(db, a, { key: 'veiculo_padrao_id', value: String(foreign.vehicle.id) }))
  })

  it('cada usuário tem a própria jornada aberta e a própria quilometragem', () => {
    const vehicleA = createVehicle(db, a, { name: 'A', currentOdometer: 100 })
    const vehicleB = createVehicle(db, b, { name: 'B', currentOdometer: 50000 })
    const shiftA = startShift(db, a, { vehicleId: vehicleA.id, startOdometer: 100, startedAt: at(8) })
    const shiftB = startShift(db, b, { vehicleId: vehicleB.id, startOdometer: 50000, startedAt: at(8) })
    expect(getOpenShift(db, a)?.id).toBe(shiftA.id)
    expect(getOpenShift(db, b)?.id).toBe(shiftB.id)
    expect(() => startShift(db, a, { vehicleId: vehicleA.id, startOdometer: 100 })).toThrow(/em andamento/)
    expect(() => startShift(db, b, { vehicleId: vehicleB.id, startOdometer: 50000 })).toThrow(/em andamento/)
  })

  it('a edição do período de uma jornada ignora jornadas de outros usuários', () => {
    const vehicleA = createVehicle(db, a, { name: 'A' })
    const vehicleB = createVehicle(db, b, { name: 'B' })
    const shiftA = startShift(db, a, { vehicleId: vehicleA.id, startOdometer: 0, startedAt: at(8) })
    endShift(db, a, { id: shiftA.id, endOdometer: 10, endedAt: at(12) })
    const shiftB = startShift(db, b, { vehicleId: vehicleB.id, startOdometer: 0, startedAt: at(8) })
    endShift(db, b, { id: shiftB.id, endOdometer: 10, endedAt: at(12) })
    expect(updateShift(db, a, { id: shiftA.id, startedAt: at(9), endedAt: at(13), startOdometer: 0, endOdometer: 10 }).startedAt).toBe(at(9))
  })

  it('plataformas e configurações são independentes', () => {
    createPlatform(db, a, { name: 'InDrive' })
    expect(() => createPlatform(db, a, { name: 'indrive' })).toThrow(/Já existe/)
    expect(() => createPlatform(db, b, { name: 'indrive' })).not.toThrow()

    saveSetting(db, a, { key: 'tema', value: 'escuro' })
    saveSetting(db, b, { key: 'tema', value: 'claro' })
    saveSetting(db, a, { key: 'tema', value: 'sistema' })
    expect(getSettings(db, a).theme).toBe('sistema')
    expect(getSettings(db, b).theme).toBe('claro')
  })

  it('painel, metas, relatório e CSV não somam dados de outros usuários', () => {
    populate(a, 'A')
    populate(b, 'B')
    const reference = at(12)

    const dashA = getDashboard(db, a, { period: 'dia', reference })
    const dashB = getDashboard(db, b, { period: 'dia', reference })
    expect(dashA.summary.grossRevenue).toBe(4000)
    expect(dashB.summary.grossRevenue).toBe(9000)
    expect(dashA.summary.totalExpenses).toBe(700)
    expect(dashA.summary.totalRefuelings).toBe(5000)
    expect(dashA.todayRevenue).toBe(4000)
    expect(dashA.monthRevenue).toBe(4000)
    expect(dashA.series.reduce((sum, p) => sum + p.revenue, 0)).toBe(4000)

    expect(listGoalProgress(db, a, new Date(reference))).toHaveLength(1)
    expect(listGoalProgress(db, a, new Date(reference))[0]).toMatchObject({ achieved: 4000, goal: { description: 'Meta A' } })
    expect(listGoalProgress(db, b, new Date(reference))[0]).toMatchObject({ achieved: 9000 })

    const report = generateReport(db, a, { from: at(0, 1), to: at(0, 31) })
    expect(report.platforms).toEqual([{ platform: 'Uber', trips: 1, revenue: 4000, distanceKm: 10, revenuePerKm: 400 }])
    expect(report.expensesByCategory).toEqual([{ category: 'Pedágio', total: 700 }])

    const csvA = exportToCsv(db, a, { entity: 'expenses' }).content
    expect(csvA).toContain('Despesa A')
    expect(csvA).not.toContain('Despesa B')
    expect(exportToCsv(db, a, { entity: 'trips' }).content).not.toContain('90,00')
    expect(exportToCsv(db, a, { entity: 'shifts' }).content).not.toContain('Carro B')
    expect(exportToCsv(db, a, { entity: 'refuelings' }).content).not.toContain('Carro B')
    expect(exportToCsv(db, a, { entity: 'report', from: at(0, 1), to: at(0, 31) }).content).toContain('Faturamento bruto (R$);40,00')
  })

  it('usuário sem dados vê o painel vazio mesmo havendo dados de outros', () => {
    populate(a, 'A')
    const c = register('111.444.777-35', 'c@teste.com').user.id
    const data = getDashboard(db, c, { period: 'dia', reference: at(12) })
    expect(data.hasRecords).toBe(false)
    expect(data.summary.grossRevenue).toBe(0)
    expect(data.openShift).toBeNull()
  })
})
