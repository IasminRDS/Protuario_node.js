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
import {
  AdministrarDto,
  CreatePrescricaoHospDto,
} from './dto/prescricao-hospitalar.dto';

interface ActorCtx {
  actorId: string;
  ip?: string;
  device?: string;
}

@Injectable()
export class PrescricaoHospitalarService {
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

  async criar(dto: CreatePrescricaoHospDto, ctx: ActorCtx) {
    return this.runInTx(async (tx) => {
      const created = await tx.prescricaoHospitalar.create({
        data: {
          pacienteId: BigInt(dto.pacienteId),
          internacaoId: dto.internacaoId ? BigInt(dto.internacaoId) : null,
          medicoId: dto.medicoId ? BigInt(dto.medicoId) : null,
          validadeHoras: dto.validadeHoras ?? 24,
          observacoes: dto.observacoes,
          status: 'ativa',
          hospitalId: currentHospitalId(),
          criadoPor: BigInt(ctx.actorId),
          itens: {
            create: dto.itens.map((i) => ({
              medicamentoId: i.medicamentoId ? BigInt(i.medicamentoId) : null,
              nomeLivre: i.nomeLivre,
              dose: i.dose,
              via: i.via,
              frequencia: i.frequencia,
              instrucoes: i.instrucoes,
            })),
          },
        },
        include: { itens: true },
      });
      await this.auditoria.registrarTx(tx, {
        usuarioId: ctx.actorId,
        modulo: 'PRESCRICAO_HOSP',
        operacao: 'CRIAR',
        entity: 'prescricao_hospitalar',
        entityId: created.id.toString(),
        objeto: dto.pacienteId,
        resultado: 'SUCESSO',
        ip: ctx.ip,
        device: ctx.device,
      });
      return created;
    });
  }

  async listarPorPaciente(pacienteId: string) {
    return this.prisma.prescricaoHospitalar.findMany({
      where: { pacienteId: BigInt(pacienteId) },
      orderBy: { dataPrescricao: 'desc' },
      include: { itens: { include: { administracoes: true } } },
    });
  }

  async listarPorInternacao(internacaoId: string) {
    return this.prisma.prescricaoHospitalar.findMany({
      where: { internacaoId: BigInt(internacaoId) },
      orderBy: { dataPrescricao: 'desc' },
      include: { itens: { include: { administracoes: true } } },
    });
  }

  /** Checagem/administração de um item pela enfermagem. */
  async administrar(itemId: string, dto: AdministrarDto, ctx: ActorCtx) {
    return this.runInTx(async (tx) => {
      const item = await tx.itemPrescricaoHosp.findUnique({
        where: { id: BigInt(itemId) },
        select: { id: true, prescricao: { select: { status: true } } },
      });
      if (!item)
        throw new NotFoundException('Item de prescrição não encontrado.');
      if (item.prescricao.status !== 'ativa') {
        throw new ConflictException('Prescrição não está ativa.');
      }
      const adm = await tx.administracaoMed.create({
        data: {
          itemPrescricaoId: item.id,
          administradoPor: BigInt(ctx.actorId),
          dataAdministracao: new Date(),
          status: dto.status,
          observacoes: dto.observacoes,
        },
      });
      await this.auditoria.registrarTx(tx, {
        usuarioId: ctx.actorId,
        modulo: 'PRESCRICAO_HOSP',
        operacao: 'ADMINISTRAR',
        entity: 'item_prescricao_hosp',
        entityId: item.id.toString(),
        objeto: dto.status,
        resultado: 'SUCESSO',
        ip: ctx.ip,
        device: ctx.device,
      });
      return adm;
    });
  }

  async suspender(id: string, ctx: ActorCtx) {
    return this.runInTx(async (tx) => {
      const atual = await tx.prescricaoHospitalar.findUnique({
        where: { id: BigInt(id) },
        select: { id: true, status: true },
      });
      if (!atual) throw new NotFoundException('Prescrição não encontrada.');
      if (atual.status !== 'ativa') {
        throw new ConflictException('Prescrição não está ativa.');
      }
      const updated = await tx.prescricaoHospitalar.update({
        where: { id: atual.id },
        data: { status: 'suspensa' },
      });
      await this.auditoria.registrarTx(tx, {
        usuarioId: ctx.actorId,
        modulo: 'PRESCRICAO_HOSP',
        operacao: 'SUSPENDER',
        entity: 'prescricao_hospitalar',
        entityId: atual.id.toString(),
        resultado: 'SUCESSO',
        ip: ctx.ip,
        device: ctx.device,
      });
      return updated;
    });
  }
}
