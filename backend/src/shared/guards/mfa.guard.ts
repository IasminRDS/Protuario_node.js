import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PerfilNome } from '../enums/perfil.enum';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/** Perfis com poder administrativo: MFA é OBRIGATÓRIO p/ operações sensíveis. */
const PERFIS_ADMINISTRATIVOS: string[] = [
  PerfilNome.SUPER_ADMIN,
  PerfilNome.ADMINISTRADOR,
  PerfilNome.GESTOR,
];

/**
 * Step-up MFA para operações sensíveis (export/backup de dados — LGPD).
 * Executa APÓS o JwtAuthGuard. Regras (fail-closed p/ admins):
 *  - usuário com MFA ativo: a SESSÃO precisa ter passado pelo desafio TOTP
 *    (claim `mfa` no token) — senão 403 orientando novo login;
 *  - perfil administrativo SEM MFA ativo: 403 orientando ativar o MFA;
 *  - demais perfis sem MFA: passam (não quebra fluxos operacionais).
 * Desligável via MFA_ENFORCE_EXPORT=false (ambientes de teste).
 */
@Injectable()
export class MfaGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const enforce = this.config.get<boolean>('MFA_ENFORCE_EXPORT', true);
    if (!enforce) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) return false; // JwtAuthGuard já deve ter barrado

    if (user.mfaEnabled) {
      if (!user.mfaVerified) {
        throw new ForbiddenException(
          'Operação sensível: refaça o login informando o código MFA.',
        );
      }
      return true;
    }

    if (PERFIS_ADMINISTRATIVOS.includes(user.perfil)) {
      throw new ForbiddenException(
        'Perfis administrativos exigem MFA ativo para exportar dados. Ative o MFA em Conta > Segurança.',
      );
    }
    return true;
  }
}
