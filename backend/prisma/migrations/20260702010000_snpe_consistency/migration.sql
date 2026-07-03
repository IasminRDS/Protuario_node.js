-- SNPE — camada de consistência de efeito, identidade global e ordenação.

-- Merge determinístico de identidade
ALTER TABLE "cidadao" ADD COLUMN "merged_into" UUID;
CREATE INDEX "cidadao_merged_into_idx" ON "cidadao"("merged_into");

-- Resolução determinística multi-tier (CPF/CNS/DEMO), chave globalmente única
CREATE TABLE "cidadao_identity_key" (
  "key"        TEXT         NOT NULL,
  "kind"       VARCHAR(10)  NOT NULL,
  "cidadao_id" UUID         NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cidadao_identity_key_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "cidadao_identity_key_cidadao_id_idx" ON "cidadao_identity_key"("cidadao_id");

-- Sequência monotônica por agregado
CREATE TABLE "aggregate_sequence" (
  "aggregate_id" UUID    NOT NULL,
  "seq"          INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "aggregate_sequence_pkey" PRIMARY KEY ("aggregate_id")
);

-- Offset de consumidor por agregado (ordered exactly-once)
CREATE TABLE "consumer_offset" (
  "consumer"     VARCHAR(150) NOT NULL,
  "aggregate_id" UUID         NOT NULL,
  "last_seq"     INTEGER      NOT NULL,
  "updated_at"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "consumer_offset_pkey" PRIMARY KEY ("consumer", "aggregate_id")
);
