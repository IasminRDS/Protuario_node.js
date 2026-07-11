-- ============================================================================
-- RLS FASE 1 — Isolamento por tenant (hospital_id) enforçado pelo PostgreSQL.
--
-- Objetivo (C7/C8 / zero-trust): mover o isolamento multi-tenant da app-layer
-- (middleware Prisma `scopeParams`) para o BANCO, via Row-Level Security. A
-- app-layer permanece como defesa-em-profundidade; o RLS passa a ser a barreira
-- que resiste a query raw, bug de scope, ou app comprometida.
--
-- DECISÕES (ver PR):
--  B1) O app deixa de conectar como superuser/dono. RLS é IGNORADO para o dono
--      da tabela e para superuser — por isso criamos a role dedicada
--      `prontuario_app` (NOSUPERUSER, NOBYPASSRLS, NÃO-dona). Migrations, seed e
--      o ConsistencyMonitor seguem na role dona (`prontuario`), que — como NÃO
--      usamos FORCE — mantém acesso pleno.
--  B2) Contexto de sessão via GUC `app.hospital_id` (SET LOCAL dentro de tx).
--  B3) Super-admin (bypassTenant) fica ESCOPADO nesta fase (fail-closed): sem
--      caminho de BYPASSRLS no banco. Leitura cross-tenant de super-admin é
--      reaberta numa fase posterior.
--  Escopo: 5 tabelas clínicas de PHI (TENANT_MODELS). `auditoria` fica de fora
--      (é WORM e lida globalmente pelo ConsistencyMonitor — RLS nela quebraria
--      os invariantes I-G2A/I-G4). RLS da auditoria = fase própria.
--
-- Aditivo e reversível: não altera dados nem colunas. Rollback ao final.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Role de aplicação dedicada (não-superuser, não-dona das tabelas).
--    Idempotente: CREATE ROLE não tem "IF NOT EXISTS".
--    NOTA DE SEGURANÇA: a senha aqui é credencial de DEV (espelha o padrão
--    `prontuario:prontuario` do docker-compose). Em produção, rotacione via
--    secret:  ALTER ROLE prontuario_app PASSWORD '<forte>';
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prontuario_app') THEN
    CREATE ROLE prontuario_app LOGIN PASSWORD 'prontuario_app'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;

-- Reafirma atributos críticos mesmo se a role já existia (defensivo).
ALTER ROLE prontuario_app NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

-- ----------------------------------------------------------------------------
-- 2) Privilégios: o app opera em todas as tabelas do schema (menos superpoder).
--    Isso espelha a capacidade atual (hoje conecta como superuser), removendo
--    apenas o poder de ignorar RLS. RLS é enforçado nas 5 tabelas do passo 3;
--    nas demais o app continua com acesso pleno (usuario, cidadao, hospital…).
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO prontuario_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO prontuario_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO prontuario_app;

-- Objetos futuros criados pelo dono (novas migrations) já nascem acessíveis.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO prontuario_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO prontuario_app;

-- WORM: a auditoria é append-only. A app-role nunca deve poder TRUNCATE.
-- (Triggers auditoria_no_update/no_delete já bloqueiam UPDATE/DELETE; TRUNCATE
--  não dispara trigger de linha — por isso o REVOKE explícito.)
REVOKE TRUNCATE ON auditoria FROM prontuario_app;

-- ----------------------------------------------------------------------------
-- 3) RLS + policies nas 5 tabelas clínicas de PHI (TENANT_MODELS).
--
--    * ENABLE (não FORCE): o dono (migrations/seed/monitor) mantém acesso
--      pleno; apenas prontuario_app (não-dona) é submetida à policy.
--    * fail-closed: sem `app.hospital_id` setado, current_setting(...,true)
--      retorna NULL → `hospital_id = NULL` é NULL → nenhuma linha casa
--      (nem SELECT, nem INSERT/UPDATE via WITH CHECK).
--    * NULLIF(...,''): após um SET LOCAL em tx anterior na MESMA conexão do
--      pool, o GUC "resetado" volta como STRING VAZIA (não NULL) — e ''::uuid
--      erraria. NULLIF converte '' em NULL e preserva o fail-closed sem erro.
--    * WITH CHECK além do USING: impede GRAVAR linha de outro tenant (o USING
--      sozinho não restringe INSERT).
-- ----------------------------------------------------------------------------

-- paciente
ALTER TABLE paciente ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_paciente ON paciente;
CREATE POLICY tenant_isolation_paciente ON paciente
  USING      (hospital_id = NULLIF(current_setting('app.hospital_id', true), '')::uuid)
  WITH CHECK (hospital_id = NULLIF(current_setting('app.hospital_id', true), '')::uuid);

-- prontuario
ALTER TABLE prontuario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_prontuario ON prontuario;
CREATE POLICY tenant_isolation_prontuario ON prontuario
  USING      (hospital_id = NULLIF(current_setting('app.hospital_id', true), '')::uuid)
  WITH CHECK (hospital_id = NULLIF(current_setting('app.hospital_id', true), '')::uuid);

-- atendimento
ALTER TABLE atendimento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_atendimento ON atendimento;
CREATE POLICY tenant_isolation_atendimento ON atendimento
  USING      (hospital_id = NULLIF(current_setting('app.hospital_id', true), '')::uuid)
  WITH CHECK (hospital_id = NULLIF(current_setting('app.hospital_id', true), '')::uuid);

-- triagem
ALTER TABLE triagem ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_triagem ON triagem;
CREATE POLICY tenant_isolation_triagem ON triagem
  USING      (hospital_id = NULLIF(current_setting('app.hospital_id', true), '')::uuid)
  WITH CHECK (hospital_id = NULLIF(current_setting('app.hospital_id', true), '')::uuid);

-- prescricao
ALTER TABLE prescricao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_prescricao ON prescricao;
CREATE POLICY tenant_isolation_prescricao ON prescricao
  USING      (hospital_id = NULLIF(current_setting('app.hospital_id', true), '')::uuid)
  WITH CHECK (hospital_id = NULLIF(current_setting('app.hospital_id', true), '')::uuid);

-- ============================================================================
-- ROLLBACK (referência — não executado automaticamente):
--   DROP POLICY IF EXISTS tenant_isolation_paciente    ON paciente;
--   DROP POLICY IF EXISTS tenant_isolation_prontuario  ON prontuario;
--   DROP POLICY IF EXISTS tenant_isolation_atendimento ON atendimento;
--   DROP POLICY IF EXISTS tenant_isolation_triagem     ON triagem;
--   DROP POLICY IF EXISTS tenant_isolation_prescricao  ON prescricao;
--   ALTER TABLE paciente    DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE prontuario  DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE atendimento DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE triagem     DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE prescricao  DISABLE ROW LEVEL SECURITY;
--   -- Revogar grants e DROP ROLE prontuario_app (após religar o app na role dona).
-- ============================================================================
