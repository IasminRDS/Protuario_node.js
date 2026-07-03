import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { hasPermission, permissionsForPerfil, Permission } from '../rbac/permissions';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * Autorização por permissão granular. Executa após o JwtAuthGuard. Só enforça
 * quando o endpoint declara @RequirePermissions(...); caso contrário, permite.
 * Convive com o RolesGuard (perfis) para os módulos legados.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    const granted = user ? permissionsForPerfil(user.perfil) : new Set<Permission>();

    const ok = required.every((p) => hasPermission(granted, p));
    if (!ok) {
      throw new ForbiddenException('Permissão insuficiente para a operação.');
    }
    return true;
  }
}
