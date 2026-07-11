import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PasswordService } from '../../infra/auth/password.service';
import { TotpService } from '../../infra/auth/totp.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AuthService } from './auth.service';

describe('AuthService.login', () => {
  let service: AuthService;
  let prisma: { usuario: { findFirst: jest.Mock; update: jest.Mock } };
  let jwt: jest.Mocked<JwtService>;
  let config: jest.Mocked<ConfigService>;
  let passwords: jest.Mocked<PasswordService>;
  let auditoria: jest.Mocked<AuditoriaService>;

  const usuarioAtivo = {
    id: 1n,
    login: 'admin',
    senha: 'hash',
    ativo: true,
    deletedAt: null,
    loginAttempts: 0,
    perfil: { nome: 'Administrador' },
  };

  beforeEach(() => {
    prisma = {
      usuario: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue(usuarioAtivo),
      },
    };
    jwt = { signAsync: jest.fn().mockResolvedValue('token') } as unknown as jest.Mocked<JwtService>;
    config = {
      get: jest.fn((key: string, def?: unknown) => def),
      getOrThrow: jest.fn(() => 'secret'),
    } as unknown as jest.Mocked<ConfigService>;
    passwords = {
      verify: jest.fn(),
      hash: jest.fn().mockResolvedValue('rthash'),
    } as unknown as jest.Mocked<PasswordService>;
    auditoria = {
      registrar: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditoriaService>;

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt,
      config,
      passwords,
      new TotpService(),
      auditoria,
    );
  });

  it('emite tokens e zera tentativas em login válido (cap. 112)', async () => {
    prisma.usuario.findFirst.mockResolvedValue(usuarioAtivo);
    passwords.verify.mockResolvedValue(true);

    const tokens = await service.login('admin', 'senha', '127.0.0.1');

    expect(tokens).toEqual({ accessToken: 'token', refreshToken: 'token' });
    expect(prisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ loginAttempts: 0 }),
      }),
    );
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ operacao: 'LOGIN', resultado: 'SUCESSO' }),
    );
  });

  it('rejeita e audita falha quando a senha é inválida', async () => {
    prisma.usuario.findFirst.mockResolvedValue(usuarioAtivo);
    passwords.verify.mockResolvedValue(false);

    await expect(service.login('admin', 'errada')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ operacao: 'LOGIN_FALHA' }),
    );
  });

  it('bloqueia usuário inativo (RN-003)', async () => {
    prisma.usuario.findFirst.mockResolvedValue({
      ...usuarioAtivo,
      ativo: false,
    });

    await expect(service.login('admin', 'senha')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(passwords.verify).not.toHaveBeenCalled();
  });
});
