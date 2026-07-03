import { SetMetadata } from '@nestjs/common';
import { PerfilNome } from '../enums/perfil.enum';

export const ROLES_KEY = 'roles';

/** Restringe o endpoint aos perfis informados (RBAC — cap. 149). */
export const Roles = (...roles: PerfilNome[]) => SetMetadata(ROLES_KEY, roles);
