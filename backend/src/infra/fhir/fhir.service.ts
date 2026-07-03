import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toFhirPatient, FhirResource } from './patient.mapper';
import { toFhirEncounter } from './encounter.mapper';
import { toFhirMedicationRequest } from './clinical.mapper';

/**
 * Camada de interoperabilidade FHIR R4. Lê entidades internas e as expõe como
 * recursos FHIR (exportação compatível / integração futura com RNDS-SUS).
 */
@Injectable()
export class FhirService {
  constructor(private readonly prisma: PrismaService) {}

  async patient(id: string): Promise<FhirResource> {
    const p = await this.prisma.paciente.findUnique({ where: { id: BigInt(id) } });
    if (!p) throw new NotFoundException('Paciente não encontrado.');
    return toFhirPatient(p);
  }

  async encounter(id: string): Promise<FhirResource> {
    const a = await this.prisma.atendimento.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!a) throw new NotFoundException('Atendimento não encontrado.');
    return toFhirEncounter(a);
  }

  /** Bundle (searchset) das prescrições de um atendimento como MedicationRequest. */
  async medicationRequestsByEncounter(atendimentoId: string): Promise<FhirResource> {
    const rows = await this.prisma.prescricao.findMany({
      where: { atendimentoId: BigInt(atendimentoId) },
    });
    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: rows.length,
      entry: rows.map((r) => ({ resource: toFhirMedicationRequest(r) })),
    };
  }
}
