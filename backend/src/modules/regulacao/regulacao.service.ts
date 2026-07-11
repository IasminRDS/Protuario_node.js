import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { currentHospitalId } from '../../shared/tenant/tenant-context';
import { VigilanciaService } from '../vigilancia/vigilancia.service';
import {
  AcaoRegulacao,
  CreateEncaminhamentoDto,
  RegularDto,
} from './dto/regulacao.dto';

interface ActorCtx {
  actorId: string;
  ip?: string;
  device?: string;
}

/** Peso para ordenação da fila (maior = mais urgente). */
const PESO_PRIORIDADE: Record<string, number> = {
  emergencia: 3,
  urgencia: 2,
  eletivo: 1,
};

/** Máquina de estados da regulação: ação → { de[], para }. */
const TRANSICOES: Record<AcaoRegulacao, { de: string[]; para: string }> = {
  analisar: { de: ['solicitado'], para: 'em_analise' },
  autorizar: { de: ['solicitado', 'em_analise'], para: 'autorizado' },
  negar: { de: ['solicitado', 'em_analise'], para: 'negado' },
  devolver: { de: ['solicitado', 'em_analise'], para: 'devolvido' },
  agendar: { de: ['autorizado'], para: 'agendado' },
  realizar: { de: ['agendado'], para: 'realizado' },
  cancelar: {
    de: ['solicitado', 'em_analise', 'autorizado', 'agendado', 'devolvido'],
    para: 'cancelado',
  },
};

/** Ações que exigem parecer do regulador. */
const EXIGE_PARECER: AcaoRegulacao[] = ['negar', 'devolver'];

/**
 * Regulação de vagas (SISREG-like): fila única de encaminhamentos entre
 * unidades, ordenada por prioridade clínica + ordem de chegada, com parecer
 * do médico regulador em cada decisão.
 */
@Injectable()
export class RegulacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly vigilancia: VigilanciaService,
  ) {}

  async solicitar(dto: CreateEncaminhamentoDto, ctx: ActorCtx) {
    const created = await this.prisma.encaminhamento.create({
      data: {
        pacienteId: BigInt(dto.pacienteId),
        hospitalId: currentHospitalId(),
        especialidade: dto.especialidade,
        prioridade: dto.prioridade,
        motivo: dto.motivo,
        hipoteseDiagnostica: dto.hipoteseDiagnostica,
        cid: dto.cid,
        servicoDestino: dto.servicoDestino,
        observacoes: dto.observacoes,
        criadoPor: BigInt(ctx.actorId),
      },
    });

    await this.auditoria.registrar({
      usuarioId: ctx.actorId,
      modulo: 'REGULACAO',
      operacao: 'SOLICITAR',
      entity: 'encaminhamento',
      entityId: created.id.toString(),
      objeto: `${dto.especialidade} (${dto.prioridade})`,
      resultado: 'SUCESSO',
      ip: ctx.ip,
      device: ctx.device,
    });

    // Vigilância (SINAN): CID notificável no encaminhamento abre ficha.
    await this.vigilancia.avaliarCid({
      cid: dto.cid,
      pacienteId: created.pacienteId,
      origem: 'REGULACAO',
      origemId: created.id.toString(),
      ctx,
    });

    return this.serialize(created);
  }

  /** Fila de regulação: prioridade clínica desc + ordem de chegada asc. */
  async fila(filtros: {
    status?: string;
    especialidade?: string;
    prioridade?: string;
  }) {
    const rows = await this.prisma.encaminhamento.findMany({
      where: {
        ...(filtros.status
          ? { status: filtros.status }
          : { status: { in: ['solicitado', 'em_analise', 'autorizado', 'agendado', 'devolvido'] } }),
        ...(filtros.especialidade
          ? { especialidade: { contains: filtros.especialidade, mode: 'insensitive' } }
          : {}),
        ...(filtros.prioridade ? { prioridade: filtros.prioridade } : {}),
      },
      orderBy: { dataSolicitacao: 'asc' },
      take: 300,
      include: {
        paciente: { select: { nome: true, cns: true, municipio: true, uf: true } },
      },
    });

    return rows
      .sort(
        (a, b) =>
          (PESO_PRIORIDADE[b.prioridade] ?? 0) - (PESO_PRIORIDADE[a.prioridade] ?? 0) ||
          a.dataSolicitacao.getTime() - b.dataSolicitacao.getTime(),
      )
      .map((r) => ({ ...this.serialize(r), paciente: r.paciente }));
  }

  /** Aplica uma ação do fluxo de regulação validando a máquina de estados. */
  async regular(id: string, dto: RegularDto, ctx: ActorCtx) {
    const transicao = TRANSICOES[dto.acao];
    if (!transicao) throw new BadRequestException('Ação inválida.');
    if (EXIGE_PARECER.includes(dto.acao) && !dto.parecer?.trim()) {
      throw new BadRequestException(`Ação "${dto.acao}" exige parecer do regulador.`);
    }
    if (dto.acao === 'agendar' && !dto.dataAgendada) {
      throw new BadRequestException('Agendamento exige dataAgendada.');
    }

    const atual = await this.prisma.encaminhamento.findUnique({
      where: { id: BigInt(id) },
    });
    if (!atual) throw new NotFoundException('Encaminhamento não encontrado.');
    if (!transicao.de.includes(atual.status)) {
      throw new ConflictException(
        `Transição inválida: ${atual.status} → ${transicao.para}.`,
      );
    }

    const agora = new Date();
    const updated = await this.prisma.encaminhamento.update({
      where: { id: atual.id },
      data: {
        status: transicao.para,
        ...(dto.parecer
          ? { parecerRegulacao: dto.parecer, reguladoPor: BigInt(ctx.actorId), dataRegulacao: agora }
          : {}),
        ...(dto.acao === 'autorizar'
          ? { reguladoPor: BigInt(ctx.actorId), dataRegulacao: agora }
          : {}),
        ...(dto.unidadeDestino ? { unidadeDestino: dto.unidadeDestino } : {}),
        ...(dto.acao === 'agendar' && dto.dataAgendada
          ? { dataAgendada: new Date(dto.dataAgendada) }
          : {}),
        ...(dto.acao === 'realizar' ? { dataRealizacao: agora } : {}),
      },
    });

    await this.auditoria.registrar({
      usuarioId: ctx.actorId,
      modulo: 'REGULACAO',
      operacao: dto.acao.toUpperCase(),
      entity: 'encaminhamento',
      entityId: atual.id.toString(),
      objeto: `${atual.especialidade}: ${atual.status} → ${transicao.para}`,
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
      prontuarioId: bigint | null;
      medicoId: bigint | null;
      criadoPor: bigint | null;
      reguladoPor: bigint | null;
    },
  >(row: T) {
    return {
      ...row,
      id: row.id.toString(),
      pacienteId: row.pacienteId.toString(),
      prontuarioId: row.prontuarioId?.toString() ?? null,
      medicoId: row.medicoId?.toString() ?? null,
      criadoPor: row.criadoPor?.toString() ?? null,
      reguladoPor: row.reguladoPor?.toString() ?? null,
    };
  }
}
