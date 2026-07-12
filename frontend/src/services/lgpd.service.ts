import { api } from './api';
import type { ApiEnvelope } from '@/types';

export interface ConsentimentoStatus {
  termoVersaoAtual: string;
  aceito: boolean;
  registradoEm: string | null;
}

export const lgpdService = {
  async status(): Promise<ConsentimentoStatus> {
    const { data } = await api.get<ApiEnvelope<ConsentimentoStatus>>(
      '/lgpd/consentimento/status',
    );
    return data.data;
  },

  async consentir(finalidade = 'assistencial'): Promise<void> {
    await api.post('/lgpd/consentimento', { finalidade });
  },

  async breakTheGlass(pacienteId: string, justificativa: string): Promise<void> {
    await api.post(`/lgpd/break-the-glass/${pacienteId}`, { justificativa });
  },
};
