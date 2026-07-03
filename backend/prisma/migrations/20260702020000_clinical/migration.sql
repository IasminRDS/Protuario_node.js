-- SNPE — FASE 1 clínico: status do paciente, encounters, prescrição, auditoria LGPD, locks.

-- Estado clínico do paciente (FSM)
ALTER TABLE "paciente" ADD COLUMN "status" VARCHAR(30) NOT NULL DEFAULT 'REGISTERED';
CREATE INDEX "paciente_status_idx" ON "paciente"("status");

-- Encounter: fim do atendimento + novo default de status
ALTER TABLE "atendimento" ADD COLUMN "finished_at" TIMESTAMP(3);
ALTER TABLE "atendimento" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- Prescrição: duração
ALTER TABLE "prescricao" ADD COLUMN "duracao" VARCHAR(100);

-- Auditoria LGPD enriquecida
ALTER TABLE "auditoria" ADD COLUMN "entity"    VARCHAR(100);
ALTER TABLE "auditoria" ADD COLUMN "entity_id" VARCHAR(100);
ALTER TABLE "auditoria" ADD COLUMN "device"    VARCHAR(255);
ALTER TABLE "auditoria" ADD COLUMN "reason"    TEXT;
CREATE INDEX "auditoria_entity_entity_id_idx" ON "auditoria"("entity", "entity_id");

-- Lock de recurso (concorrência)
CREATE TABLE "resource_lock" (
  "id"          UUID         NOT NULL,
  "resource"    VARCHAR(50)  NOT NULL,
  "resource_id" VARCHAR(100) NOT NULL,
  "holder_id"   BIGINT       NOT NULL,
  "holder_name" VARCHAR(200) NOT NULL,
  "expires_at"  TIMESTAMP(3) NOT NULL,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "resource_lock_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_lock_resource" ON "resource_lock"("resource", "resource_id");
CREATE INDEX "resource_lock_expires_at_idx" ON "resource_lock"("expires_at");
