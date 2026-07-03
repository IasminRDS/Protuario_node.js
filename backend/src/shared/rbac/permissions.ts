import { PerfilNome } from '../enums/perfil.enum';

/** Permissões granulares (recurso:ação). O backend é a autoridade real. */
export enum Permission {
  PATIENT_READ = 'patient:read',
  PATIENT_CREATE = 'patient:create',
  TRIAGE_WRITE = 'triage:write',
  ENCOUNTER_WRITE = 'encounter:write',
  PRESCRIPTION_WRITE = 'prescription:write',
  CLINICAL_READ = 'clinical:read',
  AUDIT_READ = 'audit:read',
  HOSPITAL_MANAGE = 'hospital:manage',
  ADMIN_FULL = 'admin:full',
}

const ROLE_PERMISSIONS: Record<PerfilNome, Permission[]> = {
  [PerfilNome.ADMINISTRADOR]: [Permission.ADMIN_FULL],
  [PerfilNome.MEDICO]: [
    Permission.PATIENT_READ,
    Permission.CLINICAL_READ,
    Permission.ENCOUNTER_WRITE,
    Permission.PRESCRIPTION_WRITE,
  ],
  [PerfilNome.ENFERMEIRO]: [
    Permission.PATIENT_READ,
    Permission.TRIAGE_WRITE,
    Permission.CLINICAL_READ,
  ],
  [PerfilNome.FARMACEUTICO]: [Permission.PATIENT_READ],
  [PerfilNome.RECEPCAO]: [Permission.PATIENT_READ, Permission.PATIENT_CREATE],
  [PerfilNome.GESTOR]: [
    Permission.PATIENT_READ,
    Permission.CLINICAL_READ,
    Permission.AUDIT_READ,
  ],
};

export function permissionsForPerfil(perfil: string): Set<Permission> {
  const list = ROLE_PERMISSIONS[perfil as PerfilNome] ?? [];
  return new Set(list);
}

export function grantsAll(granted: Set<Permission>): boolean {
  return granted.has(Permission.ADMIN_FULL);
}

export function hasPermission(
  granted: Set<Permission>,
  required: Permission,
): boolean {
  return grantsAll(granted) || granted.has(required);
}
