-- ============================================================================
-- RELATÓRIOS — MATERIALIZED VIEWS (leitura performática, agregação pré-computada)
--
-- Convenções deste projeto:
--   * Tudo isolado por tenant: cada view agrega por hospital_id (o endpoint
--     filtra pelo hospital do token — sem vazamento cross-tenant).
--   * "atualizado_em" = now() é avaliado no INSTANTE do refresh (timestamp da
--     transação de REFRESH), servindo como marcador de última atualização.
--   * Índice ÚNICO em cada view: obrigatório para REFRESH ... CONCURRENTLY.
--   * Criadas WITH DATA (default) → já populadas → CONCURRENTLY funciona desde
--     o primeiro refresh.
--   * Idempotente: IF NOT EXISTS em views/índices/extensão.
-- ============================================================================

-- 1) atendimentos_por_dia -----------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS atendimentos_por_dia AS
SELECT
  a.hospital_id,
  date(a."data")            AS dia,
  count(*)::bigint          AS total_atendimentos,
  now()                     AS atualizado_em
FROM atendimento a
WHERE a.deleted_at IS NULL
  AND a.hospital_id IS NOT NULL
GROUP BY a.hospital_id, date(a."data");

CREATE UNIQUE INDEX IF NOT EXISTS ux_atendimentos_por_dia
  ON atendimentos_por_dia (hospital_id, dia);

-- 2) ocupacao_leitos ----------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS ocupacao_leitos AS
SELECT
  l.hospital_id,
  count(*) FILTER (WHERE l.status = 'ocupado')::bigint AS ocupados,
  count(*) FILTER (WHERE l.status = 'livre')::bigint   AS livres,
  count(*)::bigint                                     AS total,
  COALESCE(
    round(
      count(*) FILTER (WHERE l.status = 'ocupado')::numeric
        / NULLIF(count(*), 0) * 100,
      2
    ),
    0
  )                                                    AS taxa_ocupacao,
  now()                                                AS atualizado_em
FROM leito l
WHERE l.ativo = true
  AND l.hospital_id IS NOT NULL
GROUP BY l.hospital_id;

CREATE UNIQUE INDEX IF NOT EXISTS ux_ocupacao_leitos
  ON ocupacao_leitos (hospital_id);

-- 3) tempo_medio_atendimento --------------------------------------------------
-- Média (minutos) do intervalo início("data") → fim(finished_at). Só considera
-- atendimentos FINALIZADOS (finished_at NOT NULL), evitando distorção por NULL.
CREATE MATERIALIZED VIEW IF NOT EXISTS tempo_medio_atendimento AS
SELECT
  a.hospital_id,
  count(*)::bigint AS total_atendimentos,
  COALESCE(
    round(avg(EXTRACT(EPOCH FROM (a.finished_at - a."data")) / 60.0)::numeric, 1),
    0
  )                AS media_minutos,
  now()            AS atualizado_em
FROM atendimento a
WHERE a.finished_at IS NOT NULL
  AND a.deleted_at IS NULL
  AND a.hospital_id IS NOT NULL
GROUP BY a.hospital_id;

CREATE UNIQUE INDEX IF NOT EXISTS ux_tempo_medio_atendimento
  ON tempo_medio_atendimento (hospital_id);

-- 4) exames_realizados --------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS exames_realizados AS
SELECT
  e.hospital_id,
  t.codigo,
  t.nome            AS tipo_exame,
  count(*)::bigint  AS total,
  now()             AS atualizado_em
FROM exame_solicitado e
JOIN tipo_exame t ON t.id = e.tipo_exame_id
WHERE e.hospital_id IS NOT NULL
GROUP BY e.hospital_id, t.codigo, t.nome;

CREATE UNIQUE INDEX IF NOT EXISTS ux_exames_realizados
  ON exames_realizados (hospital_id, codigo);

-- ============================================================================
-- REFRESH AUTOMÁTICO (pg_cron a cada 5 min)
--
-- IMPORTANTE: REFRESH MATERIALIZED VIEW CONCURRENTLY NÃO pode rodar dentro de
-- função/bloco transacional/multi-command → agenda-se UM job por view, cada um
-- com um único statement.
--
-- pg_cron não está disponível em toda instalação (ex.: postgres:alpine, alguns
-- managed). O bloco abaixo é DEFENSIVO: se a extensão não existir, apenas emite
-- um NOTICE e a aplicação assume o refresh (@Interval no ReportsRefreshService).
-- ============================================================================
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;

  PERFORM cron.schedule('refresh_atendimentos_por_dia', '*/5 * * * *',
    'REFRESH MATERIALIZED VIEW CONCURRENTLY atendimentos_por_dia');
  PERFORM cron.schedule('refresh_ocupacao_leitos', '*/5 * * * *',
    'REFRESH MATERIALIZED VIEW CONCURRENTLY ocupacao_leitos');
  PERFORM cron.schedule('refresh_tempo_medio_atendimento', '*/5 * * * *',
    'REFRESH MATERIALIZED VIEW CONCURRENTLY tempo_medio_atendimento');
  PERFORM cron.schedule('refresh_exames_realizados', '*/5 * * * *',
    'REFRESH MATERIALIZED VIEW CONCURRENTLY exames_realizados');

  RAISE NOTICE 'pg_cron configurado: refresh das MVs de relatório a cada 5 min.';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron indisponível (%). O refresh será feito pela aplicação (ReportsRefreshService @Interval).', SQLERRM;
END $$;
