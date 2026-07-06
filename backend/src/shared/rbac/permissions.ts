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

  // FASE 2 — módulos hospitalares (migração paridade Flask)
  INTERNMENT_WRITE = 'internment:write', // internação / leitos / evolução
  EMERGENCY_WRITE = 'emergency:write', // pronto-socorro (fila / atendimento)
  EXAM_WRITE = 'exam:write', // solicitação / resultado de exames
  SURGERY_WRITE = 'surgery:write', // centro cirúrgico
  MED_ADMIN_WRITE = 'med-admin:write', // administração de medicação (enfermagem)
}

const ROLE_PERMISSIONS: Record<PerfilNome, Permission[]> = {
  // SUPER_ADMIN: acesso total à plataforma + gestão de hospitais (tenants).
  [PerfilNome.SUPER_ADMIN]: [Permission.ADMIN_FULL, Permission.HOSPITAL_MANAGE],
  // ADMINISTRADOR: admin dentro do próprio hospital (escopado por tenant).
  [PerfilNome.ADMINISTRADOR]: [Permission.ADMIN_FULL],
  [PerfilNome.MEDICO]: [
    Permission.PATIENT_READ,
    Permission.CLINICAL_READ,
    Permission.ENCOUNTER_WRITE,
    Permission.PRESCRIPTION_WRITE,
    Permission.INTERNMENT_WRITE,
    Permission.EMERGENCY_WRITE,
    Permission.EXAM_WRITE,
    Permission.SURGERY_WRITE,
  ],
  [PerfilNome.ENFERMEIRO]: [
    Permission.PATIENT_READ,
    Permission.TRIAGE_WRITE,
    Permission.CLINICAL_READ,
    Permission.EMERGENCY_WRITE,
    Permission.EXAM_WRITE,
    Permission.INTERNMENT_WRITE,
    Permission.MED_ADMIN_WRITE,
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

/**
 * Único perfil autorizado a atravessar o isolamento de tenant. A checagem é
 * feita a partir do perfil carregado do banco (JwtStrategy), NÃO de um flag
 * arbitrário do token — o cliente não consegue se auto-promover.
 */
export function isSuperAdmin(perfil: string): boolean {
  return perfil === PerfilNome.SUPER_ADMIN;
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
