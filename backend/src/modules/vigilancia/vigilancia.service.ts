import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { currentHospitalId } from '../../shared/tenant/tenant-context';
import { findAgravo, normalizeCid } from './agravos.catalog';
import {
  CreateNotificacaoManualDto,
  ResolverNotificacaoDto,
} from './dto/vigilancia.dto';

interface ActorCtx {
  actorId: string;
  ip?: string;
  device?: string;
}

export type OrigemNotificacao = 'INTERNACAO' | 'ALTA' | 'REGULACAO' | 'MANUAL';

/**
 * Vigilância epidemiológica — notificação compulsória (SINAN).
 *
 * `avaliarCid` é o gancho chamado pelos módulos clínicos sempre que um CID-10
 * é registrado; se o CID pertencer à lista nacional de agravos notificáveis,
 * uma ficha PENDENTE é criada automaticamente (deduplicada por paciente+CID
 * enquanto houver pendência aberta). O núcleo de vigilância então ENVIA a
 * notificação ou a DESCARTA com justificativa.
 */
@Injectable()
export class VigilanciaService {
  private readonly logger = new Logger(VigilanciaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Gancho automático: avalia o CID e cria a ficha se notificável.
   * NUNCA lança — falha aqui não pode derrubar o fluxo clínico que a originou.
   */
  async avaliarCid(params: {
    cid: string | null | undefined;
    pacienteId: string | bigint;
    origem: OrigemNotificacao;
    origemId?: string;
    ctx: ActorCtx;
  }): Promise<void> {
    try {
      if (!params.cid) return;
      const agravo = findAgravo(params.cid);
      if (!agravo) return;

      const pacienteId = BigInt(params.pacienteId);
      const cidNorm = normalizeCid(params.cid);

      // Dedup: não abre segunda ficha enquanto houver pendência do mesmo
      // paciente+CID (reavaliações do mesmo caso não são novos agravos).
      const pendente = await this.prisma.notificacaoCompulsoria.findFirst({
        where: { pacienteId, cid: cidNorm, status: 'PENDENTE' },
        select: { id: true },
      });
      if (pendente) return;

      const created = await this.prisma.notificacaoCompulsoria.create({
        data: {
          pacienteId,
          hospitalId: currentHospitalId(),
          origem: params.origem,
          origemId: params.origemId,
          cid: cidNorm,
          agravo: agravo.agravo,
          imediata: agravo.imediata,
          criadoPor: BigInt(params.ctx.actorId),
        },
      });

      await this.auditoria.registrar({
        usuarioId: params.ctx.actorId,
        modulo: 'VIGILANCIA',
        operacao: 'NOTIFICACAO_GERADA',
        entity: 'notificacao_compulsoria',
        entityId: created.id.toString(),
        objeto: `${agravo.agravo} (${cidNorm})`,
        resultado: 'SUCESSO',
        ip: params.ctx.ip,
        device: params.ctx.device,
      });
    } catch (err) {
      // Registro clínico não pode falhar por causa da vigilância.
      this.logger.error(
        `Falha ao avaliar CID notificável (paciente=${params.pacienteId}, cid=${params.cid})`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /** Ficha manual (profissional identifica agravo sem registro estruturado). */
  async criarManual(dto: CreateNotificacaoManualDto, ctx: ActorCtx) {
    const agravo = findAgravo(dto.cid);
    if (!agravo) {
      throw new BadRequestException(
        `CID ${dto.cid} não consta na lista de agravos de notificação compulsória.`,
      );
    }

    const created = await this.prisma.notificacaoCompulsoria.create({
      data: {
        pacienteId: BigInt(dto.pacienteId),
        hospitalId: currentHospitalId(),
        origem: 'MANUAL',
        cid: normalizeCid(dto.cid),
        agravo: agravo.agravo,
        imediata: agravo.imediata,
        observacoes: dto.observacoes,
        criadoPor: BigInt(ctx.actorId),
      },
    });

    await this.auditoria.registrar({
      usuarioId: ctx.actorId,
      modulo: 'VIGILANCIA',
      operacao: 'NOTIFICACAO_MANUAL',
      entity: 'notificacao_compulsoria',
      entityId: created.id.toString(),
      objeto: `${agravo.agravo} (${created.cid})`,
      resultado: 'SUCESSO',
      ip: ctx.ip,
      device: ctx.device,
    });

    return this.serialize(created);
  }

  async list(status?: string) {
    const rows = await this.prisma.notificacaoCompulsoria.findMany({
      where: status ? { status } : undefined,
      orderBy: [{ imediata: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });

    // Paciente buscado à parte (NÃO via include): sob RLS, o SuperAdmin não tem
    // GUC de tenant e o include obrigatório de `paciente` quebraria a query.
    // Aqui a ausência de paciente vira apenas um dado nulo, sem erro.
    const ids = [...new Set(rows.map((r) => r.pacienteId))];
    const pacientes = ids.length
      ? await this.prisma.paciente.findMany({
          where: { id: { in: ids } },
          select: { id: true, nome: true, cns: true, municipio: true, uf: true },
        })
      : [];
    const porId = new Map(pacientes.map((p) => [p.id.toString(), p]));

    return rows.map((r) => {
      const p = porId.get(r.pacienteId.toString());
      return {
        ...this.serialize(r),
        paciente: p
          ? { nome: p.nome, cns: p.cns, municipio: p.municipio, uf: p.uf }
          : { nome: '—', cns: null, municipio: null, uf: null },
      };
    });
  }

  /** ENVIAR (à vigilância) ou DESCARTAR (falso positivo, motivo obrigatório). */
  async resolver(id: string, dto: ResolverNotificacaoDto, ctx: ActorCtx) {
    const ficha = await this.prisma.notificacaoCompulsoria.findUnique({
      where: { id: BigInt(id) },
    });
    if (!ficha) throw new NotFoundException('Notificação não encontrada.');
    if (ficha.status !== 'PENDENTE') {
      throw new ConflictException('Notificação já resolvida.');
    }
    if (dto.acao === 'DESCARTAR' && !dto.motivo?.trim()) {
      throw new BadRequestException('Descarte exige motivo (justificativa).');
    }

    const status = dto.acao === 'ENVIAR' ? 'ENVIADA' : 'DESCARTADA';
    const updated = await this.prisma.notificacaoCompulsoria.update({
      where: { id: ficha.id },
      data: {
        status,
        motivoDescarte: dto.acao === 'DESCARTAR' ? dto.motivo : null,
        resolvidaPor: BigInt(ctx.actorId),
        resolvidaEm: new Date(),
      },
    });

    await this.auditoria.registrar({
      usuarioId: ctx.actorId,
      modulo: 'VIGILANCIA',
      operacao: `NOTIFICACAO_${status}`,
      entity: 'notificacao_compulsoria',
      entityId: ficha.id.toString(),
      objeto: `${ficha.agravo} (${ficha.cid})`,
      resultado: 'SUCESSO',
      ip: ctx.ip,
      device: ctx.device,
    });

    return this.serialize(updated);
  }

  private serialize<
    T extends {
      id: bigint;
      pacienteId: bigint;
      criadoPor: bigint | null;
      resolvidaPor: bigint | null;
    },
  >(row: T) {
    return {
      ...row,
      id: row.id.toString(),
      pacienteId: row.pacienteId.toString(),
      criadoPor: row.criadoPor?.toString() ?? null,
      resolvidaPor: row.resolvidaPor?.toString() ?? null,
    };
  }
}
