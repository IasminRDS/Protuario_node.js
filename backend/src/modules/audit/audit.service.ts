import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';

// Enums padronizados da auditoria de exportação/importação (LGPD).
export type ExportTipo =
  | 'CSV_IMPORT'
  | 'BACKUP'
  | 'PACIENTES_EXPORT'
  | 'RELATORIO'
  // Downloads sensíveis de PHI (documentos clínicos em PDF) — mesma trilha unificada.
  | 'PDF_PRONTUARIO'
  | 'PDF_PRESCRICAO'
  | 'PDF_ALTA';
export type ExportAcao = 'IMPORTAR' | 'GERAR_BACKUP' | 'EXPORTAR';
export type ExportStatus = 'SUCESSO' | 'FALHA';

export interface LogExportParams {
  tipo: ExportTipo;
  acao: ExportAcao;
  status: ExportStatus;
  userId: string | bigint | null;
  /** Tenant do evento. Se omitido, usa o hospital da requisição (currentHospitalId). */
  hospitalId?: string | null;
  /**
   * Recurso auditado (colunas INDEXADAS entity/entityId — base da "trilha de
   * acesso do paciente" LGPD). Opcional: default `entity='export'`. Usado por
   * downloads que apontam a um agregado específico (ex.: PDF de um paciente).
   */
  entity?: string;
  entityId?: string;
  objeto?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Serviço central de auditoria de EXPORTAÇÃO/IMPORTAÇÃO (LGPD). Ponto único que
 * padroniza tipo/ação/status e SEMPRE grava user_id, hospital_id, timestamp e
 * metadata (JSON). Escreve na trilha imutável de auditoria (append-only). Toda
 * origem (CSV import, backup, export de pacientes, relatório) passa por aqui —
 * sem lógica de auditoria duplicada nos módulos.
 */
@Injectable()
export class AuditExportService {
  constructor(private readonly auditoria: AuditoriaService) {}

  async logExport(params: LogExportParams): Promise<void> {
    await this.auditoria.registrar({
      usuarioId: params.userId,
      hospitalId: params.hospitalId, // undefined → currentHospitalId()
      modulo: params.tipo,
      operacao: params.acao,
      resultado: params.status,
      entity: params.entity ?? 'export',
      entityId: params.entityId,
      objeto: params.objeto,
      reason: `${params.tipo}/${params.acao} ${params.status}`,
      metadata: (params.metadata ?? {}) as unknown as Prisma.InputJsonValue,
    });
  }
}
