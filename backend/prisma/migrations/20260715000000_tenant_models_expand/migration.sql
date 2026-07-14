-- ============================================================================
-- Expande o isolamento AUTOMÁTICO por tenant (TENANT_MODELS / middleware Prisma)
-- para os 4 modelos clínicos de PHI que ficavam de fora e dependiam de filtro
-- manual em cada serviço (fonte do vazamento fechado em c8feab0, e de leaks
-- latentes como internacao.buscarPorId, que fazia findUnique por id sem escopo):
--   Internacao, ExameSolicitado, VacinaAplicada, Cirurgia.
--
-- Internacao/ExameSolicitado/Cirurgia já tinham a coluna hospital_id (nullable);
-- vacina_aplicada não tinha — adicionamos aqui. Em seguida, backfill do
-- hospital_id a partir do paciente dono do registro, para as linhas existentes.
--
-- NOTA (defesa em profundidade — camada RLS): a policy RLS no banco para estas
-- 4 tabelas é um passo posterior. Requer antes refatorar as listas que usam
-- `$transaction([findMany, count])` (internacao.listarAtivas, cirurgia.listar,
-- exames.listar): dentro dessa tx-batch o pin de conexão NÃO seta o GUC
-- `app.hospital_id`, então a policy esconderia todas as linhas (lista vazia em
-- produção sob a role prontuario_app). Aditivo e reversível.
-- ============================================================================

-- 1) Coluna de tenant que faltava em vacina_aplicada.
ALTER TABLE "vacina_aplicada" ADD COLUMN "hospital_id" UUID;

-- 2) Backfill: hospital_id herda do paciente dono do registro.
UPDATE "internacao" t
   SET "hospital_id" = p."hospital_id"
  FROM "paciente" p
 WHERE t."paciente_id" = p."id" AND t."hospital_id" IS NULL;

UPDATE "exame_solicitado" t
   SET "hospital_id" = p."hospital_id"
  FROM "paciente" p
 WHERE t."paciente_id" = p."id" AND t."hospital_id" IS NULL;

UPDATE "vacina_aplicada" t
   SET "hospital_id" = p."hospital_id"
  FROM "paciente" p
 WHERE t."paciente_id" = p."id";

UPDATE "cirurgia" t
   SET "hospital_id" = p."hospital_id"
  FROM "paciente" p
 WHERE t."paciente_id" = p."id" AND t."hospital_id" IS NULL;

-- 3) Índice para o filtro por tenant (agora aplicado em toda query).
CREATE INDEX "vacina_aplicada_hospital_id_idx" ON "vacina_aplicada"("hospital_id");
