import type { Prisma } from '@prisma/client';

/**
 * RLS FASE 1 — utilidades de contexto de sessão para Row-Level Security.
 *
 * O enforcement real do isolamento fica no PostgreSQL (policies criadas na
 * migration 20260705000000_rls_phase1). Aqui só propagamos o tenant para a
 * SESSÃO do banco via GUC `app.hospital_id`, que a policy consulta com
 * `current_setting('app.hospital_id', true)`.
 *
 * ROLLOUT SEGURO (fail-safe): tudo fica atrás de RLS_ENABLED (default false).
 * Enquanto o app conecta como a role DONA (`prontuario`), o RLS é ignorado
 * (owner bypass) e este código é inerte. O RLS só passa a valer de fato quando:
 *   1) RLS_ENABLED=true, e
 *   2) DATABASE_URL aponta para a role NÃO-dona `prontuario_app`.
 * Nunca vire (2) sem os testes de `rls-phase1.e2e-spec.ts` verdes.
 */
export const RLS_ENABLED = process.env.RLS_ENABLED === 'true';

/**
 * Aplica `SET LOCAL app.hospital_id` na transação corrente. `set_config(_, _, true)`
 * = escopo LOCAL (só vale até o fim desta tx) — jamais vaza entre requests no
 * pool. Parametrizado ($executeRaw) — sem interpolação de string.
 */
export async function setTenantGuc(
  tx: Prisma.TransactionClient,
  hospitalId: string,
): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.hospital_id', ${hospitalId}, true)`;
}

/**
 * Habilita a LEITURA cross-tenant do SuperAdmin (GUC `app.superadmin`='on',
 * escopo LOCAL). A policy passa a permitir USING para qualquer hospital; o
 * WITH CHECK de escrita permanece estrito (SuperAdmin não grava cross-tenant
 * às cegas). Cada acesso é auditado como PHI. Só chamado quando o perfil
 * SuperAdmin foi revalidado no banco (bypassTenant), nunca por flag do cliente.
 */
export async function setSuperadminGuc(
  tx: Prisma.TransactionClient,
): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.superadmin', 'on', true)`;
}
