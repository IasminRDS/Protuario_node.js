import {
  ForbiddenException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { currentTenant } from '../../shared/tenant/tenant-context';
import {
  scopeParams,
  TenantContextError,
  TENANT_MODELS,
} from '../../shared/tenant/tenant-guard';
import { RLS_ENABLED, setTenantGuc } from '../../shared/tenant/rls';

/**
 * Ações de LEITURA (após scopeParams, que já reescreve findUnique→findFirst).
 * Só estas precisam de "pin" de conexão para o RLS: GETs não abrem tx no
 * TenantTxInterceptor, então a leitura roda numa conexão avulsa do pool — sem
 * o GUC `app.hospital_id` a policy retornaria vazio. Mutações já rodam na tx
 * do interceptor (que seta o GUC).
 */
const READ_ACTIONS: ReadonlySet<string> = new Set<string>([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

/** Delegate camelCase a partir do nome do modelo (Paciente → paciente). */
function delegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

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
      const ctx = currentTenant();
      let scoped: typeof params;
      try {
        scoped = scopeParams(params, ctx);
      } catch (err) {
        if (err instanceof TenantContextError) {
          throw new ForbiddenException(err.message);
        }
        throw err;
      }

      // RLS — pin de leitura: envolve a leitura de modelo tenant numa tx curta
      // com SET LOCAL app.hospital_id, garantindo GUC + query na MESMA conexão.
      // Guardas: só com RLS_ENABLED, só READ em TENANT_MODELS, só com hospitalId
      // e apenas quando a query NÃO está já numa transação:
      //  - `params.runInTransaction` é o sinal do PRÓPRIO Prisma de que a query
      //    roda dentro de uma tx (o re-despacho abaixo, a tx-per-request do
      //    interceptor, ou um $transaction de service) — nesses casos o GUC já
      //    foi/será setado por quem abriu a tx, e re-pinar causaria recursão.
      //  - NÃO usar estado compartilhado (ctx) como guarda: queries CONCORRENTES
      //    da mesma request (findMany+count em Promise.all) se atropelam; e o
      //    AsyncLocalStorage não sobrevive ao agendador interno do Prisma
      //    (o guard "some" e o pin re-engata até esgotar o pool — P2028).
      if (
        RLS_ENABLED &&
        ctx &&
        !params.runInTransaction &&
        !ctx.txClient &&
        ctx.hospitalId &&
        TENANT_MODELS.has(scoped.model ?? '') &&
        READ_ACTIONS.has(scoped.action as string)
      ) {
        const hospitalId = ctx.hospitalId;
        const model = scoped.model as string;
        const action = scoped.action as string;
        return this.$transaction(async (tx) => {
          await setTenantGuc(tx, hospitalId);
          const delegate = (
            tx as unknown as Record<
              string,
              Record<string, (a: unknown) => Promise<unknown>>
            >
          )[delegateName(model)];
          return delegate[action](scoped.args);
        });
      }

      return next(scoped);
    });

    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
