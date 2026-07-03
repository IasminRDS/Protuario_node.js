import { SetMetadata } from '@nestjs/common';
import { Permission } from '../rbac/permissions';

export const PERMISSIONS_KEY = 'permissions';

/** Exige TODAS as permissões informadas para acessar o endpoint (RBAC granular). */
export const RequirePermissions = (...perms: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, perms);
