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
  CreateAtendimentoPsDto,
  FinalizarPsDto,
} from './dto/pronto-socorro.dto';

interface ActorCtx {
  actorId: string;
  ip?: string;
  device?: string;
}

// Desfecho do PS → status final do atendimento.
const STATUS_POR_DESFECHO: Record<string, string> = {
  alta: 'alta',
  internado: 'internado',
  obito: 'obito',
};

@Injectable()
export class ProntoSocorroService {
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

  async registrarChegada(dto: CreateAtendimentoPsDto, ctx: ActorCtx) {
    return this.runInTx(async (tx) => {
      const created = await tx.atendimentoPS.create({
        data: {
          pacienteId: BigInt(dto.pacienteId),
          triagemId: dto.triagemId ? BigInt(dto.triagemId) : null,
          motivoConsulta: dto.motivoConsulta,
          status: 'em_espera',
          hospitalId: currentHospitalId(),
        },
      });
      await this.auditoria.registrarTx(tx, {
        usuarioId: ctx.actorId,
        modulo: 'PRONTO_SOCORRO',
        operacao: 'CHEGADA',
        entity: 'atendimento_ps',
        entityId: created.id.toString(),
        objeto: dto.pacienteId,
        resultado: 'SUCESSO',
        ip: ctx.ip,
        device: ctx.device,
      });
      return created;
    });
  }

  /** Fila viva do PS: aguardando + em atendimento, por ordem de chegada. */
  async fila() {
    const hospitalId = currentHospitalId();
    return this.prisma.atendimentoPS.findMany({
      where: {
        status: { in: ['em_espera', 'em_atendimento'] },
        ...(hospitalId ? { hospitalId } : {}),
      },
      orderBy: { dataChegada: 'asc' },
      include: { paciente: { select: { nome: true } } },
    });
  }

  async buscarPorId(id: string) {
    const item = await this.prisma.atendimentoPS.findUnique({
      where: { id: BigInt(id) },
      include: { paciente: { select: { nome: true } } },
    });
    if (!item) throw new NotFoundException('Atendimento de PS não encontrado.');
    return item;
  }

  async chamar(id: string, ctx: ActorCtx) {
    return this.runInTx(async (tx) => {
      const atual = await tx.atendimentoPS.findUnique({
        where: { id: BigInt(id) },
        select: { id: true, status: true },
      });
      if (!atual)
        throw new NotFoundException('Atendimento de PS não encontrado.');
      if (atual.status !== 'em_espera') {
        throw new ConflictException(
          'Paciente não está aguardando atendimento.',
        );
      }
      const updated = await tx.atendimentoPS.update({
        where: { id: atual.id },
        data: { status: 'em_atendimento', dataAtendimento: new Date() },
      });
      await this.auditoria.registrarTx(tx, {
        usuarioId: ctx.actorId,
        modulo: 'PRONTO_SOCORRO',
        operacao: 'CHAMAR',
        entity: 'atendimento_ps',
        entityId: atual.id.toString(),
        resultado: 'SUCESSO',
        ip: ctx.ip,
        device: ctx.device,
      });
      return updated;
    });
  }

  async finalizar(id: string, dto: FinalizarPsDto, ctx: ActorCtx) {
    return this.runInTx(async (tx) => {
      const atual = await tx.atendimentoPS.findUnique({
        where: { id: BigInt(id) },
        select: { id: true, status: true },
      });
      if (!atual)
        throw new NotFoundException('Atendimento de PS não encontrado.');
      if (atual.status === 'alta' || atual.status === 'obito') {
        throw new ConflictException('Atendimento já finalizado.');
      }
      const updated = await tx.atendimentoPS.update({
        where: { id: atual.id },
        data: {
          status: STATUS_POR_DESFECHO[dto.desfecho] ?? 'alta',
          diagnosticoPreliminar: dto.diagnosticoPreliminar,
          conduta: dto.conduta,
          dataLiberacao: new Date(),
        },
      });
      await this.auditoria.registrarTx(tx, {
        usuarioId: ctx.actorId,
        modulo: 'PRONTO_SOCORRO',
        operacao: 'FINALIZAR',
        entity: 'atendimento_ps',
        entityId: atual.id.toString(),
        objeto: dto.desfecho,
        resultado: 'SUCESSO',
        ip: ctx.ip,
        device: ctx.device,
      });
      return updated;
    });
  }
}
