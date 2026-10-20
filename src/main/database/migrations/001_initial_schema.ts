// Esquema inicial. Tabelas e colunas em português (snake_case), valores monetários em centavos.
export const MIGRATION_001 = `
CREATE TABLE veiculos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  marca TEXT,
  modelo TEXT,
  ano INTEGER,
  placa TEXT,
  combustivel_principal TEXT,
  quilometragem_atual REAL CHECK (quilometragem_atual IS NULL OR quilometragem_atual >= 0),
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE TABLE plataformas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE COLLATE NOCASE,
  ativa INTEGER NOT NULL DEFAULT 1 CHECK (ativa IN (0, 1)),
  criado_em TEXT NOT NULL
);

CREATE TABLE jornadas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  veiculo_id INTEGER NOT NULL REFERENCES veiculos(id) ON DELETE RESTRICT,
  inicio_em TEXT NOT NULL,
  fim_em TEXT,
  quilometragem_inicial REAL NOT NULL CHECK (quilometragem_inicial >= 0),
  quilometragem_final REAL,
  observacoes TEXT,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL,
  CHECK (
    (fim_em IS NULL AND quilometragem_final IS NULL)
    OR (fim_em IS NOT NULL AND quilometragem_final IS NOT NULL
        AND quilometragem_final >= quilometragem_inicial AND fim_em > inicio_em)
  )
);
CREATE UNIQUE INDEX idx_jornadas_unica_aberta ON jornadas ((1)) WHERE fim_em IS NULL;
CREATE INDEX idx_jornadas_inicio ON jornadas (inicio_em);
CREATE INDEX idx_jornadas_veiculo ON jornadas (veiculo_id);

CREATE TABLE viagens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jornada_id INTEGER NOT NULL REFERENCES jornadas(id) ON DELETE RESTRICT,
  plataforma_id INTEGER NOT NULL REFERENCES plataformas(id) ON DELETE RESTRICT,
  realizada_em TEXT NOT NULL,
  origem TEXT,
  destino TEXT,
  valor_corrida INTEGER NOT NULL CHECK (valor_corrida >= 0),
  gorjeta INTEGER NOT NULL DEFAULT 0 CHECK (gorjeta >= 0),
  adicionais INTEGER NOT NULL DEFAULT 0 CHECK (adicionais >= 0),
  distancia_km REAL NOT NULL DEFAULT 0 CHECK (distancia_km >= 0),
  duracao_minutos INTEGER NOT NULL DEFAULT 0 CHECK (duracao_minutos >= 0),
  quilometragem_vazia_km REAL NOT NULL DEFAULT 0 CHECK (quilometragem_vazia_km >= 0),
  observacoes TEXT,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);
CREATE INDEX idx_viagens_realizada_em ON viagens (realizada_em);
CREATE INDEX idx_viagens_jornada ON viagens (jornada_id);
CREATE INDEX idx_viagens_plataforma ON viagens (plataforma_id);

CREATE TABLE abastecimentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  veiculo_id INTEGER NOT NULL REFERENCES veiculos(id) ON DELETE RESTRICT,
  jornada_id INTEGER REFERENCES jornadas(id) ON DELETE RESTRICT,
  abastecido_em TEXT NOT NULL,
  combustivel TEXT NOT NULL,
  litros REAL NOT NULL CHECK (litros > 0),
  preco_por_litro INTEGER NOT NULL CHECK (preco_por_litro > 0),
  valor_total INTEGER NOT NULL CHECK (valor_total >= 0),
  quilometragem REAL NOT NULL CHECK (quilometragem >= 0),
  tanque_completo INTEGER NOT NULL DEFAULT 0 CHECK (tanque_completo IN (0, 1)),
  posto TEXT,
  observacoes TEXT,
  criado_em TEXT NOT NULL
);
CREATE INDEX idx_abastecimentos_data ON abastecimentos (abastecido_em);
CREATE INDEX idx_abastecimentos_veiculo ON abastecimentos (veiculo_id, quilometragem);
CREATE INDEX idx_abastecimentos_jornada ON abastecimentos (jornada_id);

CREATE TABLE despesas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  veiculo_id INTEGER REFERENCES veiculos(id) ON DELETE RESTRICT,
  jornada_id INTEGER REFERENCES jornadas(id) ON DELETE RESTRICT,
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN (
    'Combustível','Manutenção','Pneus','Lavagem','Pedágio','Estacionamento',
    'Seguro','IPVA e documentação','Financiamento','Outros')),
  valor INTEGER NOT NULL CHECK (valor >= 0),
  data_despesa TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'operacional' CHECK (tipo IN ('operacional', 'fixa')),
  observacoes TEXT,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);
CREATE INDEX idx_despesas_data ON despesas (data_despesa);
CREATE INDEX idx_despesas_categoria ON despesas (categoria);
CREATE INDEX idx_despesas_veiculo ON despesas (veiculo_id);
CREATE INDEX idx_despesas_jornada ON despesas (jornada_id);

CREATE TABLE metas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  descricao TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('faturamento', 'lucro')),
  periodicidade TEXT NOT NULL CHECK (periodicidade IN ('diaria', 'semanal', 'mensal')),
  valor_objetivo INTEGER NOT NULL CHECK (valor_objetivo > 0),
  ativa INTEGER NOT NULL DEFAULT 1 CHECK (ativa IN (0, 1)),
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE TABLE configuracoes (
  chave TEXT PRIMARY KEY,
  valor TEXT,
  atualizado_em TEXT NOT NULL
);

INSERT INTO plataformas (nome, ativa, criado_em) VALUES
  ('Uber', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('99', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
`
