-- ============================================================================
-- C6: identidade de evento de auditoria gerada no SERVIDOR (event_id uuid).
-- Único globalmente, não previsível (gen_random_uuid). Nunca vem do cliente.
--
-- Backfill seguro: a tabela `auditoria` é WORM (trigger bloqueia UPDATE). Para
-- preencher `event_id` das linhas existentes, o trigger é DESABILITADO apenas
-- durante o backfill (op de owner na migração) e reabilitado em seguida.
-- ============================================================================

ALTER TABLE auditoria ADD COLUMN event_id uuid;

ALTER TABLE auditoria DISABLE TRIGGER auditoria_no_update;
UPDATE auditoria SET event_id = gen_random_uuid() WHERE event_id IS NULL;
ALTER TABLE auditoria ENABLE TRIGGER auditoria_no_update;

ALTER TABLE auditoria ALTER COLUMN event_id SET NOT NULL;
ALTER TABLE auditoria ALTER COLUMN event_id SET DEFAULT gen_random_uuid(); -- defesa: raw insert também recebe uuid
ALTER TABLE auditoria ADD CONSTRAINT auditoria_event_id_key UNIQUE (event_id);
