-- ============================================================================
-- CPF/CNS únicos POR TENANT (hospital_id), não globalmente.
--
-- PROBLEMA: `cpf`/`cns` @unique GLOBAL no paciente impede o mesmo paciente de
-- ser atendido em >1 hospital e transforma a violação de unicidade num ORÁCULO
-- de existência cross-tenant (um hospital descobre que um CPF já existe em
-- outro). A identidade nacional única fica no Cidadao (MPI); o registro clínico
-- (Paciente) é POR hospital.
--
-- Como o CPF era globalmente único, não há dois registros com o mesmo CPF, logo
-- (hospital_id, cpf) já é único — a criação dos índices compostos é segura.
-- NULLs são distintos no Postgres → múltiplos pacientes sem documento por
-- hospital continuam permitidos (dedup é papel do MPI).
-- ============================================================================

DROP INDEX IF EXISTS "paciente_cpf_key";
DROP INDEX IF EXISTS "paciente_cns_key";

CREATE UNIQUE INDEX "paciente_hospital_id_cpf_key" ON "paciente" ("hospital_id", "cpf");
CREATE UNIQUE INDEX "paciente_hospital_id_cns_key" ON "paciente" ("hospital_id", "cns");
