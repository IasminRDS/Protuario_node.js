-- Auditoria unificada de exportações/importações: metadados estruturados (LGPD).
ALTER TABLE "auditoria" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
