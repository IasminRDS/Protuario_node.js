import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { currentHospitalId } from '../../shared/tenant/tenant-context';
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto';
import {
  buildPaginatedResult,
  PaginatedResult,
} from '../../shared/dto/paginated-result';

export interface RegistrarAuditoriaInput {
  usuarioId?: string | bigint | null;
  modulo: string;
  operacao: string;
  objeto?: string;
  resultado?: string;
  ip?: string;
  // Enriquecimento LGPD
  entity?: string;
  entityId?: string;
  device?: string;
  reason?: string;
}

/**
 * Auditoria imutável (RN-045/046, cap. 122-124). Só há operações de escrita
 * (append) e leitura — nunca update/delete. A falha ao auditar é registrada em
 * log mas não interrompe a operação de negócio já concluída.
 */
@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registrar(input: RegistrarAuditoriaInput): Promise<void> {
    try {
      await this.prisma.auditoria.create({
        data: {
          usuarioId:
            input.usuarioId != null ? BigInt(input.usuarioId) : null,
          modulo: input.modulo,
          operacao: input.operacao,
          objeto: input.objeto,
          resultado: input.resultado,
          ip: input.ip,
          entity: input.entity,
          entityId: input.entityId,
          device: input.device,
          reason: input.reason,
          hospitalId: currentHospitalId(), // tenant automático da requisição
        },
      });
    } catch (e) {
      this.logger.error(
        `Falha ao registrar auditoria: ${input.modulo}/${input.operacao}`,
        e instanceof Error ? e.stack : String(e),
      );
    }
  }

  async listar(
    query: PaginationQueryDto,
    filtros: { modulo?: string; usuarioId?: string },
  ): Promise<PaginatedResult<unknown>> {
    const where = {
      ...(filtros.modulo ? { modulo: filtros.modulo } : {}),
      ...(filtros.usuarioId ? { usuarioId: BigInt(filtros.usuarioId) } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditoria.findMany({
        where,
        skip: query.skip,
        take: query.pageSize,
        orderBy: { dataEvento: query.order },
      }),
      this.prisma.auditoria.count({ where }),
    ]);

    return buildPaginatedResult(items, total, query.page, query.pageSize);
  }
}
