-- MULTI-TENANCY híbrido: Hospital/Unidade + hospital_id nas entidades clínicas.
-- Cidadao (MPI) permanece nacional (sem hospital_id).

CREATE TABLE "hospital" (
  "id"         UUID         NOT NULL,
  "nome"       VARCHAR(200) NOT NULL,
  "cnes"       VARCHAR(20),
  "uf"         CHAR(2),
  "ativo"      BOOLEAN      NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hospital_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "hospital_cnes_key" ON "hospital"("cnes");

CREATE TABLE "unidade" (
  "id"          UUID         NOT NULL,
  "hospital_id" UUID         NOT NULL,
  "nome"        VARCHAR(200) NOT NULL,
  "tipo"        VARCHAR(50),
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "unidade_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "unidade_hospital_id_idx" ON "unidade"("hospital_id");
ALTER TABLE "unidade" ADD CONSTRAINT "unidade_hospital_id_fkey"
  FOREIGN KEY ("hospital_id") REFERENCES "hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hospital padrão (tenant inicial / deployments single-hospital)
INSERT INTO "hospital" ("id", "nome", "updated_at")
VALUES ('00000000-0000-0000-0000-000000000001', 'Hospital Padrão', CURRENT_TIMESTAMP);

-- hospital_id nas entidades (DEFAULT = hospital padrão => backfill dos existentes)
ALTER TABLE "usuario"       ADD COLUMN "hospital_id" UUID DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "paciente"      ADD COLUMN "hospital_id" UUID DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "paciente"      ADD COLUMN "cidadao_id"  UUID;
ALTER TABLE "atendimento"   ADD COLUMN "hospital_id" UUID DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "triagem"       ADD COLUMN "hospital_id" UUID DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "prescricao"    ADD COLUMN "hospital_id" UUID DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "prontuario"    ADD COLUMN "hospital_id" UUID DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "auditoria"     ADD COLUMN "hospital_id" UUID DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "resource_lock" ADD COLUMN "hospital_id" UUID DEFAULT '00000000-0000-0000-0000-000000000001';

-- Índices de isolamento por tenant
CREATE INDEX "usuario_hospital_id_idx"     ON "usuario"("hospital_id");
CREATE INDEX "paciente_hospital_id_idx"    ON "paciente"("hospital_id");
CREATE INDEX "paciente_cidadao_id_idx"     ON "paciente"("cidadao_id");
CREATE INDEX "atendimento_hospital_id_idx" ON "atendimento"("hospital_id");
CREATE INDEX "triagem_hospital_id_idx"     ON "triagem"("hospital_id");
CREATE INDEX "prescricao_hospital_id_idx"  ON "prescricao"("hospital_id");
CREATE INDEX "prontuario_hospital_id_idx"  ON "prontuario"("hospital_id");
CREATE INDEX "auditoria_hospital_id_idx"   ON "auditoria"("hospital_id");

-- FK de usuário -> hospital
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_hospital_id_fkey"
  FOREIGN KEY ("hospital_id") REFERENCES "hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;
