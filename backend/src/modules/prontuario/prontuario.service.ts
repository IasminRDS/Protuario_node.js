import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface TimelineItem {
  id: string;
  tipo: 'ATENDIMENTO' | 'TRIAGEM' | 'PRESCRICAO' | 'EVOLUCAO';
  data: Date;
  resumo: string;
}

@Injectable()
export class ProntuarioService {
  constructor(private readonly prisma: PrismaService) {}

  /** Monta a linha do tempo clínica consolidada do paciente. */
  async timeline(pacienteId: string) {
    const pid = BigInt(pacienteId);

    const [triagens, atendimentos, evolucoes, prescricoes] = await Promise.all([
      this.prisma.triagem.findMany({ where: { pacienteId: pid } }),
      this.prisma.atendimento.findMany({ where: { pacienteId: pid, deletedAt: null } }),
      this.prisma.prontuario.findMany({ where: { pacienteId: pid } }),
      this.prisma.prescricao.findMany({ where: { atendimento: { pacienteId: pid } } }),
    ]);

    const items: TimelineItem[] = [
      ...triagens.map((t): TimelineItem => ({
        id: `tri-${t.id}`,
        tipo: 'TRIAGEM',
        data: t.createdAt,
        resumo: `Triagem — risco ${t.classificacao ?? 'n/d'}`,
      })),
      ...atendimentos.map((a): TimelineItem => ({
        id: `enc-${a.id}`,
        tipo: 'ATENDIMENTO',
        data: a.data,
        resumo: `Atendimento (${a.tipo}) — ${a.status}`,
      })),
      ...evolucoes.map((e): TimelineItem => ({
        id: `evo-${e.id}`,
        tipo: 'EVOLUCAO',
        data: e.createdAt,
        resumo: e.diagnostico
          ? `Evolução — ${e.diagnostico}`
          : 'Evolução clínica',
      })),
      ...prescricoes.map((p): TimelineItem => ({
        id: `pre-${p.id}`,
        tipo: 'PRESCRICAO',
        data: p.createdAt,
        resumo: `Prescrição — ${p.medicamento}`,
      })),
    ].sort((a, b) => b.data.getTime() - a.data.getTime());

    return { pacienteId, timeline: items };
  }
}
