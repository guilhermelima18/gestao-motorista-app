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
    expect(currentVersion(db)).toBe(1)
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

    const next = [...MIGRATIONS, { version: 2, name: 'teste', sql: 'ALTER TABLE veiculos ADD COLUMN cor TEXT;' }]
    let backedUpFrom = 0
    expect(migrate(db, next, (v) => (backedUpFrom = v))).toEqual([2])
    expect(backedUpFrom).toBe(1)
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

  it('impede duas jornadas abertas', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    migrate(db)
    db.prepare("INSERT INTO veiculos (nome, criado_em, atualizado_em) VALUES ('C', 'x', 'x')").run()
    const insert = db.prepare(
      "INSERT INTO jornadas (veiculo_id, inicio_em, quilometragem_inicial, criado_em, atualizado_em) VALUES (1, '2026-01-01T00:00:00.000Z', 10, 'x', 'x')",
    )
    insert.run()
    expect(() => insert.run()).toThrow(/UNIQUE/)
  })
})
