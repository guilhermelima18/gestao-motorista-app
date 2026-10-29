import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase } from '../../src/main/database/connection'
import { currentVersion, migrate, MIGRATIONS } from '../../src/main/database/migrations'

const tempFolders: string[] = []
function tempFolder(): string {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'gm-'))
  tempFolders.push(folder)
  return folder
}
afterEach(() => {
  for (const f of tempFolders.splice(0)) fs.rmSync(f, { recursive: true, force: true })
})

describe('migrações', () => {
  it('cria todas as tabelas e as plataformas iniciais', () => {
    const db = openDatabase(':memory:')
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map(
      (t) => t.name,
    )
    for (const t of ['veiculos', 'plataformas', 'jornadas', 'viagens', 'abastecimentos', 'despesas', 'metas', 'configuracoes', 'migracoes']) {
      expect(tables).toContain(t)
    }
    const platforms = db.prepare('SELECT nome FROM plataformas ORDER BY id').all()
    expect(platforms).toEqual([{ nome: 'Uber' }, { nome: '99' }])
    expect(currentVersion(db)).toBe(3)
  })

  it('é idempotente', () => {
    const db = openDatabase(':memory:')
    expect(migrate(db)).toEqual([])
  })

  it('preserva dados ao aplicar uma migração nova e faz backup antes', () => {
    const folder = tempFolder()
    const file = path.join(folder, 'teste.db')
    const db = openDatabase(file)
    db.prepare("INSERT INTO veiculos (nome, criado_em, atualizado_em) VALUES ('Carro', 'x', 'x')").run()

    const next = [...MIGRATIONS, { version: 4, name: 'teste', sql: 'ALTER TABLE veiculos ADD COLUMN cor TEXT;' }]
    let backedUpFrom = 0
    expect(migrate(db, next, (v) => (backedUpFrom = v))).toEqual([4])
    expect(backedUpFrom).toBe(3)
    expect(db.prepare('SELECT nome, cor FROM veiculos').get()).toEqual({ nome: 'Carro', cor: null })
    db.close()
  })

  it('rejeita migração alterada após aplicada', () => {
    const db = openDatabase(':memory:')
    const altered = [{ ...MIGRATIONS[0]!, sql: MIGRATIONS[0]!.sql + '\n-- alterada' }]
    expect(() => migrate(db, altered)).toThrow(/alterada/)
  })

  it('persiste dados após fechar e reabrir o banco', () => {
    const file = path.join(tempFolder(), 'persistencia.db')
    const first = openDatabase(file)
    first.prepare("INSERT INTO veiculos (nome, criado_em, atualizado_em) VALUES ('Gol', 'x', 'x')").run()
    first.close()

    const second = openDatabase(file)
    expect(second.prepare('SELECT nome FROM veiculos').all()).toEqual([{ nome: 'Gol' }])
    second.close()
  })
})

describe('integridade', () => {
  it('mantém chaves estrangeiras ativas', () => {
    const db = openDatabase(':memory:')
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1)
    expect(() =>
      db
        .prepare(
          "INSERT INTO jornadas (veiculo_id, inicio_em, quilometragem_inicial, criado_em, atualizado_em) VALUES (999, 'a', 0, 'x', 'x')",
        )
        .run(),
    ).toThrow(/FOREIGN KEY/)
  })

  function addUser(db: Database.Database, cpf: string): number {
    const result = db
      .prepare(
        "INSERT INTO usuarios (nome, cpf, email, senha_hash, codigo_recuperacao_hash, criado_em, atualizado_em) VALUES ('U', ?, ?, 'h', 'h', 'x', 'x')",
      )
      .run(cpf, `${cpf}@teste.com`)
    return Number(result.lastInsertRowid)
  }

  it('impede duas jornadas abertas do mesmo usuário, mas não de usuários diferentes', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    migrate(db)
    const [a, b] = [addUser(db, '1'), addUser(db, '2')]
    const vehicle = (user: number) =>
      Number(db.prepare("INSERT INTO veiculos (nome, criado_em, atualizado_em, usuario_id) VALUES ('C', 'x', 'x', ?)").run(user).lastInsertRowid)
    const open = (user: number, vehicleId: number) =>
      db
        .prepare(
          "INSERT INTO jornadas (veiculo_id, inicio_em, quilometragem_inicial, criado_em, atualizado_em, usuario_id) VALUES (?, '2026-01-01T00:00:00.000Z', 10, 'x', 'x', ?)",
        )
        .run(vehicleId, user)
    const [va, vb] = [vehicle(a), vehicle(b)]
    open(a, va)
    expect(() => open(a, va)).toThrow(/UNIQUE/)
    expect(() => open(b, vb)).not.toThrow()
  })

  it('permite o mesmo nome de plataforma em usuários diferentes, mas não repetido no mesmo', () => {
    const db = openDatabase(':memory:')
    const [a, b] = [addUser(db, '1'), addUser(db, '2')]
    const insert = db.prepare("INSERT INTO plataformas (nome, criado_em, usuario_id) VALUES (?, 'x', ?)")
    insert.run('InDrive', a)
    expect(() => insert.run('indrive', a)).toThrow(/UNIQUE/)
    expect(() => insert.run('InDrive', b)).not.toThrow()
  })
})

