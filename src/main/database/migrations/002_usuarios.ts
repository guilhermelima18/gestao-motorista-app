// Contas de usuário e separação dos dados por usuário.
// Roda com as chaves estrangeiras desligadas (ver `disableForeignKeys`), pois recria `plataformas` e `configuracoes`
// seguindo o procedimento oficial do SQLite para alterar restrições de uma tabela.
// As linhas existentes ficam com usuario_id NULL até o primeiro usuário se cadastrar e adotá-las.
export const MIGRATION_002 = `
CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  celular TEXT,
  senha_hash TEXT NOT NULL,
  codigo_recuperacao_hash TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  tentativas_falhas INTEGER NOT NULL DEFAULT 0,
  bloqueado_ate TEXT,
  ultimo_login_em TEXT,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE TABLE sessoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expira_em TEXT NOT NULL,
  criado_em TEXT NOT NULL
);
CREATE INDEX idx_sessoes_usuario ON sessoes (usuario_id);

ALTER TABLE veiculos ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT;
ALTER TABLE jornadas ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT;
ALTER TABLE viagens ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT;
ALTER TABLE abastecimentos ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT;
ALTER TABLE despesas ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT;
ALTER TABLE metas ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT;

CREATE INDEX idx_veiculos_usuario ON veiculos (usuario_id);
CREATE INDEX idx_jornadas_usuario ON jornadas (usuario_id, inicio_em);
CREATE INDEX idx_viagens_usuario ON viagens (usuario_id, realizada_em);
CREATE INDEX idx_abastecimentos_usuario ON abastecimentos (usuario_id, abastecido_em);
CREATE INDEX idx_despesas_usuario ON despesas (usuario_id, data_despesa);
CREATE INDEX idx_metas_usuario ON metas (usuario_id);

-- Uma jornada aberta por usuário (antes: uma no sistema inteiro).
DROP INDEX idx_jornadas_unica_aberta;
CREATE UNIQUE INDEX idx_jornadas_unica_aberta ON jornadas (usuario_id) WHERE fim_em IS NULL;

-- Nome de plataforma único por usuário (antes: único no sistema inteiro).
CREATE TABLE plataformas_nova (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL COLLATE NOCASE,
  ativa INTEGER NOT NULL DEFAULT 1 CHECK (ativa IN (0, 1)),
  criado_em TEXT NOT NULL,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT,
  UNIQUE (usuario_id, nome)
);
INSERT INTO plataformas_nova (id, nome, ativa, criado_em) SELECT id, nome, ativa, criado_em FROM plataformas;
DROP TABLE plataformas;
ALTER TABLE plataformas_nova RENAME TO plataformas;

-- Configurações por usuário (antes: chave global).
CREATE TABLE configuracoes_nova (
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT,
  chave TEXT NOT NULL,
  valor TEXT,
  atualizado_em TEXT NOT NULL,
  PRIMARY KEY (usuario_id, chave)
);
INSERT INTO configuracoes_nova (chave, valor, atualizado_em) SELECT chave, valor, atualizado_em FROM configuracoes;
DROP TABLE configuracoes;
ALTER TABLE configuracoes_nova RENAME TO configuracoes;
`
