import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../infra/prisma/prisma.service';
import {
  AuthenticatedUser,
  JwtPayload,
} from '../../shared/interfaces/authenticated-user.interface';
import { tenantStore } from '../../shared/tenant/tenant-context';

/**
 * Valida o access token e garante que o usuário ainda existe e está ativo
 * (RN-003: usuário inativo não pode operar).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: BigInt(payload.sub), ativo: true, deletedAt: null },
      include: { perfil: true },
    });

    if (!usuario) {
      throw new UnauthorizedException('Usuário inválido ou inativo.');
    }

    // Popula o contexto de tenant da requisição (multi-hospital).
    const store = tenantStore.getStore();
    if (store) {
      store.hospitalId = usuario.hospitalId ?? null;
      store.userId = usuario.id.toString();
    }

    return {
      id: usuario.id.toString(),
      login: usuario.login,
      perfil: usuario.perfil.nome,
      hospitalId: usuario.hospitalId ?? null,
    };
  }
}
