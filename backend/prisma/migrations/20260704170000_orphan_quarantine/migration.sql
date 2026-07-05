-- ============================================================================
-- QUARENTENA DE ÓRFÃOS (contenção segura, sem decisão de negócio).
--
-- Registros clínicos com hospital_id IS NULL (sem vínculo institucional) ficam
-- CONGELADOS: não podem ser alterados (UPDATE) nem removidos (DELETE) até que o
-- negócio decida o destino (vínculo a hospital vs. expurgo). Leitura continua
-- possível — a aplicação os marca como "em quarentena".
--
-- NÃO aplica SET NOT NULL nem recria FK (evita decisão destrutiva). Apenas
-- contém: impede que dado órfão seja modificado/re-vinculado silenciosamente,
-- fechando o risco de Information Disclosure / Elevation via dados sem tenant.
--
-- INSERT NÃO é bloqueado de propósito: permite fixtures/migração e não é o vetor
-- de risco (o risco é mutar/associar órfão existente).
--
-- Aditivo e reversível:
--   DROP TRIGGER <tabela>_orphan_guard ON <tabela>;  (x5)
--   DROP FUNCTION prevent_orphan_mutation;
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_orphan_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.hospital_id IS NULL THEN
    RAISE EXCEPTION
      'registro clinico em QUARENTENA (sem vinculo institucional): % bloqueado', TG_OP
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS paciente_orphan_guard ON paciente;
CREATE TRIGGER paciente_orphan_guard
  BEFORE UPDATE OR DELETE ON paciente
  FOR EACH ROW EXECUTE FUNCTION prevent_orphan_mutation();

DROP TRIGGER IF EXISTS atendimento_orphan_guard ON atendimento;
CREATE TRIGGER atendimento_orphan_guard
  BEFORE UPDATE OR DELETE ON atendimento
  FOR EACH ROW EXECUTE FUNCTION prevent_orphan_mutation();

DROP TRIGGER IF EXISTS triagem_orphan_guard ON triagem;
CREATE TRIGGER triagem_orphan_guard
  BEFORE UPDATE OR DELETE ON triagem
  FOR EACH ROW EXECUTE FUNCTION prevent_orphan_mutation();

DROP TRIGGER IF EXISTS prescricao_orphan_guard ON prescricao;
CREATE TRIGGER prescricao_orphan_guard
  BEFORE UPDATE OR DELETE ON prescricao
  FOR EACH ROW EXECUTE FUNCTION prevent_orphan_mutation();

DROP TRIGGER IF EXISTS prontuario_orphan_guard ON prontuario;
CREATE TRIGGER prontuario_orphan_guard
  BEFORE UPDATE OR DELETE ON prontuario
  FOR EACH ROW EXECUTE FUNCTION prevent_orphan_mutation();
