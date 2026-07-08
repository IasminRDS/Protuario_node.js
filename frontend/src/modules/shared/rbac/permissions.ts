import type { Perfil } from '@/types';

/**
 * Catálogo de permissões granulares (o backend continua sendo a autoridade
 * real; aqui espelhamos para controlar rotas, componentes e ações na UI).
 * Formato "recurso:ação".
 */
export const PERMISSIONS = [
  'patient:read',
  'patient:create',
  'patient:update',
  'triage:read',
  'triage:write',
  'clinical:read',
  'clinical:write',
  'prescription:read',
  'prescription:create',
  'prescription:write',
  'audit:read',
  'user:manage',
  'admin:full',
  // Fase 2 — módulos hospitalares (espelham o backend RBAC)
  'internment:write',
  'emergency:write',
  'exam:write',
  'surgery:write',
  'med-admin:write',
  // Fase 5 — gestão/relatórios
  'reports:read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Mapa Perfil → Permissões. Mantido derivável do claim `perfil` do JWT.
 * (Quando o backend expuser um endpoint de permissões/claims, trocar este mapa
 * por fetch — a UI já consome via usePermissions, sem outras mudanças.)
 */
const ROLE_PERMISSIONS: Record<Perfil, Permission[]> = {
  // SuperAdmin: acesso total à plataforma (cross-tenant) — espelha o backend.
  SuperAdmin: ['admin:full'],
  Administrador: ['admin:full'],
  Medico: [
    'patient:read',
    'triage:read',
    'clinical:read',
    'clinical:write',
    'prescription:read',
    'prescription:create',
    'prescription:write',
    'internment:write',
    'emergency:write',
    'exam:write',
    'surgery:write',
    'reports:read',
  ],
  Enfermeiro: [
    'patient:read',
    'triage:read',
    'triage:write',
    'clinical:read',
    'emergency:write',
    'exam:write',
    'internment:write',
    'med-admin:write',
  ],
  Farmaceutico: ['patient:read', 'prescription:read'],
  Recepcao: ['patient:read', 'patient:create', 'patient:update'],
  Gestor: ['patient:read', 'clinical:read', 'audit:read', 'reports:read'],
};

export function permissionsFor(perfil: Perfil): Set<Permission> {
  const list = ROLE_PERMISSIONS[perfil] ?? [];
  return new Set(list);
}

/** admin:full concede tudo. */
export function hasPermission(
  granted: Set<Permission>,
  required: Permission,
): boolean {
  return granted.has('admin:full') || granted.has(required);
}

export function hasAny(
  granted: Set<Permission>,
  required: Permission[],
): boolean {
  return granted.has('admin:full') || required.some((p) => granted.has(p));
}
