import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { from, lastValueFrom, Observable } from 'rxjs';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { tenantStore } from '../tenant/tenant-context';
import { RLS_ENABLED, setTenantGuc } from '../tenant/rls';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * F0.2 — Transaction-per-request. Para requisições MUTANTES abre UMA única
 * `$transaction` e injeta o `txClient` no ALS. Services de mutação já consomem
 * via `currentTx() ?? prisma` (F0.1) → passam a compartilhar a MESMA transação
 * (I1/I2) e nunca aninham (I3). Requisições GET não abrem tx (evita reter
 * conexão à toa — mitigação de exaustão de pool).
 *
 * O que fica DELIBERADAMENTE fora desta tx (usam conexão própria, não currentTx):
 *  - claim de idempotência (precisa commit imediato/atômico entre requests);
 *  - canal de auditoria autônomo (deve sobreviver ao rollback — F0.3).
 */
@Injectable()
export class TenantTxInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const store = tenantStore.getStore();

    // Sem contexto de tenant (fora de request) ou método não-mutante → sem tx.
    if (!store || !MUTATING.has(req.method)) {
      return next.handle();
    }

    return from(
      this.prisma.$transaction(
        async (tx) => {
          store.txClient = tx; // isolado por request (ALS) → I4
          // RLS: propaga o tenant para a sessão do banco NESTA tx (SET LOCAL).
          // Só quando há hospitalId — super-admin (bypassTenant) fica escopado
          // nesta fase (B3): sem GUC, a policy é fail-closed. Owner bypassa RLS,
          // então isto é inerte até virar a chave (RLS_ENABLED + role app).
          if (RLS_ENABLED && store.hospitalId) {
            await setTenantGuc(tx, store.hospitalId);
          }
          try {
            return await lastValueFrom(next.handle());
          } finally {
            // Cleanup: nada após o handler pode reusar uma tx prestes a commitar.
            store.txClient = undefined;
          }
        },
        // maxWait generoso: sob concorrência, requests aguardam conexão do pool
        // sem falhar espuriamente. timeout limita a duração da própria tx.
        { maxWait: 15000, timeout: 15000 },
      ),
    );
  }
}
