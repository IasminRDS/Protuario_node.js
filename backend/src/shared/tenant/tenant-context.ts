import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  hospitalId: string | null;
  userId: string | null;
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
