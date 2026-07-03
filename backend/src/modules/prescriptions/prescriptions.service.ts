import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { currentHospitalId } from '../../shared/tenant/tenant-context';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';

interface ActorCtx {
  actorId: string;
  ip?: string;
  device?: string;
}

@Injectable()
export class PrescriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async create(dto: CreatePrescriptionDto, ctx: ActorCtx) {
    const atendimento = await this.prisma.atendimento.findFirst({
      where: { id: BigInt(dto.atendimentoId), deletedAt: null },
    });
    if (!atendimento) {
      throw new NotFoundException('Atendimento não encontrado.');
    }

    const p = await this.prisma.prescricao.create({
      data: {
        atendimentoId: atendimento.id,
        medicamento: dto.medication,
        dosagem: dto.dosage,
        frequencia: dto.frequency,
        duracao: dto.duration,
        observacoes: dto.observacoes,
        hospitalId: currentHospitalId(),
      },
    });

    await this.auditoria.registrar({
      usuarioId: ctx.actorId,
      modulo: 'PRESCRIPTION',
      operacao: 'PRESCRIPTION_CREATED',
      entity: 'prescricao',
      entityId: p.id.toString(),
      objeto: dto.atendimentoId,
      resultado: 'SUCESSO',
      ip: ctx.ip,
      device: ctx.device,
    });

    return { ...p, id: p.id.toString(), atendimentoId: dto.atendimentoId };
  }

  async listByAtendimento(atendimentoId: string) {
    const rows = await this.prisma.prescricao.findMany({
      where: { atendimentoId: BigInt(atendimentoId) },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({ ...r, id: r.id.toString(), atendimentoId }));
  }
}
