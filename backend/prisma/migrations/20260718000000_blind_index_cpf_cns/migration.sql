-- ============================================================================
-- Blind index para CPF/CNS do Paciente: o identificador passa a ser CIFRADO em
-- repouso (defesa direta contra vazamento de snapshot/backup — ataca a ressalva
-- #1 da auditoria) e a busca/unicidade POR HOSPITAL passa a usar um HMAC
-- determinístico (cpf_bi/cns_bi), não o texto puro.
--
--  * cpf/cns viram VARCHAR(255) para caber o ciphertext AES-256-GCM.
--  * cpf_bi/cns_bi (CHAR(64) = HMAC-SHA256 hex) são preenchidos pela aplicação
--    (BlindIndexService, no middleware do Prisma) a partir do valor em claro.
--  * A @@unique migra de (hospital_id, cpf/cns) para (hospital_id, cpf_bi/cns_bi)
--    — o ciphertext é não-determinístico e não serve para unicidade.
--
-- BACKFILL (dados existentes): linhas antigas ficam com cpf em claro e *_bi NULL
-- até serem reprocessadas. Rode o script de backfill (que tem a chave do blind
-- index e a de cifra) ANTES de depender da busca/unicidade em produção. Em base
-- nova/testes não há dado a migrar. Aditivo e reversível.
-- ============================================================================

-- 1) Alarga as colunas para caber o ciphertext.
ALTER TABLE "paciente" ALTER COLUMN "cpf" TYPE VARCHAR(255);
ALTER TABLE "paciente" ALTER COLUMN "cns" TYPE VARCHAR(255);

-- 2) Colunas de blind index.
ALTER TABLE "paciente" ADD COLUMN "cpf_bi" CHAR(64);
ALTER TABLE "paciente" ADD COLUMN "cns_bi" CHAR(64);

-- 3) Troca a unicidade: de cpf/cns (agora ciphertext) para os índices cegos.
DROP INDEX IF EXISTS "paciente_hospital_id_cpf_key";
DROP INDEX IF EXISTS "paciente_hospital_id_cns_key";
CREATE UNIQUE INDEX "paciente_hospital_id_cpf_bi_key" ON "paciente" ("hospital_id", "cpf_bi");
CREATE UNIQUE INDEX "paciente_hospital_id_cns_bi_key" ON "paciente" ("hospital_id", "cns_bi");
