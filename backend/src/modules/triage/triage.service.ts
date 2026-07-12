import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PatientFlowService } from '../clinical/patient-flow.service';
import { currentHospitalId, currentTx } from '../../shared/tenant/tenant-context';
import { CreateTriageDto } from './dto/create-triage.dto';

interface ActorCtx {
  actorId: string;
  ip?: string;
  device?: string;
}

@Injectable()
export class TriageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flow: PatientFlowService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Registra a triagem e avança o paciente REGISTERED → IN_TRIAGE →
   * WAITING_DOCTOR, tudo na mesma transação (integridade do fluxo).
   */
  async create(dto: CreateTriageDto, ctx: ActorCtx) {
    const pacienteId = BigInt(dto.pacienteId);

    // Reusa a tx da request (com o GUC RLS); só abre própria se não houver.
    const runInTx = <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => {
      const tx = currentTx();
      return tx ? fn(tx) : this.prisma.$transaction(fn);
    };

    const triagem = await runInTx(async (tx) => {
      const created = await tx.triagem.create({
        data: {
          pacienteId,
          pressao: dto.pressure,
          temperatura: dto.temperature,
          frequencia: dto.heartRate,
          saturacao: dto.oxygenSaturation,
          peso: dto.weight,
          altura: dto.height,
          classificacao: dto.riskLevel,
          observacoes: dto.observacoes,
          hospitalId: currentHospitalId(),
        },
      });

      await this.flow.transition(tx, pacienteId, 'IN_TRIAGE', ctx.actorId);
      await this.flow.transition(tx, pacienteId, 'WAITING_DOCTOR', ctx.actorId);
      return created;
    });

    await this.auditoria.registrar({
      usuarioId: ctx.actorId,
      modulo: 'TRIAGE',
      operacao: 'TRIAGE_REGISTERED',
      entity: 'triagem',
      entityId: triagem.id.toString(),
      objeto: dto.pacienteId,
      resultado: 'SUCESSO',
      ip: ctx.ip,
      device: ctx.device,
    });

    return { ...triagem, id: triagem.id.toString(), pacienteId: dto.pacienteId };
  }

  async listByPaciente(pacienteId: string) {
    const rows = await this.prisma.triagem.findMany({
      where: { pacienteId: BigInt(pacienteId) },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({ ...r, id: r.id.toString() }));
  }
}
