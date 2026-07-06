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
  AltaDto,
  CreateEvolucaoDto,
  CreateInternacaoDto,
  CreateLeitoDto,
  CreateSetorDto,
} from './dto/internacao.dto';

interface ActorCtx {
  actorId: string;
  ip?: string;
  device?: string;
}

// Mapa tipo de alta → status final da internação (mantém enum em MAIÚSCULA,
// consistente com o default "ATIVA" do schema).
const STATUS_POR_ALTA: Record<string, string> = {
  curado: 'ALTA',
  melhorado: 'ALTA',
  a_pedido: 'ALTA',
  evasao: 'ALTA',
  transferencia: 'TRANSFERIDA',
  obito: 'OBITO',
};

@Injectable()
export class InternacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** F0.1/F0.2: reusa a tx da requisição (mutações) ou abre a própria. */
  private runInTx<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const tx = currentTx();
    return tx ? fn(tx) : this.prisma.$transaction(fn);
  }

  // --- Setores / Leitos ------------------------------------------------------

  async criarSetor(dto: CreateSetorDto) {
    return this.prisma.setor.create({
      data: {
        nome: dto.nome,
        sigla: dto.sigla,
        tipo: dto.tipo ?? 'enfermaria',
        andar: dto.andar,
        responsavel: dto.responsavel,
        hospitalId: currentHospitalId(),
      },
    });
  }

  async listarSetores() {
    const hospitalId = currentHospitalId();
    return this.prisma.setor.findMany({
      where: { ativo: true, ...(hospitalId ? { hospitalId } : {}) },
      orderBy: { nome: 'asc' },
      include: {
        leitos: {
          where: { ativo: true },
          orderBy: { numero: 'asc' },
        },
      },
    });
  }

  async criarLeito(dto: CreateLeitoDto) {
    const setor = await this.prisma.setor.findUnique({
      where: { id: BigInt(dto.setorId) },
    });
    if (!setor) throw new NotFoundException('Setor não encontrado.');

    return this.prisma.leito.create({
      data: {
        setorId: setor.id,
        numero: dto.numero,
        tipo: dto.tipo,
        observacoes: dto.observacoes,
        hospitalId: currentHospitalId() ?? setor.hospitalId,
      },
    });
  }

  async listarLeitos(filtros: { status?: string; setorId?: string }) {
    const hospitalId = currentHospitalId();
    return this.prisma.leito.findMany({
      where: {
        ativo: true,
        ...(hospitalId ? { hospitalId } : {}),
        ...(filtros.status ? { status: filtros.status } : {}),
        ...(filtros.setorId ? { setorId: BigInt(filtros.setorId) } : {}),
      },
      orderBy: [{ setorId: 'asc' }, { numero: 'asc' }],
      include: { setor: { select: { nome: true, sigla: true } } },
    });
  }

  // --- Internação ------------------------------------------------------------

  /** Interna o paciente ocupando um leito LIVRE (tudo atômico). */
  async internar(dto: CreateInternacaoDto, ctx: ActorCtx) {
    const hospitalId = currentHospitalId();

    const internacao = await this.runInTx(async (tx) => {
      const leito = await tx.leito.findUnique({
        where: { id: BigInt(dto.leitoId) },
      });
      if (!leito || !leito.ativo) {
        throw new NotFoundException('Leito não encontrado.');
      }
      if (hospitalId && leito.hospitalId && leito.hospitalId !== hospitalId) {
        throw new NotFoundException('Leito não encontrado.');
      }
      if (leito.status !== 'livre') {
        throw new ConflictException('Leito não está livre.');
      }

      const created = await tx.internacao.create({
        data: {
          pacienteId: BigInt(dto.pacienteId),
          leito: leito.numero, // compat. legado (identificador textual)
          leitoId: leito.id,
          medicoId: dto.medicoId ? BigInt(dto.medicoId) : null,
          tipo: dto.tipo ?? 'clinica',
          motivo: dto.motivo,
          hipoteseDiag: dto.hipoteseDiag,
          cidPrincipal: dto.cidPrincipal,
          dataPrevistaAlta: dto.dataPrevistaAlta
            ? new Date(dto.dataPrevistaAlta)
            : null,
          status: 'ATIVA',
          hospitalId,
        },
      });

      await tx.leito.update({
        where: { id: leito.id },
        data: { status: 'ocupado' },
      });

      await this.auditoria.registrarTx(tx, {
        usuarioId: ctx.actorId,
        modulo: 'INTERNACAO',
        operacao: 'INTERNAR',
        entity: 'internacao',
        entityId: created.id.toString(),
        objeto: dto.pacienteId,
        resultado: 'SUCESSO',
        ip: ctx.ip,
        device: ctx.device,
      });
      return created;
    });

    return internacao;
  }

  async listarAtivas(query: PaginationQueryDto) {
    const hospitalId = currentHospitalId();
    const where: Prisma.InternacaoWhereInput = {
      status: 'ATIVA',
      ...(hospitalId ? { hospitalId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.internacao.findMany({
        where,
        skip: query.skip,
        take: query.pageSize,
        orderBy: { entrada: query.order },
        include: {
          paciente: { select: { nome: true } },
          leitoRef: { select: { numero: true } },
        },
      }),
      this.prisma.internacao.count({ where }),
    ]);
    return buildPaginatedResult(items, total, query.page, query.pageSize);
  }

  async buscarPorId(id: string) {
    const internacao = await this.prisma.internacao.findUnique({
      where: { id: BigInt(id) },
      include: {
        paciente: { select: { nome: true } },
        leitoRef: { select: { numero: true } },
        evolucoes: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!internacao) throw new NotFoundException('Internação não encontrada.');
    return internacao;
  }

  async adicionarEvolucao(id: string, dto: CreateEvolucaoDto, ctx: ActorCtx) {
    const internacao = await this.prisma.internacao.findUnique({
      where: { id: BigInt(id) },
      select: { id: true, status: true },
    });
    if (!internacao) throw new NotFoundException('Internação não encontrada.');
    if (internacao.status !== 'ATIVA') {
      throw new ConflictException(
        'Só é possível evoluir uma internação ativa.',
      );
    }

    return this.runInTx(async (tx) => {
      const evolucao = await tx.evolucaoInternacao.create({
        data: {
          internacaoId: internacao.id,
          profissionalId: BigInt(ctx.actorId),
          tipo: dto.tipo ?? 'medica',
          pressaoArterial: dto.pressaoArterial,
          temperatura: dto.temperatura,
          frequenciaCardiaca: dto.frequenciaCardiaca,
          frequenciaResp: dto.frequenciaResp,
          saturacaoO2: dto.saturacaoO2,
          diureseMl: dto.diureseMl,
          balancoHidrico: dto.balancoHidrico,
          subjetivo: dto.subjetivo,
          objetivo: dto.objetivo,
          avaliacao: dto.avaliacao,
          plano: dto.plano,
        },
      });
      await this.auditoria.registrarTx(tx, {
        usuarioId: ctx.actorId,
        modulo: 'INTERNACAO',
        operacao: 'EVOLUCAO',
        entity: 'internacao',
        entityId: internacao.id.toString(),
        objeto: evolucao.id.toString(),
        resultado: 'SUCESSO',
        ip: ctx.ip,
        device: ctx.device,
      });
      return evolucao;
    });
  }

  /** Dá alta à internação e libera o leito para higienização. */
  async darAlta(id: string, dto: AltaDto, ctx: ActorCtx) {
    return this.runInTx(async (tx) => {
      const internacao = await tx.internacao.findUnique({
        where: { id: BigInt(id) },
      });
      if (!internacao)
        throw new NotFoundException('Internação não encontrada.');
      if (internacao.status !== 'ATIVA') {
        throw new ConflictException('Internação não está ativa.');
      }

      const status = STATUS_POR_ALTA[dto.tipoAlta] ?? 'ALTA';
      const agora = new Date();

      const atualizada = await tx.internacao.update({
        where: { id: internacao.id },
        data: {
          status,
          alta: agora,
          tipoAlta: dto.tipoAlta,
          sumarioAlta: dto.sumarioAlta,
          cidAlta: dto.cidAlta,
        },
      });

      if (internacao.leitoId) {
        await tx.leito.update({
          where: { id: internacao.leitoId },
          data: { status: 'em_higienizacao' },
        });
      }

      await this.auditoria.registrarTx(tx, {
        usuarioId: ctx.actorId,
        modulo: 'INTERNACAO',
        operacao: 'ALTA',
        entity: 'internacao',
        entityId: internacao.id.toString(),
        objeto: dto.tipoAlta,
        resultado: 'SUCESSO',
        ip: ctx.ip,
        device: ctx.device,
      });
      return atualizada;
    });
  }
}
