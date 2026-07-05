-- ============================================================================
-- WORM (Write Once, Read Many) para a trilha de auditoria.
--
-- Objetivo (CNJ / não-repúdio / ISO 27001 A.12.4): tornar a tabela `auditoria`
-- IMUTÁVEL no nível do banco — INSERT (append) e SELECT permitidos; UPDATE e
-- DELETE rejeitados. A imutabilidade deixa de ser convenção de aplicação e passa
-- a ser enforçada pelo PostgreSQL, resistindo a adulteração por app comprometida
-- ou acesso administrativo direto (o trigger dispara para qualquer papel; só é
-- contornável por quem tenha DDL para desabilitá-lo — ação por si auditável).
--
-- Aditivo e reversível: não altera dados nem colunas. Rollback:
--   DROP TRIGGER auditoria_no_update ON auditoria;
--   DROP TRIGGER auditoria_no_delete ON auditoria;
--   DROP FUNCTION auditoria_prevent_mutation;
--
-- Nota: triggers de LINHA (FOR EACH ROW) NÃO disparam em TRUNCATE — por isso o
-- harness de teste (TRUNCATE ... CASCADE) segue funcionando. Em produção,
-- vede TRUNCATE por privilégio:  REVOKE TRUNCATE ON auditoria FROM <app_role>;
-- ============================================================================

CREATE OR REPLACE FUNCTION auditoria_prevent_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'auditoria e append-only (WORM): operacao % bloqueada', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auditoria_no_update ON auditoria;
CREATE TRIGGER auditoria_no_update
  BEFORE UPDATE ON auditoria
  FOR EACH ROW EXECUTE FUNCTION auditoria_prevent_mutation();

DROP TRIGGER IF EXISTS auditoria_no_delete ON auditoria;
CREATE TRIGGER auditoria_no_delete
  BEFORE DELETE ON auditoria
  FOR EACH ROW EXECUTE FUNCTION auditoria_prevent_mutation();
