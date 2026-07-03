import { api } from './api';
import type { ApiEnvelope } from '@/types';

export interface ProntuarioTimelineItem {
  id: string;
  tipo: 'ATENDIMENTO' | 'TRIAGEM' | 'PRESCRICAO' | 'EXAME' | 'VACINA';
  data: string;
  profissional?: string;
  resumo: string;
}

export interface ProntuarioCompleto {
  pacienteId: string;
  timeline: ProntuarioTimelineItem[];
}

/**
 * ⚠️ Endpoint previsto — o backend ainda NÃO expõe /prontuarios/:pacienteId.
 */
export const prontuarioService = {
  async getByPaciente(pacienteId: string): Promise<ProntuarioCompleto> {
    const { data } = await api.get<ApiEnvelope<ProntuarioCompleto>>(
      `/prontuarios/${pacienteId}`,
    );
    return data.data;
  },
};
