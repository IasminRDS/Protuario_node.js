import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PerfilNome } from '../enums/perfil.enum';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * Autorização baseada em perfil (RBAC — RN-049). Executa após o JwtAuthGuard.
 * Se o endpoint não declarar @Roles(), permite qualquer usuário autenticado.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PerfilNome[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user || !required.includes(user.perfil as PerfilNome)) {
      throw new ForbiddenException('Acesso negado para o perfil atual.');
    }
    return true;
  }
}
