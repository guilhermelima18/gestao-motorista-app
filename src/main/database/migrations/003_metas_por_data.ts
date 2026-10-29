// Metas passam a ter uma data de referência (yyyy-MM-dd, horário local): a meta vale para o dia, a semana ou o mês
// que contém essa data, conforme a periodicidade. Isso permite acompanhar metas de dias específicos e manter histórico.
//
// Metas existentes: usa a data que aparece no fim da descrição (ex.: "Meta diária (Quarta-feira) - 21/10/2026");
// sem ela, usa o dia (local) em que a meta foi criada.
export const MIGRATION_003 = `
ALTER TABLE metas ADD COLUMN data_referencia TEXT NOT NULL DEFAULT '';

UPDATE metas SET data_referencia = CASE
  WHEN descricao GLOB '*[0-9][0-9]/[0-9][0-9]/[0-9][0-9][0-9][0-9]'
    THEN substr(descricao, -4) || '-' || substr(descricao, -7, 2) || '-' || substr(descricao, -10, 2)
  ELSE date(criado_em, 'localtime')
END;

CREATE INDEX idx_metas_usuario_data ON metas (usuario_id, data_referencia);
`
