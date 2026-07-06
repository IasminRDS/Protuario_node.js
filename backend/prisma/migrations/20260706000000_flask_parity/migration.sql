-- NOTA: objetos gerenciados por SQL cru (fora do modelo Prisma) foram
-- preservados nesta migração aditiva: o índice "auditoria_aggregate_idx"
-- (ordem causal, mig. 20260704230000) e a tabela "idempotency_keys"
-- (mig. 20260704210000, usada pelo IdempotencyInterceptor via ON CONFLICT).
-- O "prisma migrate diff" tentou removê-los por não estarem no schema.prisma;
-- os DROPs foram intencionalmente retirados para não quebrar essas features.

-- AlterTable
ALTER TABLE "internacao" ADD COLUMN     "aih_numero" VARCHAR(20),
ADD COLUMN     "cid_alta" VARCHAR(10),
ADD COLUMN     "cid_principal" VARCHAR(10),
ADD COLUMN     "data_prevista_alta" TIMESTAMP(3),
ADD COLUMN     "hipotese_diag" VARCHAR(200),
ADD COLUMN     "hospital_id" UUID,
ADD COLUMN     "leito_id" BIGINT,
ADD COLUMN     "medico_id" BIGINT,
ADD COLUMN     "motivo" TEXT,
ADD COLUMN     "observacoes" TEXT,
ADD COLUMN     "sumario_alta" TEXT,
ADD COLUMN     "tipo" VARCHAR(30) NOT NULL DEFAULT 'clinica',
ADD COLUMN     "tipo_alta" VARCHAR(30);

-- AlterTable
ALTER TABLE "paciente" ADD COLUMN     "alergias" TEXT,
ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "bairro" VARCHAR(100),
ADD COLUMN     "cep" VARCHAR(9),
ADD COLUMN     "complemento" VARCHAR(100),
ADD COLUMN     "logradouro" VARCHAR(200),
ADD COLUMN     "municipio" VARCHAR(100),
ADD COLUMN     "municipio_ibge" VARCHAR(7),
ADD COLUMN     "nome_mae" VARCHAR(150),
ADD COLUMN     "nome_pai" VARCHAR(150),
ADD COLUMN     "nome_social" VARCHAR(150),
ADD COLUMN     "numero" VARCHAR(10),
ADD COLUMN     "observacoes" TEXT,
ADD COLUMN     "raca_cor" VARCHAR(20),
ADD COLUMN     "rg" VARCHAR(20),
ADD COLUMN     "telefone2" VARCHAR(20),
ADD COLUMN     "tipo_sanguineo" VARCHAR(5),
ADD COLUMN     "uf" VARCHAR(2);

-- AlterTable
ALTER TABLE "prontuario" ADD COLUMN     "altura" DECIMAL(4,2),
ADD COLUMN     "assinado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "assinado_em" TIMESTAMP(3),
ADD COLUMN     "avaliacao" TEXT,
ADD COLUMN     "cid_principal" VARCHAR(10),
ADD COLUMN     "cid_secundario" VARCHAR(10),
ADD COLUMN     "encaminhamento_texto" TEXT,
ADD COLUMN     "frequencia_cardiaca" INTEGER,
ADD COLUMN     "frequencia_respiratoria" INTEGER,
ADD COLUMN     "glicemia" DECIMAL(6,1),
ADD COLUMN     "medico_id" BIGINT,
ADD COLUMN     "objetivo" TEXT,
ADD COLUMN     "peso" DECIMAL(5,2),
ADD COLUMN     "plano" TEXT,
ADD COLUMN     "prescricao_texto" TEXT,
ADD COLUMN     "pressao_arterial" VARCHAR(10),
ADD COLUMN     "retorno_dias" INTEGER,
ADD COLUMN     "saturacao_o2" DECIMAL(5,2),
ADD COLUMN     "subjetivo" TEXT,
ADD COLUMN     "temperatura" DECIMAL(4,1);

