import { Injectable } from '@nestjs/common';
import { PrismaLike } from '../outbox/prisma-tx.type';
import { DomainError } from '../../shared/errors/domain-error';
import { PatientStatus } from '../../domain/patient/state-machine';
import { PatientRules } from '../../domain/patient/rules';

// Re-export para compatibilidade dos serviços que importavam daqui.
export type { PatientStatus };

@Injectable()
export class PatientFlowService {
  /**
   * Aplica uma transição de estado do paciente DENTRO da transação clínica.
   * A validação usa o DOMÍNIO PURO (`domain/patient`) — fonte única do FSM.
   * A auditoria do evento de negócio é feita pelo serviço chamador.
   */
  async transition(
    db: PrismaLike,
    pacienteId: bigint,
    to: PatientStatus,
    actorId: string,
  ): Promise<{ from: PatientStatus; to: PatientStatus }> {
    const paciente = await db.paciente.findUnique({
      where: { id: pacienteId },
      select: { status: true },
    });
    if (!paciente) {
      throw new DomainError('PACIENTE_NAO_ENCONTRADO', 'Paciente não encontrado.');
    }

    const from = paciente.status as PatientStatus;
    PatientRules.assertTransition(from, to); // invariante de domínio
    if (from === to) return { from, to };

    await db.paciente.update({
      where: { id: pacienteId },
      data: { status: to, updatedBy: BigInt(actorId) },
    });
    return { from, to };
  }
}
