-- ============================================================================
-- Refinamento da QUARENTENA de órfãos (P0.2 §2.1/§2.2):
--   órfão = hospital_id IS NULL  OU  vínculo não-resolvível (hospital inexistente).
--
-- O caso "hospital inexistente" tornou-se possível após o drop da FK
-- usuario/registros→hospital (migration 20260704150012_). Contemos os dois casos.
--
-- Padroniza o código de erro REGISTRO_CLINICO_EM_QUARENTENA (o app mapeia/traduz).
-- Reusa os triggers já criados em 20260704170000 (apenas CREATE OR REPLACE da
-- função). Aditivo e reversível.
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_orphan_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.hospital_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM hospital h WHERE h.id = OLD.hospital_id) THEN
    RAISE EXCEPTION
      'REGISTRO_CLINICO_EM_QUARENTENA: % bloqueado (vinculo institucional ausente ou nao-resolvivel)', TG_OP
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
