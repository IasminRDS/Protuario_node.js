-- SNPE — migration inicial (schema completo, recriável do zero).
-- Autoria manual alinhada ao schema.prisma. Aplicada por `prisma migrate deploy`.

-- ========================= SEGURANÇA / ACESSO =========================
CREATE TABLE "perfil" (
  "id"         BIGSERIAL   NOT NULL,
  "nome"       VARCHAR(100) NOT NULL,
  "descricao"  TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "perfil_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "perfil_nome_key" ON "perfil"("nome");

CREATE TABLE "usuario" (
  "id"                 BIGSERIAL    NOT NULL,
  "nome"               VARCHAR(200) NOT NULL,
  "login"              VARCHAR(100) NOT NULL,
  "senha"              VARCHAR(255) NOT NULL,
  "email"              VARCHAR(200),
  "perfil_id"          BIGINT       NOT NULL,
  "ativo"              BOOLEAN      NOT NULL DEFAULT true,
  "refresh_token_hash" VARCHAR(255),
  "login_attempts"     INTEGER      NOT NULL DEFAULT 0,
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMP(3) NOT NULL,
  "deleted_at"         TIMESTAMP(3),
  "created_by"         BIGINT,
  "updated_by"         BIGINT,
  "deleted_by"         BIGINT,
  CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "usuario_login_key" ON "usuario"("login");
CREATE INDEX "usuario_nome_idx" ON "usuario"("nome");
CREATE INDEX "usuario_deleted_at_idx" ON "usuario"("deleted_at");

-- ========================= CADASTRO / PACIENTE =========================
CREATE TABLE "paciente" (
  "id"              BIGSERIAL    NOT NULL,
  "nome"            VARCHAR(250) NOT NULL,
  "cpf"             VARCHAR(14),
  "cns"             VARCHAR(30),
  "sexo"            CHAR(1)      NOT NULL,
  "data_nascimento" DATE         NOT NULL,
  "telefone"        VARCHAR(20),
  "email"           VARCHAR(200),
  "endereco"        TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,
  "deleted_at"      TIMESTAMP(3),
  "created_by"      BIGINT,
  "updated_by"      BIGINT,
  "deleted_by"      BIGINT,
  CONSTRAINT "paciente_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "paciente_cpf_key" ON "paciente"("cpf");
CREATE UNIQUE INDEX "paciente_cns_key" ON "paciente"("cns");
CREATE INDEX "paciente_nome_idx" ON "paciente"("nome");
CREATE INDEX "paciente_deleted_at_idx" ON "paciente"("deleted_at");

-- ========================= ATENDIMENTO =========================
CREATE TABLE "agenda" (
  "id"              BIGSERIAL    NOT NULL,
  "paciente_id"     BIGINT       NOT NULL,
  "profissional_id" BIGINT       NOT NULL,
  "data"            DATE         NOT NULL,
  "hora"            TIME         NOT NULL,
  "status"          VARCHAR(30)  NOT NULL DEFAULT 'AGENDADA',
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,
  "deleted_at"      TIMESTAMP(3),
  CONSTRAINT "agenda_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_agenda_profissional_horario" ON "agenda"("profissional_id", "data", "hora");
CREATE INDEX "agenda_data_idx" ON "agenda"("data");

CREATE TABLE "atendimento" (
  "id"          BIGSERIAL    NOT NULL,
  "paciente_id" BIGINT       NOT NULL,
  "medico_id"   BIGINT       NOT NULL,
  "data"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tipo"        VARCHAR(50)  NOT NULL,
  "status"      VARCHAR(30)  NOT NULL DEFAULT 'EM_ANDAMENTO',
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  "deleted_at"  TIMESTAMP(3),
  CONSTRAINT "atendimento_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "atendimento_data_idx" ON "atendimento"("data");
CREATE INDEX "atendimento_status_idx" ON "atendimento"("status");
CREATE INDEX "atendimento_paciente_id_idx" ON "atendimento"("paciente_id");

CREATE TABLE "triagem" (
  "id"             BIGSERIAL    NOT NULL,
  "paciente_id"    BIGINT       NOT NULL,
  "atendimento_id" BIGINT,
  "temperatura"    DECIMAL(4,1),
  "pressao"        VARCHAR(20),
  "peso"           DECIMAL(5,2),
  "altura"         DECIMAL(4,2),
  "saturacao"      DECIMAL(5,2),
  "frequencia"     INTEGER,
  "classificacao"  VARCHAR(30),
  "observacoes"    TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "triagem_pkey" PRIMARY KEY ("id")
);

-- ========================= ASSISTENCIAL =========================
CREATE TABLE "prontuario" (
  "id"             BIGSERIAL    NOT NULL,
  "atendimento_id" BIGINT       NOT NULL,
  "paciente_id"    BIGINT       NOT NULL,
  "evolucao"       TEXT,
  "diagnostico"    TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "prontuario_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "prontuario_paciente_id_idx" ON "prontuario"("paciente_id");

CREATE TABLE "prescricao" (
  "id"             BIGSERIAL    NOT NULL,
  "atendimento_id" BIGINT       NOT NULL,
  "medicamento"    VARCHAR(250) NOT NULL,
  "dosagem"        VARCHAR(100),
  "frequencia"     VARCHAR(100),
  "observacoes"    TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "prescricao_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exame" (
  "id"               BIGSERIAL    NOT NULL,
  "atendimento_id"   BIGINT       NOT NULL,
  "nome"             VARCHAR(200) NOT NULL,
  "resultado"        TEXT,
  "status"           VARCHAR(30)  NOT NULL DEFAULT 'SOLICITADO',
  "data_solicitacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "data_resultado"   TIMESTAMP(3),
  CONSTRAINT "exame_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "exame_status_idx" ON "exame"("status");

CREATE TABLE "internacao" (
  "id"          BIGSERIAL    NOT NULL,
  "paciente_id" BIGINT       NOT NULL,
  "leito"       VARCHAR(20)  NOT NULL,
  "entrada"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "alta"        TIMESTAMP(3),
  "status"      VARCHAR(30)  NOT NULL DEFAULT 'ATIVA',
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "internacao_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "internacao_status_idx" ON "internacao"("status");

CREATE TABLE "vacinacao" (
  "id"              BIGSERIAL    NOT NULL,
  "paciente_id"     BIGINT       NOT NULL,
  "vacina"          VARCHAR(150) NOT NULL,
  "lote"            VARCHAR(100) NOT NULL,
  "data_aplicacao"  DATE         NOT NULL,
  "profissional_id" BIGINT       NOT NULL,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vacinacao_pkey" PRIMARY KEY ("id")
);

-- ========================= LOGÍSTICA =========================
CREATE TABLE "produto" (
  "id"         BIGSERIAL     NOT NULL,
  "codigo"     VARCHAR(50)   NOT NULL,
  "descricao"  VARCHAR(250)  NOT NULL,
  "unidade"    VARCHAR(20)   NOT NULL,
  "estoque"    DECIMAL(12,3) NOT NULL DEFAULT 0,
  "validade"   DATE,
  "created_at" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3)  NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "produto_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "produto_codigo_key" ON "produto"("codigo");

CREATE TABLE "movimentacao_estoque" (
  "id"             BIGSERIAL     NOT NULL,
  "produto_id"     BIGINT        NOT NULL,
  "usuario_id"     BIGINT        NOT NULL,
  "tipo"           VARCHAR(20)   NOT NULL,
  "quantidade"     DECIMAL(12,3) NOT NULL,
  "data_movimento" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "movimentacao_estoque_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "movimentacao_estoque_produto_id_idx" ON "movimentacao_estoque"("produto_id");

-- ========================= AUDITORIA =========================
CREATE TABLE "auditoria" (
  "id"         BIGSERIAL    NOT NULL,
  "usuario_id" BIGINT,
  "modulo"     VARCHAR(100) NOT NULL,
  "operacao"   VARCHAR(100) NOT NULL,
  "objeto"     VARCHAR(200),
  "resultado"  VARCHAR(50),
  "ip"         VARCHAR(50),
  "data_evento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "auditoria_usuario_id_idx" ON "auditoria"("usuario_id");
CREATE INDEX "auditoria_data_evento_idx" ON "auditoria"("data_evento");
CREATE INDEX "auditoria_modulo_idx" ON "auditoria"("modulo");

-- ========================= SNPE — MPI =========================
CREATE TABLE "cidadao" (
  "id"              UUID         NOT NULL,
  "cpf"             VARCHAR(14),
  "cns"             VARCHAR(30),
  "nome"            VARCHAR(250) NOT NULL,
  "nome_mae"        VARCHAR(250),
  "data_nascimento" DATE         NOT NULL,
  "sexo"            CHAR(1),
  "status"          VARCHAR(20)  NOT NULL DEFAULT 'ATIVO',
  "fingerprint"     TEXT         NOT NULL,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cidadao_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cidadao_cpf_key" ON "cidadao"("cpf");
CREATE UNIQUE INDEX "cidadao_fingerprint_key" ON "cidadao"("fingerprint");
CREATE INDEX "cidadao_nome_data_nascimento_idx" ON "cidadao"("nome", "data_nascimento");
CREATE INDEX "cidadao_cns_idx" ON "cidadao"("cns");

-- ========================= SNPE — OUTBOX =========================
CREATE TABLE "outbox_event" (
  "id"            UUID         NOT NULL,
  "aggregate_id"  UUID         NOT NULL,
  "type"          VARCHAR(150) NOT NULL,
  "payload"       JSONB        NOT NULL,
  "partition_key" VARCHAR(100) NOT NULL,
  "status"        VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
  "attempts"      INTEGER      NOT NULL DEFAULT 0,
  "available_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimed_at"    TIMESTAMP(3),
  "last_error"    TEXT,
  "sent_at"       TIMESTAMP(3),
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "outbox_event_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "outbox_event_status_available_at_idx" ON "outbox_event"("status", "available_at");
CREATE INDEX "outbox_event_aggregate_id_idx" ON "outbox_event"("aggregate_id");
CREATE INDEX "outbox_event_created_at_idx" ON "outbox_event"("created_at");

-- ========================= SNPE — IDEMPOTÊNCIA =========================
CREATE TABLE "processed_event" (
  "consumer"     VARCHAR(150) NOT NULL,
  "event_id"     UUID         NOT NULL,
  "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "processed_event_pkey" PRIMARY KEY ("consumer", "event_id")
);

-- ========================= CHAVES ESTRANGEIRAS =========================
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_perfil_id_fkey"
  FOREIGN KEY ("perfil_id") REFERENCES "perfil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "agenda" ADD CONSTRAINT "agenda_paciente_id_fkey"
  FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agenda" ADD CONSTRAINT "agenda_profissional_id_fkey"
  FOREIGN KEY ("profissional_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "atendimento" ADD CONSTRAINT "atendimento_paciente_id_fkey"
  FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "atendimento" ADD CONSTRAINT "atendimento_medico_id_fkey"
  FOREIGN KEY ("medico_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "triagem" ADD CONSTRAINT "triagem_paciente_id_fkey"
  FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "triagem" ADD CONSTRAINT "triagem_atendimento_id_fkey"
  FOREIGN KEY ("atendimento_id") REFERENCES "atendimento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "prontuario" ADD CONSTRAINT "prontuario_atendimento_id_fkey"
  FOREIGN KEY ("atendimento_id") REFERENCES "atendimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "prontuario" ADD CONSTRAINT "prontuario_paciente_id_fkey"
  FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "prescricao" ADD CONSTRAINT "prescricao_atendimento_id_fkey"
  FOREIGN KEY ("atendimento_id") REFERENCES "atendimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "exame" ADD CONSTRAINT "exame_atendimento_id_fkey"
  FOREIGN KEY ("atendimento_id") REFERENCES "atendimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "internacao" ADD CONSTRAINT "internacao_paciente_id_fkey"
  FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vacinacao" ADD CONSTRAINT "vacinacao_paciente_id_fkey"
  FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vacinacao" ADD CONSTRAINT "vacinacao_profissional_id_fkey"
  FOREIGN KEY ("profissional_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "movimentacao_estoque" ADD CONSTRAINT "movimentacao_estoque_produto_id_fkey"
  FOREIGN KEY ("produto_id") REFERENCES "produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "movimentacao_estoque" ADD CONSTRAINT "movimentacao_estoque_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
