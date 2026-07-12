import { Injectable, NotFoundException } from '@nestjs/common';
import { Atendimento, Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PatientFlowService } from '../clinical/patient-flow.service';
import { currentHospitalId, currentTx } from '../../shared/tenant/tenant-context';
import { DomainError } from '../../shared/errors/domain-error';
import { CreateNoteDto, StartEncounterDto } from './dto/encounter.dto';

interface ActorCtx {
  actorId: string;
  ip?: string;
  device?: string;
}

function view(a: Atendimento) {
  return {
    id: a.id.toString(),
    pacienteId: a.pacienteId.toString(),
    doctorId: a.medicoId.toString(),
    tipo: a.tipo,
    status: a.status,
    startedAt: a.data,
    finishedAt: a.finishedAt,
  };
}

@Injectable()
export class EncountersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flow: PatientFlowService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Reusa a transação da request (aberta pelo TenantTxInterceptor, já com o
   * GUC `app.hospital_id` — necessário para as policies RLS em INSERT/UPDATE).
   * Abrir uma $transaction própria criaria uma conexão SEM o GUC e o RLS
   * recusaria a escrita ("violates row-level security policy").
   */
  private runInTx<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    const tx = currentTx();
    return tx ? fn(tx) : this.prisma.$transaction(fn);
  }

  /** Inicia o atendimento: WAITING_DOCTOR → IN_CONSULTATION (mesma transação). */
  async start(dto: StartEncounterDto, ctx: ActorCtx) {
    const pacienteId = BigInt(dto.pacienteId);
    const atendimento = await this.runInTx(async (tx) => {
      const created = await tx.atendimento.create({
        data: {
          pacienteId,
          medicoId: BigInt(ctx.actorId),
          tipo: dto.tipo ?? 'CONSULTA',
          status: 'ACTIVE',
          hospitalId: currentHospitalId(),
        },
      });
      await this.flow.transition(tx, pacienteId, 'IN_CONSULTATION', ctx.actorId);
      return created;
    });

    await this.audit(ctx, 'ENCOUNTER_STARTED', atendimento.id);
    return view(atendimento);
  }

  async pause(id: string, ctx: ActorCtx) {
    return this.setStatus(id, 'ACTIVE', 'PAUSED', 'ENCOUNTER_PAUSED', ctx);
  }
  async resume(id: string, ctx: ActorCtx) {
    return this.setStatus(id, 'PAUSED', 'ACTIVE', 'ENCOUNTER_RESUMED', ctx);
  }
  async cancel(id: string, ctx: ActorCtx) {
    const at = await this.load(id);
    if (at.status === 'FINISHED') {
      throw new DomainError('ENCOUNTER_FINALIZADO', 'Atendimento já finalizado.');
    }
    const updated = await this.prisma.atendimento.update({
      where: { id: at.id },
      data: { status: 'CANCELLED' },
    });
    await this.audit(ctx, 'ENCOUNTER_CANCELLED', at.id);
    return view(updated);
  }

  /** Coloca o paciente em observação (IN_CONSULTATION → UNDER_OBSERVATION). */
  async observe(id: string, ctx: ActorCtx) {
    const at = await this.load(id);
    await this.runInTx(async (tx) => {
      await this.flow.transition(tx, at.pacienteId, 'UNDER_OBSERVATION', ctx.actorId);
    });
    await this.audit(ctx, 'ENCOUNTER_OBSERVATION', at.id);
    return view(at);
  }

  /** Alta: encerra o atendimento e move o paciente para DISCHARGED. */
  async discharge(id: string, ctx: ActorCtx) {
    const at = await this.load(id);
    const updated = await this.runInTx(async (tx) => {
      const u = await tx.atendimento.update({
        where: { id: at.id },
        data: { status: 'FINISHED', finishedAt: new Date() },
      });
      await this.flow.transition(tx, at.pacienteId, 'DISCHARGED', ctx.actorId);
      return u;
    });
    await this.audit(ctx, 'PATIENT_DISCHARGED', at.id);
    return view(updated);
  }

  /** Evolução clínica (nota) vinculada ao atendimento e ao prontuário. */
  async addNote(id: string, dto: CreateNoteDto, ctx: ActorCtx) {
    const at = await this.load(id);
    const nota = await this.prisma.prontuario.create({
      data: {
        atendimentoId: at.id,
        pacienteId: at.pacienteId,
        evolucao: dto.evolucao,
        diagnostico: dto.diagnostico,
        hospitalId: currentHospitalId(),
      },
    });
    await this.audit(ctx, 'CLINICAL_NOTE_ADDED', at.id);
    return { id: nota.id.toString(), atendimentoId: id, createdAt: nota.createdAt };
  }

  async list(params: { status?: string; pacienteId?: string }) {
    const rows = await this.prisma.atendimento.findMany({
      where: {
        deletedAt: null,
        ...(params.status ? { status: params.status } : {}),
        ...(params.pacienteId ? { pacienteId: BigInt(params.pacienteId) } : {}),
      },
      orderBy: { data: 'desc' },
      take: 100,
    });
    return rows.map(view);
  }

  async getById(id: string) {
    return view(await this.load(id));
  }

  // ---- helpers ----
  private async load(id: string): Promise<Atendimento> {
    const at = await this.prisma.atendimento.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!at) throw new NotFoundException('Atendimento não encontrado.');
    return at;
  }

  private async setStatus(
    id: string,
    from: string,
    to: string,
    op: string,
    ctx: ActorCtx,
  ) {
    const at = await this.load(id);
    if (at.status !== from) {
      throw new DomainError('ENCOUNTER_ESTADO', `Atendimento não está ${from}.`);
    }
    const updated = await this.prisma.atendimento.update({
      where: { id: at.id },
      data: { status: to },
    });
    await this.audit(ctx, op, at.id);
    return view(updated);
  }

  private audit(ctx: ActorCtx, operacao: string, entityId: bigint) {
    return this.auditoria.registrar({
      usuarioId: ctx.actorId,
      modulo: 'ENCOUNTER',
      operacao,
      entity: 'atendimento',
      entityId: entityId.toString(),
      resultado: 'SUCESSO',
      ip: ctx.ip,
      device: ctx.device,
    });
  }
}
