import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { catchError, from, mergeMap, Observable, throwError } from 'rxjs';
import { AuditoriaService } from '../../modules/auditoria/auditoria.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { getTraceId } from '../observability/trace-id.middleware';
import { currentTx } from '../tenant/tenant-context';

/**
 * Recursos que carregam PHI (dado clínico de saúde). Acesso a estes é evento
 * auditável por LGPD (art. 37) e ISO 27001 A.12.4. Superset intencional — uma
 * rota a mais só gera trilha extra, nunca falta de trilha.
 */
const PHI_RESOURCES: ReadonlySet<string> = new Set<string>([
  'pacientes',
  'prontuario',
  'fhir',
  'encounters',
  'atendimentos',
  'triage',
  'triagem',
  'prescriptions',
  'prescricao',
  'mpi',
]);

const MUTATIONS: ReadonlySet<string> = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface AccessAuditDecisionInput {
  method: string;
  resource: string | undefined; // segmento após /api/v1
  hasId: boolean; // acesso a registro individual (:id)
  isSuperAdmin: boolean;
}

/**
 * Decisão PURA (testável sem HTTP): auditar quando
 *  - super-admin (god-mode cross-tenant → 100% auditado, não-negociável); OU
 *  - recurso PHI E (mutação OU leitura de registro individual).
 * Listagens genéricas (GET coleção) não geram PHI de um titular específico e
 * são omitidas para evitar ruído — a exposição sensível é o registro individual.
 */
export function shouldAudit(input: AccessAuditDecisionInput): boolean {
  if (input.isSuperAdmin) return true;
  if (!input.resource || !PHI_RESOURCES.has(input.resource)) return false;
  const isMutation = MUTATIONS.has(input.method.toUpperCase());
  const singleRead = input.method.toUpperCase() === 'GET' && input.hasId;
  return isMutation || singleRead;
}

/**
 * Auditoria de NÃO-REPÚDIO (CNJ) para acesso privilegiado e a PHI. Additivo:
 * reusa a auditoria append-only existente; nunca interrompe a requisição.
 * Registra sucesso e falha (tentativa negada também é evidência forense).
 */
@Injectable()
export class AccessAuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditoria: AuditoriaService,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthenticatedUser | undefined;
    const method: string = req.method;

    const path: string = (req.originalUrl || req.url || '').split('?')[0];
    const segs = path.split('/').filter(Boolean); // ['api','v1','pacientes','3']
    const resource = segs[2];
    const entityId: string | undefined = req.params?.id;

    const decide = (): boolean =>
      shouldAudit({
        method,
        resource,
        hasId: entityId != null,
        isSuperAdmin: user?.superAdmin === true,
      });

    if (!decide()) {
      return next.handle();
    }

    const base = {
      usuarioId: user?.id ?? null,
      modulo: user?.superAdmin ? 'SUPERADMIN' : 'ACCESS',
      operacao: `${method} /${segs.slice(2).join('/')}`,
      entity: resource,
      entityId,
      objeto: getTraceId(req), // correlação traceId ↔ logs backend
      ip: req.ip as string | undefined,
      device: req.headers?.['user-agent'] as string | undefined,
      // Break-the-glass / finalidade LGPD, quando o cliente a informa.
      reason: (req.headers?.['x-justification'] as string | undefined) ?? undefined,
    };

    return next.handle().pipe(
      // SUCESSO (F0.5): AUDIT_ACCESS_SUCCESS durável e AWAITED antes da resposta.
      // Em mutação, `currentTx()` = tx do request → SOD (atômico). Em read, cai no
      // `this.prisma` (autocommit) — committado ANTES do response ⇒ I-G8, sem
      // fire-and-forget. Se falhar em mutação, o erro propaga e a tx faz rollback.
      mergeMap((payload) =>
        from(
          this.auditoria.registrarAcessoTx(currentTx() ?? this.prisma, {
            ...base,
            resultado: 'OK',
          }),
        ).pipe(mergeMap(() => Promise.resolve(payload))),
      ),
      // NEGAÇÃO/ERRO via canal AUTÔNOMO (F0.3): sobrevive ao rollback. Agora
      // AWAITED (registrarAutonomo engole o próprio erro) → zero fire-and-forget.
      catchError((err) =>
        from(
          this.auditoria.registrarAutonomo({
            ...base,
            resultado: `ERRO:${(err as { status?: number })?.status ?? 'EXCEPTION'}`,
          }),
        ).pipe(mergeMap(() => throwError(() => err))),
      ),
    );
  }
}

/** Provider global para registro em AppModule (após o ResponseInterceptor). */
export const AccessAuditInterceptorProvider = {
  provide: APP_INTERCEPTOR,
  useClass: AccessAuditInterceptor,
};
