-- ============================================================================
-- F0.4 (Peça 1) — TEMPO CAUSAL POR AGREGADO na auditoria.
--
-- Introduz uma sequência monotônica por agregado clínico (chave = entity:entityId),
-- materializando a ordem que hoje só existe implicitamente. NÃO é ordenação
-- global — é per-key monotonic sequence: ∀ agregado A, seq é total e gapless
-- entre eventos committados de A. O lock da linha de sequência serializa
-- concorrentes do MESMO agregado (inclusive entre canal in-tx e autônomo).
--
-- Tabela dedicada (chave TEXTO), distinta da aggregate_sequence do SNPE (uuid).
-- ============================================================================

CREATE TABLE audit_aggregate_sequence (
  aggregate_key text PRIMARY KEY,
  seq           bigint NOT NULL DEFAULT 0
);

ALTER TABLE auditoria ADD COLUMN aggregate_seq bigint;

-- Backfill determinístico das linhas existentes (ordem por id dentro do agregado).
ALTER TABLE auditoria DISABLE TRIGGER auditoria_no_update;

UPDATE auditoria a
SET aggregate_seq = s.rn
FROM (
  SELECT id, row_number() OVER (PARTITION BY entity, entity_id ORDER BY id) AS rn
  FROM auditoria
  WHERE entity IS NOT NULL AND entity_id IS NOT NULL
) s
WHERE a.id = s.id;

ALTER TABLE auditoria ENABLE TRIGGER auditoria_no_update;

-- Semeia a tabela de sequência com o maior seq por agregado já existente.
INSERT INTO audit_aggregate_sequence (aggregate_key, seq)
SELECT entity || ':' || entity_id, max(aggregate_seq)
FROM auditoria
WHERE entity IS NOT NULL AND entity_id IS NOT NULL
GROUP BY entity, entity_id;

CREATE INDEX auditoria_aggregate_idx ON auditoria (entity, entity_id, aggregate_seq);