describe('migração 003 (metas por data)', () => {
  it('usa a data do fim da descrição e, sem ela, o dia de criação', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    migrate(db, MIGRATIONS.slice(0, 2))
    const insert = db.prepare(
      "INSERT INTO metas (descricao, tipo, periodicidade, valor_objetivo, criado_em, atualizado_em) VALUES (?, 'faturamento', 'diaria', 100, ?, ?)",
    )
    insert.run('Meta diária (Quarta-feira) - 21/10/2026', '2026-10-22T20:44:19.860Z', 'x')
    insert.run('Meta sem data', '2026-10-22T15:00:00.000Z', 'x')

    expect(migrate(db)).toEqual([3])
    const rows = db.prepare('SELECT descricao, data_referencia FROM metas ORDER BY id').all() as { descricao: string; data_referencia: string }[]
    expect(rows[0]).toEqual({ descricao: 'Meta diária (Quarta-feira) - 21/10/2026', data_referencia: '2026-10-21' })
    expect(rows[1]!.data_referencia).toMatch(/^2026-10-2[23]$/) // dia local de criação (fuso da máquina)
  })
})

describe('migração 002 sobre um banco já em uso', () => {
  it('preserva os dados, as ligações entre eles e as chaves estrangeiras', () => {
    // Banco no estado da versão 1: só a migração 001 aplicada, já com dados.
    const old = new Database(path.join(tempFolder(), 'v1.db'))
    old.pragma('foreign_keys = ON')
    migrate(old, [MIGRATIONS[0]!])
    old.prepare("INSERT INTO veiculos (id, nome, criado_em, atualizado_em) VALUES (7, 'Onix', 'x', 'x')").run()
    old
      .prepare(
        "INSERT INTO jornadas (id, veiculo_id, inicio_em, quilometragem_inicial, criado_em, atualizado_em) VALUES (3, 7, '2026-01-01T08:00:00.000Z', 10, 'x', 'x')",
      )
      .run()
    old
      .prepare(
        "INSERT INTO viagens (jornada_id, plataforma_id, realizada_em, valor_corrida, criado_em, atualizado_em) VALUES (3, 2, '2026-01-01T09:00:00.000Z', 1000, 'x', 'x')",
      )
      .run()
    old.prepare("INSERT INTO configuracoes (chave, valor, atualizado_em) VALUES ('tema', 'escuro', 'x')").run()

    expect(migrate(old, MIGRATIONS.slice(0, 2))).toEqual([2])

    expect(old.pragma('foreign_key_check')).toEqual([])
    expect(old.pragma('foreign_keys', { simple: true })).toBe(1)
    expect(old.prepare('SELECT id, nome, usuario_id FROM plataformas ORDER BY id').all()).toEqual([
      { id: 1, nome: 'Uber', usuario_id: null },
      { id: 2, nome: '99', usuario_id: null },
    ])
    expect(old.prepare('SELECT plataforma_id, jornada_id, usuario_id FROM viagens').all()).toEqual([
      { plataforma_id: 2, jornada_id: 3, usuario_id: null },
    ])
    expect(old.prepare('SELECT chave, valor, usuario_id FROM configuracoes').all()).toEqual([
      { chave: 'tema', valor: 'escuro', usuario_id: null },
    ])
    // As chaves estrangeiras de viagens continuam apontando para as tabelas recriadas.
    expect(() => old.prepare('DELETE FROM plataformas WHERE id = 2').run()).toThrow(/FOREIGN KEY/)
    old.close()
  })
})
