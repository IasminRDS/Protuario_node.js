import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { currentHospitalId } from '../../shared/tenant/tenant-context';
import { toFhirPatient, FhirResource } from '../../infra/fhir/patient.mapper';
import { toFhirEncounter } from '../../infra/fhir/encounter.mapper';
import { toFhirImmunization } from '../../infra/fhir/immunization.mapper';

export type TipoEnvioRnds = 'RAC' | 'RIA' | 'RESULTADO_EXAME';

/**
 * Interoperabilidade RNDS. Constrói o bundle FHIR do registro e o "envia" à
 * Rede Nacional de Dados em Saúde, rastreando o status por registro.
 *
 * O transporte real (mTLS + token do gov.br + POST no endpoint da RNDS) fica
 * atrás de `despachar()`; sem credenciais, opera em modo mock (protocolo
 * gerado localmente) — o bundle FHIR é 100% real e inspecionável.
 */
@Injectable()
export class RndsService {
  private readonly logger = new Logger(RndsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Monta o recurso/bundle FHIR de um registro clínico. */
  async montarRecurso(
    tipo: TipoEnvioRnds,
    entityId: string,
  ): Promise<{ recursoTipo: string; pacienteId: bigint; recurso: FhirResource }> {
    if (tipo === 'RIA') {
      const v = await this.prisma.vacinaAplicada.findUnique({
        where: { id: BigInt(entityId) },
        include: { vacina: { select: { nome: true } } },
      });
      if (!v) throw new NotFoundException('Vacina aplicada não encontrada.');
      return {
        recursoTipo: 'Immunization',
        pacienteId: v.pacienteId,
        recurso: toFhirImmunization(v),
      };
    }

    if (tipo === 'RESULTADO_EXAME') {
      const e = await this.prisma.exameSolicitado.findUnique({
        where: { id: BigInt(entityId) },
        include: { tipoExame: { select: { nome: true, codigo: true } } },
      });
      if (!e) throw new NotFoundException('Exame não encontrado.');
      return {
        recursoTipo: 'DiagnosticReport',
        pacienteId: e.pacienteId,
        recurso: {
          resourceType: 'DiagnosticReport',
          id: e.id.toString(),
          status: e.status === 'resultado_disponivel' ? 'final' : 'partial',
          code: { text: `${e.tipoExame.codigo} — ${e.tipoExame.nome}` },
          subject: { reference: `Patient/${e.pacienteId.toString()}` },
          effectiveDateTime: (e.dataResultado ?? e.dataSolicitacao).toISOString(),
          conclusion: e.resultadoTexto ?? e.interpretacao ?? undefined,
        },
      };
    }

    // RAC — Registro de Atendimento Clínico (bundle documento).
    const at = await this.prisma.atendimento.findFirst({
      where: { id: BigInt(entityId), deletedAt: null },
    });
    if (!at) throw new NotFoundException('Atendimento não encontrado.');
    const pac = await this.prisma.paciente.findUnique({ where: { id: at.pacienteId } });
    if (!pac) throw new NotFoundException('Paciente do atendimento não encontrado.');

    return {
      recursoTipo: 'Bundle',
      pacienteId: at.pacienteId,
      recurso: {
        resourceType: 'Bundle',
        type: 'document',
        timestamp: new Date().toISOString(),
        entry: [
          { resource: toFhirPatient(pac) },
          { resource: toFhirEncounter(at) },
        ],
      },
    };
  }

  /** Constrói, registra e despacha o registro à RNDS. */
  async enviar(tipo: TipoEnvioRnds, entityId: string) {
    const { recursoTipo, pacienteId, recurso } = await this.montarRecurso(tipo, entityId);

    const envio = await this.prisma.envioRnds.create({
      data: {
        tipo,
        recursoTipo,
        entityId,
        pacienteId,
        hospitalId: currentHospitalId(),
        status: 'PENDENTE',
      },
    });

    return this.despachar(envio.id, recurso);
  }

  async reenviar(id: string) {
    const envio = await this.prisma.envioRnds.findUnique({ where: { id: BigInt(id) } });
    if (!envio) throw new NotFoundException('Envio não encontrado.');
    const { recurso } = await this.montarRecurso(
      envio.tipo as TipoEnvioRnds,
      envio.entityId,
    );
    return this.despachar(envio.id, recurso);
  }

  /**
   * Despacho à RNDS. Modo mock: gera protocolo e marca ENVIADO. O ponto de
   * extensão para o POST real (mTLS + token) é aqui.
   */
  private async despachar(id: bigint, recurso: FhirResource) {
    try {
      // TODO produção: POST mTLS no endpoint RNDS com o `recurso`.
      const protocolo = `RNDS-${randomUUID().slice(0, 8).toUpperCase()}`;
      const atualizado = await this.prisma.envioRnds.update({
        where: { id },
        data: {
          status: 'ENVIADO',
          protocolo,
          enviadoEm: new Date(),
          mensagem: `Recurso ${(recurso as { resourceType?: string }).resourceType} aceito (simulação).`,
        },
      });
      return this.serialize(atualizado);
    } catch (err) {
      const atualizado = await this.prisma.envioRnds.update({
        where: { id },
        data: { status: 'ERRO', mensagem: err instanceof Error ? err.message : 'falha' },
      });
      return this.serialize(atualizado);
    }
  }

  async listar(status?: string) {
    const rows = await this.prisma.envioRnds.findMany({
      where: status ? { status } : undefined,
      orderBy: { criadoEm: 'desc' },
      take: 200,
    });
    const pacientes = await this.prisma.paciente.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.pacienteId).filter(Boolean))] as bigint[] } },
      select: { id: true, nome: true },
    });
    const nomePorId = new Map(pacientes.map((p) => [p.id.toString(), p.nome]));
    return rows.map((r) => ({
      ...this.serialize(r),
      pacienteNome: r.pacienteId ? nomePorId.get(r.pacienteId.toString()) ?? null : null,
    }));
  }

  private serialize<T extends { id: bigint; pacienteId: bigint | null }>(r: T) {
    return { ...r, id: r.id.toString(), pacienteId: r.pacienteId?.toString() ?? null };
  }
}
