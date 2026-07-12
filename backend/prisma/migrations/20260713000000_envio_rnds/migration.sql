-- FASE 8 — rastreio de envio de registros clínicos à RNDS (item 3).
CREATE TABLE "envio_rnds" (
    "id" BIGSERIAL NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "recurso_tipo" VARCHAR(40) NOT NULL,
    "entity_id" VARCHAR(50) NOT NULL,
    "paciente_id" BIGINT,
    "hospital_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
    "protocolo" VARCHAR(60),
    "mensagem" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviado_em" TIMESTAMP(3),

    CONSTRAINT "envio_rnds_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "envio_rnds_status_idx" ON "envio_rnds"("status");
CREATE INDEX "envio_rnds_paciente_id_idx" ON "envio_rnds"("paciente_id");
CREATE INDEX "envio_rnds_hospital_id_idx" ON "envio_rnds"("hospital_id");

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prontuario_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "envio_rnds" TO prontuario_app;
    GRANT USAGE, SELECT ON SEQUENCE "envio_rnds_id_seq" TO prontuario_app;
  END IF;
END
$$;
