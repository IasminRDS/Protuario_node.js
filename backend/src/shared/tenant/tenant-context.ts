import { AsyncLocalStorage } from 'async_hooks';
import type { Prisma } from '@prisma/client';

export interface TenantContext {
  hospitalId: string | null;
  userId: string | null;
  /**
   * Quando true (SUPER_ADMIN), o middleware de tenant NÃO injeta hospitalId —
   * a conta enxerga todos os hospitais. Ausente/false = fail-closed (sem bypass).
   */
  bypassTenant?: boolean;
  /**
   * Transação da requisição (F0.1/F0.2). Quando presente, services de mutação
   * reusam este client em vez de abrir novo `$transaction` — evita nested tx.
   * Hoje fica indefinido (o interceptor de tx-por-request é fase seguinte); os
   * services já leem via currentTx() e caem no fallback `$transaction` próprio.
   */
  txClient?: Prisma.TransactionClient;
  /** Identificador server-side da requisição (F0.2) — isolamento/correlação. */
  requestId?: string;
}

/**
 * Contexto de tenant por requisição (AsyncLocalStorage). Preenchido pelo
 * TenantMiddleware (objeto mutável) e populado pelo JwtStrategy após autenticar.
 * Serviços leem currentHospitalId() para taguear escritas e filtrar leituras.
 */
export const tenantStore = new AsyncLocalStorage<TenantContext>();

export function currentTenant(): TenantContext | undefined {
  return tenantStore.getStore();
}

export function currentHospitalId(): string | null {
  return tenantStore.getStore()?.hospitalId ?? null;
}

/** Transação ambiente da requisição, se houver (F0.1). */
export function currentTx(): Prisma.TransactionClient | undefined {
  return tenantStore.getStore()?.txClient;
}

/**
 * Correlação forense da requisição para os logs: traceId (requestId), userId e
 * tenantId (hospitalId). Vazio fora de uma requisição HTTP.
 */
export function currentCorrelation(): {
  traceId?: string;
  userId?: string;
  tenantId?: string;
} {
  const s = tenantStore.getStore();
  if (!s) return {};
  return {
    ...(s.requestId ? { traceId: s.requestId } : {}),
    ...(s.userId ? { userId: s.userId } : {}),
    ...(s.hospitalId ? { tenantId: s.hospitalId } : {}),
  };
}
