-- FASE 8 — gov.br (OIDC), assinatura digital, hash-chain de auditoria,
-- CBO no profissional e consentimento LGPD.

-- 1) Identidade gov.br no usuário --------------------------------------------
ALTER TABLE "usuario" ADD COLUMN "cpf" VARCHAR(14);
ALTER TABLE "usuario" ADD COLUMN "govbr_selo" VARCHAR(10);
CREATE UNIQUE INDEX "usuario_cpf_key" ON "usuario"("cpf");

-- 2) CBO do profissional ------------------------------------------------------
ALTER TABLE "medico" ADD COLUMN "cbo" VARCHAR(6);

-- 3) Hash-chain de auditoria (ADR-06) ----------------------------------------
ALTER TABLE "auditoria" ADD COLUMN "prev_hash" CHAR(64);
ALTER TABLE "auditoria" ADD COLUMN "hash" CHAR(64);

-- 4) Documento clínico assinado ----------------------------------------------
CREATE TABLE "documento_assinado" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tipo" VARCHAR(30) NOT NULL,
    "paciente_id" BIGINT,
    "hospital_id" UUID,
    "signatario_id" BIGINT,
    "signatario_nome" VARCHAR(200) NOT NULL,
    "signatario_doc" VARCHAR(60),
    "hash_documento" CHAR(64) NOT NULL,
    "assinatura" TEXT NOT NULL,
    "algoritmo" VARCHAR(20) NOT NULL DEFAULT 'RSA-SHA256',
    "emitido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_assinado_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "documento_assinado_paciente_id_idx" ON "documento_assinado"("paciente_id");
CREATE INDEX "documento_assinado_hospital_id_idx" ON "documento_assinado"("hospital_id");

-- 5) Consentimento LGPD versionado -------------------------------------------
CREATE TABLE "consentimento_lgpd" (
    "id" BIGSERIAL NOT NULL,
    "usuario_id" BIGINT,
    "paciente_id" BIGINT,
    "termo_versao" VARCHAR(20) NOT NULL,
    "finalidade" VARCHAR(120) NOT NULL,
    "aceito" BOOLEAN NOT NULL DEFAULT true,
    "ip" VARCHAR(50),
    "registrado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consentimento_lgpd_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "consentimento_lgpd_paciente_id_idx" ON "consentimento_lgpd"("paciente_id");

-- Concede as tabelas novas à role de app (RLS ativo: prontuario_app é NÃO-dona
-- e sem GRANT não enxerga tabelas criadas por esta migration).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prontuario_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "documento_assinado" TO prontuario_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "consentimento_lgpd" TO prontuario_app;
    GRANT USAGE, SELECT ON SEQUENCE "consentimento_lgpd_id_seq" TO prontuario_app;
  END IF;
END
$$;
