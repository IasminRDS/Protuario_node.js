-- ============================================================================
-- RLS no BANCO para os 4 modelos clínicos adicionados a TENANT_MODELS na
-- migration 20260715 (Internacao, ExameSolicitado, VacinaAplicada, Cirurgia).
-- Completa a defesa em profundidade: o escopo app-layer (middleware Prisma) já
-- vale; aqui o PostgreSQL passa a ENFORÇAR o isolamento mesmo contra query raw,
-- bug de scope ou app comprometida — como já ocorre nas 5 tabelas originais.
--
-- Forma idêntica às políticas de 20260705 + 20260714:
--   * ENABLE (não FORCE): o dono (migrations/seed/monitor) mantém acesso pleno;
--     só a role prontuario_app (não-dona) é submetida à policy.
--   * USING com bypass de LEITURA do SuperAdmin (GUC app.superadmin='on').
--   * WITH CHECK estrito por hospital_id: ninguém GRAVA cross-tenant às cegas.
--   * fail-closed via NULLIF(current_setting('app.hospital_id', true), '')::uuid.
--
-- PRÉ-REQUISITOS (já atendidos nesta linha de trabalho):
--   1) hospital_id presente e backfillado nos 4 (migration 20260715);
--   2) as listas que usavam $transaction([findMany, count]) viraram Promise.all
--      (internacao.listarAtivas, cirurgia.listar, exames.listar) — senão a policy
--      esconderia as linhas dentro da tx-batch (o pin não seta o GUC lá).
-- ============================================================================

-- internacao
ALTER TABLE internacao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_internacao ON internacao;
CREATE POLICY tenant_isolation_internacao ON internacao
  USING      (current_setting('app.superadmin', true) = 'on'
              OR hospital_id = NULLIF(current_setting('app.hospital_id', true), '')::uuid)
  WITH CHECK (hospital_id = NULLIF(current_setting('app.hospital_id', true), '')::uuid);

-- exame_solicitado
ALTER TABLE exame_solicitado ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_exame_solicitado ON exame_solicitado;
CREATE POLICY tenant_isolation_exame_solicitado ON exame_solicitado
  USING      (current_setting('app.superadmin', true) = 'on'
              OR hospital_id = NULLIF(current_setting('app.hospital_id', true), '')::uuid)
  WITH CHECK (hospital_id = NULLIF(current_setting('app.hospital_id', true), '')::uuid);

-- vacina_aplicada
ALTER TABLE vacina_aplicada ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_vacina_aplicada ON vacina_aplicada;
CREATE POLICY tenant_isolation_vacina_aplicada ON vacina_aplicada
  USING      (current_setting('app.superadmin', true) = 'on'
              OR hospital_id = NULLIF(current_setting('app.hospital_id', true), '')::uuid)
  WITH CHECK (hospital_id = NULLIF(current_setting('app.hospital_id', true), '')::uuid);

-- cirurgia
ALTER TABLE cirurgia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_cirurgia ON cirurgia;
CREATE POLICY tenant_isolation_cirurgia ON cirurgia
  USING      (current_setting('app.superadmin', true) = 'on'
              OR hospital_id = NULLIF(current_setting('app.hospital_id', true), '')::uuid)
  WITH CHECK (hospital_id = NULLIF(current_setting('app.hospital_id', true), '')::uuid);

-- ============================================================================
-- ROLLBACK (referência):
--   DROP POLICY IF EXISTS tenant_isolation_internacao       ON internacao;
--   DROP POLICY IF EXISTS tenant_isolation_exame_solicitado ON exame_solicitado;
--   DROP POLICY IF EXISTS tenant_isolation_vacina_aplicada  ON vacina_aplicada;
--   DROP POLICY IF EXISTS tenant_isolation_cirurgia         ON cirurgia;
--   ALTER TABLE internacao       DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE exame_solicitado DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE vacina_aplicada  DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE cirurgia         DISABLE ROW LEVEL SECURITY;
-- ============================================================================