-- AlterTable
ALTER TABLE "triagem" ADD COLUMN     "agendamento_id" BIGINT,
ADD COLUMN     "discriminadores" TEXT,
ADD COLUMN     "dor_escala" INTEGER,
ADD COLUMN     "frequencia_respiratoria" INTEGER,
ADD COLUMN     "glicemia" DECIMAL(6,1),
ADD COLUMN     "queixa_principal" VARCHAR(200),
ADD COLUMN     "realizado_por" BIGINT,
ADD COLUMN     "status_triagem" VARCHAR(20) NOT NULL DEFAULT 'aguardando';

-- AlterTable
ALTER TABLE "unidade" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cidade" VARCHAR(80),
ADD COLUMN     "cnes" VARCHAR(20),
ADD COLUMN     "uf" CHAR(2);

-- CreateTable
CREATE TABLE "medico" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "crm" VARCHAR(20) NOT NULL,
    "especialidade" VARCHAR(100),
    "hospital_id" UUID,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regional" (
    "id" BIGSERIAL NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "codigo" VARCHAR(50),
    "uf" CHAR(2),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setor" (
    "id" BIGSERIAL NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "sigla" VARCHAR(10),
    "tipo" VARCHAR(30) NOT NULL DEFAULT 'enfermaria',
    "andar" VARCHAR(10),
    "responsavel" VARCHAR(100),
    "hospital_id" UUID,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "setor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leito" (
    "id" BIGSERIAL NOT NULL,
    "setor_id" BIGINT NOT NULL,
    "hospital_id" UUID,
    "numero" VARCHAR(20) NOT NULL,
    "tipo" VARCHAR(30),
    "status" VARCHAR(20) NOT NULL DEFAULT 'livre',
    "observacoes" VARCHAR(200),
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "leito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evolucao_internacao" (
    "id" BIGSERIAL NOT NULL,
    "internacao_id" BIGINT NOT NULL,
    "profissional_id" BIGINT,
    "tipo" VARCHAR(20) NOT NULL DEFAULT 'medica',
    "pressao_arterial" VARCHAR(10),
    "temperatura" DECIMAL(4,1),
    "frequencia_cardiaca" INTEGER,
    "frequencia_respiratoria" INTEGER,
    "saturacao_o2" DECIMAL(5,2),
    "diurese_ml" INTEGER,
    "balanco_hidrico" INTEGER,
    "subjetivo" TEXT,
    "objetivo" TEXT,
    "avaliacao" TEXT,
    "plano" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evolucao_internacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipo_exame" (
    "id" BIGSERIAL NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "categoria" VARCHAR(50),
    "instrucoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tipo_exame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exame_solicitado" (
    "id" BIGSERIAL NOT NULL,
    "paciente_id" BIGINT NOT NULL,
    "tipo_exame_id" BIGINT NOT NULL,
    "prontuario_id" BIGINT,
    "medico_id" BIGINT,
    "hospital_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'solicitado',
    "urgencia" VARCHAR(10) NOT NULL DEFAULT 'rotina',
    "indicacao_clinica" TEXT,
    "observacoes" TEXT,
    "resultado_texto" TEXT,
    "resultado_valor" VARCHAR(100),
    "resultado_unidade" VARCHAR(30),
    "valor_referencia" VARCHAR(100),
    "interpretacao" VARCHAR(20),
    "data_solicitacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_coleta" TIMESTAMP(3),
    "data_resultado" TIMESTAMP(3),
    "criado_por" BIGINT,

    CONSTRAINT "exame_solicitado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogo_exame" (
    "id" BIGSERIAL NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "codigo" VARCHAR(30) NOT NULL,
    "grupo" VARCHAR(80),
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "catalogo_exame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogo_vacina" (
    "id" BIGSERIAL NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "codigo" VARCHAR(30) NOT NULL,
    "doses" VARCHAR(80),
    "faixa" VARCHAR(120),
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "catalogo_vacina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vacina" (
    "id" BIGSERIAL NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "sigla" VARCHAR(50),
    "doses_total" INTEGER NOT NULL DEFAULT 1,
    "intervalo_dias" INTEGER,
    "fabricante" VARCHAR(120),
    "lote" VARCHAR(60),
    "validade" DATE,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "vacina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vacina_aplicada" (
    "id" BIGSERIAL NOT NULL,
    "paciente_id" BIGINT NOT NULL,
    "vacina_id" BIGINT,
    "nome_vacina" VARCHAR(120),
    "dose" VARCHAR(40),
    "data_aplicacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unidade" VARCHAR(120),
    "profissional" VARCHAR(120),
    "observacao" TEXT,

    CONSTRAINT "vacina_aplicada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicamento" (
    "id" BIGSERIAL NOT NULL,
    "nome_generico" VARCHAR(150) NOT NULL,
    "nome_comercial" VARCHAR(150),
    "classe" VARCHAR(100),
    "apresentacao" VARCHAR(100),
    "via_admin" VARCHAR(50),
    "controlado" BOOLEAN NOT NULL DEFAULT false,
    "lista_rename" VARCHAR(10),
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "medicamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescricao_ambulatorial" (
    "id" BIGSERIAL NOT NULL,
    "paciente_id" BIGINT NOT NULL,
    "prontuario_id" BIGINT,
    "medico_id" BIGINT,
    "hospital_id" UUID,
    "tipo" VARCHAR(50) NOT NULL DEFAULT 'ambulatorial',
    "validade_dias" INTEGER,
    "observacoes" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ativa',
    "criado_por" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescricao_ambulatorial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_prescricao" (
    "id" BIGSERIAL NOT NULL,
    "prescricao_id" BIGINT NOT NULL,
    "medicamento_id" BIGINT,
    "nome_livre" VARCHAR(150),
    "dose" VARCHAR(100),
    "via" VARCHAR(50),
    "frequencia" VARCHAR(100),
    "duracao" VARCHAR(100),
    "quantidade" VARCHAR(50),
    "instrucoes" TEXT,

    CONSTRAINT "item_prescricao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescricao_hospitalar" (
    "id" BIGSERIAL NOT NULL,
    "paciente_id" BIGINT NOT NULL,
    "internacao_id" BIGINT,
    "medico_id" BIGINT,
    "hospital_id" UUID,
    "data_prescricao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validade_horas" INTEGER NOT NULL DEFAULT 24,
    "observacoes" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ativa',
    "criado_por" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescricao_hospitalar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_prescricao_hosp" (
    "id" BIGSERIAL NOT NULL,
    "prescricao_hosp_id" BIGINT NOT NULL,
    "medicamento_id" BIGINT,
    "nome_livre" VARCHAR(150),
    "dose" VARCHAR(100),
    "via" VARCHAR(50),
    "frequencia" VARCHAR(100),
    "instrucoes" TEXT,

    CONSTRAINT "item_prescricao_hosp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "administracao_med" (
    "id" BIGSERIAL NOT NULL,
    "item_prescricao_id" BIGINT NOT NULL,
    "administrado_por" BIGINT,
    "data_agendada" TIMESTAMP(3),
    "data_administracao" TIMESTAMP(3),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pendente',
    "observacoes" TEXT,

    CONSTRAINT "administracao_med_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sala_cirurgica" (
    "id" BIGSERIAL NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sala_cirurgica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cirurgia" (
    "id" BIGSERIAL NOT NULL,
    "paciente_id" BIGINT NOT NULL,
    "medico_id" BIGINT,
    "sala_id" BIGINT,
    "internacao_id" BIGINT,
    "hospital_id" UUID,
    "descricao" VARCHAR(255) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'agendada',
    "data_agendada" TIMESTAMP(3),
    "data_inicio" TIMESTAMP(3),
    "data_fim" TIMESTAMP(3),
    "observacoes" TEXT,
    "criado_por" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cirurgia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encaminhamento" (
    "id" BIGSERIAL NOT NULL,
    "paciente_id" BIGINT NOT NULL,
    "prontuario_id" BIGINT,
    "medico_id" BIGINT,
    "hospital_id" UUID,
    "especialidade" VARCHAR(100) NOT NULL,
    "servico_destino" VARCHAR(200),
    "prioridade" VARCHAR(20) NOT NULL DEFAULT 'eletivo',
    "motivo" TEXT NOT NULL,
    "hipotese_diagnostica" VARCHAR(200),
    "cid" VARCHAR(10),
    "status" VARCHAR(20) NOT NULL DEFAULT 'solicitado',
    "data_solicitacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_agendada" TIMESTAMP(3),
    "data_realizacao" TIMESTAMP(3),
    "observacoes" TEXT,
    "retorno_info" TEXT,
    "criado_por" BIGINT,

    CONSTRAINT "encaminhamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faturamento_aih" (
    "id" BIGSERIAL NOT NULL,
    "paciente_id" BIGINT NOT NULL,
    "internacao_id" BIGINT,
    "medico_solicitante_id" BIGINT,
    "hospital_id" UUID,
    "numero_aih" VARCHAR(20),
    "procedimento_principal" VARCHAR(255) NOT NULL,
    "cid_principal" VARCHAR(10),
    "data_emissao" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_apresentacao" DATE,
    "valor_total" DECIMAL(10,2),
    "status" VARCHAR(20) NOT NULL DEFAULT 'aberta',
    "criado_por" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faturamento_aih_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faturamento_apac" (
    "id" BIGSERIAL NOT NULL,
    "paciente_id" BIGINT NOT NULL,
    "medico_solicitante_id" BIGINT,
    "hospital_id" UUID,
    "numero_apac" VARCHAR(20),
    "procedimento_principal" VARCHAR(255) NOT NULL,
    "cid_principal" VARCHAR(10),
    "data_inicio_validade" DATE NOT NULL,
    "data_fim_validade" DATE NOT NULL,
    "quantidade_aprovada" INTEGER NOT NULL DEFAULT 1,
    "quantidade_realizada" INTEGER NOT NULL DEFAULT 0,
    "valor_total" DECIMAL(10,2),
    "status" VARCHAR(20) NOT NULL DEFAULT 'ativa',
    "criado_por" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faturamento_apac_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atendimento_ps" (
    "id" BIGSERIAL NOT NULL,
    "paciente_id" BIGINT NOT NULL,
    "medico_id" BIGINT,
    "triagem_id" BIGINT,
    "hospital_id" UUID,
    "motivo_consulta" TEXT NOT NULL,
    "diagnostico_preliminar" TEXT,
    "conduta" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'em_espera',
    "data_chegada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_atendimento" TIMESTAMP(3),
    "data_liberacao" TIMESTAMP(3),
    "criado_por" BIGINT,

    CONSTRAINT "atendimento_ps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agendamento" (
    "id" BIGSERIAL NOT NULL,
    "paciente_id" BIGINT NOT NULL,
    "medico_id" BIGINT,
    "hospital_id" UUID,
    "criado_por" BIGINT,
    "data_hora" TIMESTAMP(3) NOT NULL,
    "tipo" VARCHAR(30) NOT NULL DEFAULT 'consulta',
    "status" VARCHAR(20) NOT NULL DEFAULT 'agendado',
    "observacoes" TEXT,
    "motivo_cancel" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agendamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agenda_evento" (
    "id" BIGSERIAL NOT NULL,
    "paciente_nome" VARCHAR(160) NOT NULL,
    "data" VARCHAR(10) NOT NULL,
    "hora" VARCHAR(5) NOT NULL,
    "tipo" VARCHAR(40) NOT NULL DEFAULT 'consulta',
    "status" VARCHAR(30) NOT NULL DEFAULT 'agendado',
    "observacao" VARCHAR(255),
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "agenda_evento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "medico_user_id_key" ON "medico"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "medico_crm_key" ON "medico"("crm");

-- CreateIndex
CREATE INDEX "leito_status_idx" ON "leito"("status");

-- CreateIndex
CREATE INDEX "evolucao_internacao_internacao_id_idx" ON "evolucao_internacao"("internacao_id");

-- CreateIndex
CREATE UNIQUE INDEX "tipo_exame_codigo_key" ON "tipo_exame"("codigo");

-- CreateIndex
CREATE INDEX "exame_solicitado_status_idx" ON "exame_solicitado"("status");

-- CreateIndex
CREATE INDEX "exame_solicitado_paciente_id_idx" ON "exame_solicitado"("paciente_id");

-- CreateIndex
CREATE UNIQUE INDEX "catalogo_exame_codigo_key" ON "catalogo_exame"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "catalogo_vacina_codigo_key" ON "catalogo_vacina"("codigo");

-- CreateIndex
CREATE INDEX "vacina_aplicada_paciente_id_idx" ON "vacina_aplicada"("paciente_id");

-- CreateIndex
CREATE INDEX "prescricao_ambulatorial_paciente_id_idx" ON "prescricao_ambulatorial"("paciente_id");

-- CreateIndex
CREATE INDEX "prescricao_hospitalar_paciente_id_idx" ON "prescricao_hospitalar"("paciente_id");

-- CreateIndex
CREATE INDEX "administracao_med_status_idx" ON "administracao_med"("status");

-- CreateIndex
CREATE INDEX "cirurgia_status_idx" ON "cirurgia"("status");

-- CreateIndex
CREATE INDEX "encaminhamento_status_idx" ON "encaminhamento"("status");

-- CreateIndex
CREATE UNIQUE INDEX "faturamento_aih_numero_aih_key" ON "faturamento_aih"("numero_aih");

-- CreateIndex
CREATE UNIQUE INDEX "faturamento_apac_numero_apac_key" ON "faturamento_apac"("numero_apac");

-- CreateIndex
CREATE INDEX "atendimento_ps_status_idx" ON "atendimento_ps"("status");

-- CreateIndex
CREATE INDEX "agendamento_status_idx" ON "agendamento"("status");

-- CreateIndex
CREATE INDEX "agendamento_data_hora_idx" ON "agendamento"("data_hora");

-- CreateIndex
CREATE INDEX "agenda_evento_data_idx" ON "agenda_evento"("data");

-- CreateIndex
CREATE INDEX "agenda_evento_status_idx" ON "agenda_evento"("status");

-- CreateIndex
CREATE UNIQUE INDEX "unidade_cnes_key" ON "unidade"("cnes");

-- AddForeignKey
ALTER TABLE "internacao" ADD CONSTRAINT "internacao_leito_id_fkey" FOREIGN KEY ("leito_id") REFERENCES "leito"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medico" ADD CONSTRAINT "medico_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leito" ADD CONSTRAINT "leito_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evolucao_internacao" ADD CONSTRAINT "evolucao_internacao_internacao_id_fkey" FOREIGN KEY ("internacao_id") REFERENCES "internacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exame_solicitado" ADD CONSTRAINT "exame_solicitado_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exame_solicitado" ADD CONSTRAINT "exame_solicitado_tipo_exame_id_fkey" FOREIGN KEY ("tipo_exame_id") REFERENCES "tipo_exame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacina_aplicada" ADD CONSTRAINT "vacina_aplicada_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacina_aplicada" ADD CONSTRAINT "vacina_aplicada_vacina_id_fkey" FOREIGN KEY ("vacina_id") REFERENCES "vacina"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescricao_ambulatorial" ADD CONSTRAINT "prescricao_ambulatorial_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_prescricao" ADD CONSTRAINT "item_prescricao_prescricao_id_fkey" FOREIGN KEY ("prescricao_id") REFERENCES "prescricao_ambulatorial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_prescricao" ADD CONSTRAINT "item_prescricao_medicamento_id_fkey" FOREIGN KEY ("medicamento_id") REFERENCES "medicamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescricao_hospitalar" ADD CONSTRAINT "prescricao_hospitalar_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_prescricao_hosp" ADD CONSTRAINT "item_prescricao_hosp_prescricao_hosp_id_fkey" FOREIGN KEY ("prescricao_hosp_id") REFERENCES "prescricao_hospitalar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_prescricao_hosp" ADD CONSTRAINT "item_prescricao_hosp_medicamento_id_fkey" FOREIGN KEY ("medicamento_id") REFERENCES "medicamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "administracao_med" ADD CONSTRAINT "administracao_med_item_prescricao_id_fkey" FOREIGN KEY ("item_prescricao_id") REFERENCES "item_prescricao_hosp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cirurgia" ADD CONSTRAINT "cirurgia_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cirurgia" ADD CONSTRAINT "cirurgia_sala_id_fkey" FOREIGN KEY ("sala_id") REFERENCES "sala_cirurgica"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encaminhamento" ADD CONSTRAINT "encaminhamento_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faturamento_aih" ADD CONSTRAINT "faturamento_aih_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faturamento_apac" ADD CONSTRAINT "faturamento_apac_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimento_ps" ADD CONSTRAINT "atendimento_ps_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamento" ADD CONSTRAINT "agendamento_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

