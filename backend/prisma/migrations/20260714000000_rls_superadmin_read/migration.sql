-- RLS — reabertura da LEITURA cross-tenant do SuperAdmin (trilha reforçada).
--
-- A policy passa a permitir a LEITURA (USING) quando o GUC `app.superadmin`='on'
-- estiver setado na sessão. O WITH CHECK (INSERT/UPDATE) permanece ESTRITO ao
-- hospital_id — ou seja, o SuperAdmin pode LER qualquer tenant, mas NÃO gravar
-- cross-tenant às cegas. Cada leitura cross-tenant é auditada (PHI) pela
-- AccessAuditInterceptor. O GUC só é setado pelo pin quando ctx.bypassTenant
-- (perfil SuperAdmin revalidado no banco, não flag do cliente).

-- paciente
DROP POLICY IF EXISTS tenant_isolation_paciente ON paciente;
CREATE POLICY tenant_isolation_paciente ON paciente
  USING      (current_setting('app.superadmin', true) = 'on'
              OR hospital_id = NULLIF(current_setting('app.hospital_id', true), '')::uuid)
  WITH CHECK (hospital_id = NULLIF(current_setting('app.hospital_id', true), '')::uuid);

-- prontuario
DROP POLICY IF EXISTS tenant_isolation_prontuario ON prontuario;
CREATE POLICY tenant_isolation_prontuario ON prontuario
  USING      (current_setting('app.superadmin', true) = 'on'
              OR hospital_id = NULLIF(current_setting('app.hospital_id', true), '')::uuid)
  WITH CHECK (hospital_id = NULLIF(current_setting('app.hospital_id', true), '')::uuid);

-- atendimento
DROP POLICY IF EXISTS tenant_isolation_atendimento ON atendimento;
CREATE POLICY tenant_isolation_atendimento ON atendimento
  USING      (current_setting('app.superadmin', true) = 'on'
              OR hospital_id = NULLIF(current_setting('app.hospital_id', true), '')::uuid)
  WITH CHECK (hospital_id = NULLIF(current_setting('app.hospital_id', true), '')::uuid);

-- triagem
DROP POLICY IF EXISTS tenant_isolation_triagem ON triagem;
CREATE POLICY tenant_isolation_triagem ON triagem
  USING      (current_setting('app.superadmin', true) = 'on'
              OR hospital_id = NULLIF(current_setting('app.hospital_id', true), '')::uuid)
  WITH CHECK (hospital_id = NULLIF(current_setting('app.hospital_id', true), '')::uuid);

-- prescricao
DROP POLICY IF EXISTS tenant_isolation_prescricao ON prescricao;
CREATE POLICY tenant_isolation_prescricao ON prescricao
  USING      (current_setting('app.superadmin', true) = 'on'
              OR hospital_id = NULLIF(current_setting('app.hospital_id', true), '')::uuid)
  WITH CHECK (hospital_id = NULLIF(current_setting('app.hospital_id', true), '')::uuid);
