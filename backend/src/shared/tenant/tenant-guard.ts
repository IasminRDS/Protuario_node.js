import { Prisma } from '@prisma/client';
import { TenantContext } from './tenant-context';

/**
 * Modelos com dados clínicos sensíveis (PHI) que DEVEM ser isolados por
 * hospital. Modelos nacionais/infra (Cidadao, Usuario, Hospital, Outbox, etc.)
 * NÃO entram aqui — Cidadao é identidade nacional (MPI) e Usuario precisa ser
 * lido no login ANTES do contexto de tenant existir.
 */
export const TENANT_MODELS: ReadonlySet<string> = new Set<string>([
  'Paciente',
  'Atendimento',
  'Triagem',
  'Prescricao',
  'Prontuario',
  // FASE 6 — também carregam PHI e referenciam Paciente. Entrar aqui dá o
  // escopo app-layer E o pin de leitura RLS (sem o pin, o include de paciente
  // rodaria sem o GUC e a policy o esconderia → "Inconsistent query result").
  'NotificacaoCompulsoria',
  'Encaminhamento',
  // Defesa em profundidade (migration 20260715): modelos clínicos que só eram
  // isolados por filtro manual em cada serviço — frágil (ex.: internacao.
  // buscarPorId fazia findUnique por id sem escopo → vazamento cross-tenant).
  // Aqui o escopo por hospitalId passa a ser automático em TODA query. (Policy
  // RLS no banco para estas tabelas é passo posterior — ver a migration.)
  'Internacao',
  'ExameSolicitado',
  'VacinaAplicada',
  'Cirurgia',
]);

/** Bloqueio explícito: operação em modelo tenant sem hospitalId no contexto. */
export class TenantContextError extends Error {
  constructor(model: string, action: string) {
    super(
      `Bloqueado: ${model}.${action} sem contexto de hospital (tenant). ` +
        `Usuário precisa de hospitalId no token.`,
    );
    this.name = 'TenantContextError';
  }
}

const WHERE_ACTIONS: ReadonlySet<string> = new Set<string>([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
]);

/**
 * Injeta hospitalId nos argumentos conforme a ação. PURO e determinístico
 * (testável sem banco). Assume hospitalId não-nulo (garantido por scopeParams).
 * findUnique é reescrito para findFirst pois `where` de findUnique só aceita
 * campos únicos (não aceitaria hospitalId).
 */
export function applyTenantScope(
  params: Prisma.MiddlewareParams,
  hospitalId: string,
): Prisma.MiddlewareParams {
  const action = params.action as string;
  params.args = params.args ?? {};

  if (action === 'create') {
    params.args.data = { ...params.args.data, hospitalId };
  } else if (action === 'createMany') {
    const data = params.args.data;
    params.args.data = Array.isArray(data)
      ? data.map((d: Record<string, unknown>) => ({ ...d, hospitalId }))
      : { ...data, hospitalId };
  } else if (action === 'upsert') {
    params.args.create = { ...params.args.create, hospitalId };
    params.args.update = { ...params.args.update, hospitalId };
  } else if (action === 'findUnique' || action === 'findUniqueOrThrow') {
    params.action = (
      action === 'findUnique' ? 'findFirst' : 'findFirstOrThrow'
    ) as Prisma.PrismaAction;
    params.args.where = { ...params.args.where, hospitalId };
  } else if (WHERE_ACTIONS.has(action)) {
    params.args.where = { ...(params.args.where ?? {}), hospitalId };
  }
  return params;
}

/**
 * Decide o escopo a partir do contexto:
 *  - modelo NÃO-tenant  -> passa inalterado;
 *  - SEM contexto (sistema/seed/worker) -> passa (escape hatch controlado);
 *  - contexto SEM hospitalId em modelo tenant -> BLOQUEIA (fail explícito);
 *  - contexto com hospitalId -> injeta o escopo.
 */
export function scopeParams(
  params: Prisma.MiddlewareParams,
  ctx: TenantContext | undefined,
): Prisma.MiddlewareParams {
  if (!TENANT_MODELS.has(params.model ?? '')) return params;
  if (!ctx) return params; // fora de requisição HTTP (seed/bootstrap/worker)
  if (ctx.bypassTenant) return params; // SUPER_ADMIN: acesso cross-tenant
  if (!ctx.hospitalId) {
    throw new TenantContextError(params.model as string, params.action as string);
  }
  return applyTenantScope(params, ctx.hospitalId);
}
