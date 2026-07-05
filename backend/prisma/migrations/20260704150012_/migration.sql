-- DropForeignKey
ALTER TABLE "usuario" DROP CONSTRAINT "usuario_hospital_id_fkey";

-- DropIndex
DROP INDEX "atendimento_hospital_id_idx";

-- DropIndex
DROP INDEX "auditoria_hospital_id_idx";

-- DropIndex
DROP INDEX "paciente_cidadao_id_idx";

-- DropIndex
DROP INDEX "paciente_hospital_id_idx";

-- DropIndex
DROP INDEX "paciente_status_idx";

-- DropIndex
DROP INDEX "prescricao_hospital_id_idx";

-- DropIndex
DROP INDEX "prontuario_hospital_id_idx";

-- DropIndex
DROP INDEX "triagem_hospital_id_idx";

-- DropIndex
DROP INDEX "usuario_hospital_id_idx";

-- AlterTable
ALTER TABLE "atendimento" ALTER COLUMN "hospital_id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "auditoria" ALTER COLUMN "hospital_id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "paciente" ALTER COLUMN "hospital_id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "prescricao" ALTER COLUMN "hospital_id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "prontuario" ALTER COLUMN "hospital_id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "resource_lock" ALTER COLUMN "hospital_id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "triagem" ALTER COLUMN "hospital_id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "usuario" ALTER COLUMN "hospital_id" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "uq_agenda_profissional_horario" RENAME TO "agenda_profissional_id_data_hora_key";

-- RenameIndex
ALTER INDEX "uq_lock_resource" RENAME TO "resource_lock_resource_resource_id_key";
