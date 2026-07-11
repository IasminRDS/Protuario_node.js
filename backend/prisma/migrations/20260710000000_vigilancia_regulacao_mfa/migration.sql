-- FASE 6 — Vigilância epidemiológica (SINAN), regulação de vagas e MFA.

-- 1) MFA TOTP no usuário -----------------------------------------------------
ALTER TABLE "usuario" ADD COLUMN "mfa_secret" VARCHAR(64);
ALTER TABLE "usuario" ADD COLUMN "mfa_enabled" BOOLEAN NOT NULL DEFAULT false;

-- 2) Regulação de vagas (parecer do regulador no encaminhamento) --------------
ALTER TABLE "encaminhamento" ADD COLUMN "regulado_por" BIGINT;
ALTER TABLE "encaminhamento" ADD COLUMN "data_regulacao" TIMESTAMP(3);
ALTER TABLE "encaminhamento" ADD COLUMN "parecer_regulacao" TEXT;
ALTER TABLE "encaminhamento" ADD COLUMN "unidade_destino" VARCHAR(200);

CREATE INDEX "encaminhamento_prioridade_idx" ON "encaminhamento"("prioridade");

-- 3) Notificação compulsória (SINAN) ------------------------------------------
CREATE TABLE "notificacao_compulsoria" (
    "id" BIGSERIAL NOT NULL,
    "paciente_id" BIGINT NOT NULL,
    "hospital_id" UUID,
    "origem" VARCHAR(20) NOT NULL,
    "origem_id" VARCHAR(50),
    "cid" VARCHAR(10) NOT NULL,
    "agravo" VARCHAR(200) NOT NULL,
    "imediata" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    "observacoes" TEXT,
    "motivo_descarte" TEXT,
    "criado_por" BIGINT,
    "resolvida_por" BIGINT,
    "resolvida_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notificacao_compulsoria_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notificacao_compulsoria_status_idx" ON "notificacao_compulsoria"("status");
CREATE INDEX "notificacao_compulsoria_cid_idx" ON "notificacao_compulsoria"("cid");
CREATE INDEX "notificacao_compulsoria_hospital_id_idx" ON "notificacao_compulsoria"("hospital_id");
CREATE INDEX "notificacao_compulsoria_created_at_idx" ON "notificacao_compulsoria"("created_at");

ALTER TABLE "notificacao_compulsoria"
  ADD CONSTRAINT "notificacao_compulsoria_paciente_id_fkey"
  FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
