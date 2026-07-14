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
import {
  CreateTipoExameDto,
  RegistrarResultadoDto,
  SolicitarExameDto,
} from './dto/exames.dto';

interface ActorCtx {
  actorId: string;
  ip?: string;
  device?: string;
}

@Injectable()
export class ExamesService {
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

  // --- Catálogo (TipoExame) --------------------------------------------------

  async criarTipo(dto: CreateTipoExameDto) {
    const existente = await this.prisma.tipoExame.findUnique({
      where: { codigo: dto.codigo },
    });
    if (existente) {
      throw new ConflictException('Já existe tipo de exame com este código.');
    }
    return this.prisma.tipoExame.create({
      data: {
        codigo: dto.codigo,
        nome: dto.nome,
        categoria: dto.categoria,
        instrucoes: dto.instrucoes,
      },
    });
  }

  async listarTipos() {
    return this.prisma.tipoExame.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
    });
  }

  // --- Solicitação / resultado ----------------------------------------------

  async solicitar(dto: SolicitarExameDto, ctx: ActorCtx) {
    const tipo = await this.prisma.tipoExame.findUnique({
      where: { id: BigInt(dto.tipoExameId) },
    });
    if (!tipo) throw new NotFoundException('Tipo de exame não encontrado.');

    return this.runInTx(async (tx) => {
      const created = await tx.exameSolicitado.create({
        data: {
          pacienteId: BigInt(dto.pacienteId),
          tipoExameId: tipo.id,
          prontuarioId: dto.prontuarioId ? BigInt(dto.prontuarioId) : null,
          medicoId: dto.medicoId ? BigInt(dto.medicoId) : null,
          urgencia: dto.urgencia ?? 'rotina',
          indicacaoClinica: dto.indicacaoClinica,
          status: 'solicitado',
          hospitalId: currentHospitalId(),
          criadoPor: BigInt(ctx.actorId),
        },
      });
      await this.auditoria.registrarTx(tx, {
        usuarioId: ctx.actorId,
        modulo: 'EXAMES',
        operacao: 'SOLICITAR',
        entity: 'exame_solicitado',
        entityId: created.id.toString(),
        objeto: dto.pacienteId,
        resultado: 'SUCESSO',
        ip: ctx.ip,
        device: ctx.device,
      });
      return created;
    });
  }

  async listar(
    query: PaginationQueryDto,
    filtros: { status?: string; pacienteId?: string },
  ) {
    const hospitalId = currentHospitalId();
    const where: Prisma.ExameSolicitadoWhereInput = {
      ...(hospitalId ? { hospitalId } : {}),
      ...(filtros.status ? { status: filtros.status } : {}),
      ...(filtros.pacienteId ? { pacienteId: BigInt(filtros.pacienteId) } : {}),
    };
    // Promise.all (não $transaction([...])): sob RLS o pin de conexão só seta o
    // GUC app.hospital_id FORA de tx — numa tx-batch a policy esconderia tudo
    // (lista vazia). Duas leituras pinadas independentes preservam o isolamento.
    const [items, total] = await Promise.all([
      this.prisma.exameSolicitado.findMany({
        where,
        skip: query.skip,
        take: query.pageSize,
        orderBy: { dataSolicitacao: query.order },
        include: {
          tipoExame: { select: { codigo: true, nome: true } },
          paciente: { select: { nome: true } },
        },
      }),
      this.prisma.exameSolicitado.count({ where }),
    ]);
    return buildPaginatedResult(items, total, query.page, query.pageSize);
  }

  async listarPorPaciente(pacienteId: string) {
    return this.prisma.exameSolicitado.findMany({
      where: { pacienteId: BigInt(pacienteId) },
      orderBy: { dataSolicitacao: 'desc' },
      include: { tipoExame: { select: { codigo: true, nome: true } } },
    });
  }

  async marcarColeta(id: string, ctx: ActorCtx) {
    return this.runInTx(async (tx) => {
      const atual = await tx.exameSolicitado.findUnique({
        where: { id: BigInt(id) },
        select: { id: true, status: true },
      });
      if (!atual) throw new NotFoundException('Exame não encontrado.');
      if (atual.status === 'cancelado') {
        throw new ConflictException('Exame cancelado.');
      }
      const updated = await tx.exameSolicitado.update({
        where: { id: atual.id },
        data: { status: 'coletado', dataColeta: new Date() },
      });
      await this.auditoria.registrarTx(tx, {
        usuarioId: ctx.actorId,
        modulo: 'EXAMES',
        operacao: 'COLETA',
        entity: 'exame_solicitado',
        entityId: atual.id.toString(),
        resultado: 'SUCESSO',
        ip: ctx.ip,
        device: ctx.device,
      });
      return updated;
    });
  }

  async registrarResultado(
    id: string,
    dto: RegistrarResultadoDto,
    ctx: ActorCtx,
  ) {
    return this.runInTx(async (tx) => {
      const atual = await tx.exameSolicitado.findUnique({
        where: { id: BigInt(id) },
        select: { id: true, status: true },
      });
      if (!atual) throw new NotFoundException('Exame não encontrado.');
      if (atual.status === 'cancelado') {
        throw new ConflictException('Exame cancelado.');
      }
      const updated = await tx.exameSolicitado.update({
        where: { id: atual.id },
        data: {
          status: 'resultado_disponivel',
          dataResultado: new Date(),
          resultadoTexto: dto.resultadoTexto,
          resultadoValor: dto.resultadoValor,
          resultadoUnidade: dto.resultadoUnidade,
          valorReferencia: dto.valorReferencia,
          interpretacao: dto.interpretacao,
        },
      });
      await this.auditoria.registrarTx(tx, {
        usuarioId: ctx.actorId,
        modulo: 'EXAMES',
        operacao: 'RESULTADO',
        entity: 'exame_solicitado',
        entityId: atual.id.toString(),
        objeto: dto.interpretacao,
        resultado: 'SUCESSO',
        ip: ctx.ip,
        device: ctx.device,
      });
      return updated;
    });
  }
}
