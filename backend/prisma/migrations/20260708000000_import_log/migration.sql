-- Log de importação CSV (auditoria/LGPD). Tabela normal (modelada no Prisma).
CREATE TABLE IF NOT EXISTS "import_log" (
  "id"           BIGSERIAL   NOT NULL,
  "user_id"      BIGINT      NOT NULL,
  "hospital_id"  UUID,
  "filename"     VARCHAR(255) NOT NULL,
  "file_hash"    VARCHAR(64),
  "total_linhas" INTEGER     NOT NULL,
  "validos"      INTEGER     NOT NULL DEFAULT 0,
  "invalidos"    INTEGER     NOT NULL DEFAULT 0,
  "sucesso"      BOOLEAN     NOT NULL,
  "erros_json"   JSONB,
  "criado_em"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "import_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "import_log_hospital_id_idx" ON "import_log" ("hospital_id");
CREATE INDEX IF NOT EXISTS "import_log_user_id_idx" ON "import_log" ("user_id");
