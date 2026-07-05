import {
  ForbiddenException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { currentTenant } from '../../shared/tenant/tenant-context';
import { scopeParams, TenantContextError } from '../../shared/tenant/tenant-guard';

/**
 * Camada de acesso ao banco. Aplica ISOLAMENTO MULTI-TENANT automático via
 * middleware $use: toda query em modelo clínico (Paciente, Atendimento, ...)
 * recebe `hospitalId` do contexto (AsyncLocalStorage) — em reads, writes,
 * updates e deletes. Sem contexto de tenant válido, a operação é bloqueada.
 * Nenhum serviço precisa filtrar por hospital manualmente.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    this.$use(async (params, next) => {
      let scoped: typeof params;
      try {
        scoped = scopeParams(params, currentTenant());
      } catch (err) {
        if (err instanceof TenantContextError) {
          throw new ForbiddenException(err.message);
        }
        throw err;
      }
      return next(scoped);
    });

    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
