import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import {
  currentHospitalId,
  currentTx,
} from '../../shared/tenant/tenant-context';
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto';
import { buildPaginatedResult } from '../../shared/dto/paginated-result';
import { AgendarCirurgiaDto, CreateSalaDto } from './dto/cirurgia.dto';

interface ActorCtx {
  actorId: string;
  ip?: string;
  device?: string;
}

// Transições válidas do ciclo de vida da cirurgia.
const TRANSICOES: Record<string, string> = {
  iniciar: 'agendada', // exige status atual "agendada"
  concluir: 'em_andamento',
  cancelar: '*',
};

@Injectable()
export class CirurgiaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private runInTx<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const tx = currentTx();
    return tx ? fn(tx) : this.prisma.$transaction(fn);
  }

  // --- Salas -----------------------------------------------------------------

  async criarSala(dto: CreateSalaDto) {
    return this.prisma.salaCirurgica.create({
      data: { nome: dto.nome, tipo: dto.tipo },
    });
  }

  async listarSalas() {
    return this.prisma.salaCirurgica.findMany({
      where: { ativa: true },
      orderBy: { nome: 'asc' },
    });
  }

  // --- Cirurgias -------------------------------------------------------------

  async agendar(dto: AgendarCirurgiaDto, ctx: ActorCtx) {
    return this.runInTx(async (tx) => {
      const created = await tx.cirurgia.create({
        data: {
          pacienteId: BigInt(dto.pacienteId),
          descricao: dto.descricao,
          medicoId: dto.medicoId ? BigInt(dto.medicoId) : null,
          salaId: dto.salaId ? BigInt(dto.salaId) : null,
          internacaoId: dto.internacaoId ? BigInt(dto.internacaoId) : null,
          dataAgendada: dto.dataAgendada ? new Date(dto.dataAgendada) : null,
          observacoes: dto.observacoes,
          status: 'agendada',
          hospitalId: currentHospitalId(),
          criadoPor: BigInt(ctx.actorId),
        },
      });
      await this.auditoria.registrarTx(tx, {
        usuarioId: ctx.actorId,
        modulo: 'CIRURGIA',
        operacao: 'AGENDAR',
        entity: 'cirurgia',
        entityId: created.id.toString(),
        objeto: dto.pacienteId,
        resultado: 'SUCESSO',
        ip: ctx.ip,
        device: ctx.device,
      });
      return created;
    });
  }

  async listar(query: PaginationQueryDto, filtros: { status?: string }) {
    const hospitalId = currentHospitalId();
    const where: Prisma.CirurgiaWhereInput = {
      ...(hospitalId ? { hospitalId } : {}),
      ...(filtros.status ? { status: filtros.status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.cirurgia.findMany({
        where,
        skip: query.skip,
        take: query.pageSize,
        orderBy: { dataAgendada: query.order },
        include: {
          paciente: { select: { nome: true } },
          sala: { select: { nome: true } },
        },
      }),
      this.prisma.cirurgia.count({ where }),
    ]);
    return buildPaginatedResult(items, total, query.page, query.pageSize);
  }

  /** Transição de status genérica (iniciar/concluir/cancelar). */
  private async transicionar(
    id: string,
    acao: 'iniciar' | 'concluir' | 'cancelar',
    novoStatus: string,
    dataField: 'dataInicio' | 'dataFim' | null,
    ctx: ActorCtx,
  ) {
    return this.runInTx(async (tx) => {
      const atual = await tx.cirurgia.findUnique({
        where: { id: BigInt(id) },
        select: { id: true, status: true },
      });
      if (!atual) throw new NotFoundException('Cirurgia não encontrada.');

      const exigido = TRANSICOES[acao];
      if (exigido !== '*' && atual.status !== exigido) {
        throw new ConflictException(
          `Transição inválida: cirurgia está "${atual.status}".`,
        );
      }
      if (atual.status === 'concluida' || atual.status === 'cancelada') {
        throw new ConflictException('Cirurgia já encerrada.');
      }

      const updated = await tx.cirurgia.update({
        where: { id: atual.id },
        data: {
          status: novoStatus,
          ...(dataField ? { [dataField]: new Date() } : {}),
        },
      });
      await this.auditoria.registrarTx(tx, {
        usuarioId: ctx.actorId,
        modulo: 'CIRURGIA',
        operacao: acao.toUpperCase(),
        entity: 'cirurgia',
        entityId: atual.id.toString(),
        resultado: 'SUCESSO',
        ip: ctx.ip,
        device: ctx.device,
      });
      return updated;
    });
  }

  iniciar(id: string, ctx: ActorCtx) {
    return this.transicionar(id, 'iniciar', 'em_andamento', 'dataInicio', ctx);
  }

  concluir(id: string, ctx: ActorCtx) {
    return this.transicionar(id, 'concluir', 'concluida', 'dataFim', ctx);
  }

  cancelar(id: string, ctx: ActorCtx) {
    return this.transicionar(id, 'cancelar', 'cancelada', null, ctx);
  }
}
