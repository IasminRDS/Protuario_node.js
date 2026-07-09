import { Global, Module } from '@nestjs/common';
import { AuditExportService } from './audit.service';

/**
 * Global: a auditoria de exportação é transversal (CSV, backup, export, relatórios).
 * Depende do AuditoriaService (AuditoriaModule é @Global).
 */
@Global()
@Module({
  providers: [AuditExportService],
  exports: [AuditExportService],
})
export class AuditModule {}
