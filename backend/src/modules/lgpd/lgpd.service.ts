import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { currentHospitalId } from '../../shared/tenant/tenant-context';

/** Versão vigente do termo de consentimento (bump ao alterar o texto). */
export const TERMO_VERSAO_ATUAL = '2026.1';

interface Actor {
  actorId: string;
  ip?: string;
}

@Injectable()
export class LgpdService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Registra o aceite do termo (base legal art. 7º/11 LGPD). */
  async registrarConsentimento(
    input: { pacienteId?: string; finalidade: string },
    actor: Actor,
  ) {
    const reg = await this.prisma.consentimentoLgpd.create({
      data: {
        usuarioId: BigInt(actor.actorId),
        pacienteId: input.pacienteId ? BigInt(input.pacienteId) : null,
        termoVersao: TERMO_VERSAO_ATUAL,
        finalidade: input.finalidade,
        ip: actor.ip,
      },
    });
    await this.auditoria.registrar({
      usuarioId: actor.actorId,
      modulo: 'LGPD',
      operacao: 'CONSENTIMENTO',
      objeto: input.finalidade,
      resultado: 'SUCESSO',
      ip: actor.ip,
    });
    return { id: reg.id.toString(), termoVersao: reg.termoVersao };
  }

  /** Consentimento vigente do usuário (para não repetir o banner). */
  async statusConsentimento(actorId: string) {
    const ultimo = await this.prisma.consentimentoLgpd.findFirst({
      where: { usuarioId: BigInt(actorId) },
      orderBy: { registradoEm: 'desc' },
    });
    return {
      termoVersaoAtual: TERMO_VERSAO_ATUAL,
      aceito: ultimo?.termoVersao === TERMO_VERSAO_ATUAL,
      registradoEm: ultimo?.registradoEm ?? null,
    };
  }

  /**
   * Break-the-glass: acesso de EMERGÊNCIA a um prontuário fora do vínculo
   * habitual, mediante justificativa. Aqui a justificativa é registrada de
   * forma imutável (auditoria + consentimento) — o desbloqueio efetivo de
   * escopo cross-tenant é o ponto de extensão. Todo uso é rastreável e
   * revisável pela vigilância de acessos.
   */
  async breakTheGlass(pacienteId: string, justificativa: string, actor: Actor) {
    if (!justificativa || justificativa.trim().length < 10) {
      throw new BadRequestException(
        'Justificativa obrigatória (mínimo 10 caracteres) para acesso de emergência.',
      );
    }
    await this.prisma.consentimentoLgpd.create({
      data: {
        usuarioId: BigInt(actor.actorId),
        pacienteId: BigInt(pacienteId),
        termoVersao: TERMO_VERSAO_ATUAL,
        finalidade: 'break_the_glass',
        ip: actor.ip,
      },
    });
    await this.auditoria.registrar({
      usuarioId: actor.actorId,
      modulo: 'LGPD',
      operacao: 'BREAK_THE_GLASS',
      entity: 'paciente',
      entityId: pacienteId,
      reason: justificativa.trim(),
      resultado: 'SUCESSO',
      ip: actor.ip,
    });
    return { autorizado: true, registrado: true };
  }
}
