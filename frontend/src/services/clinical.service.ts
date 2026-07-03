import { api } from './api';
import type { ApiEnvelope, Triagem, Prescricao } from '@/types';

/**
 * ⚠️ Endpoints previstos — Triagem e Prescrição ainda NÃO existem no backend.
 * Mantidos com o contrato REST esperado; retornam 404 até serem implementados.
 */
export const triagemService = {
  async registrar(input: {
    pacienteId: string;
    pressao?: string;
    temperatura?: number;
    frequencia?: number;
    saturacao?: number;
    peso?: number;
    altura?: number;
    classificacao?: string;
    observacoes?: string;
  }): Promise<Triagem> {
    const { data } = await api.post<ApiEnvelope<Triagem>>('/triagem', input);
    return data.data;
  },
};

export const prescricaoService = {
  async emitir(input: {
    atendimentoId: string;
    medicamento: string;
    dosagem?: string;
    frequencia?: string;
    duracao?: string;
    observacoes?: string;
  }): Promise<Prescricao> {
    const { data } = await api.post<ApiEnvelope<Prescricao>>(
      '/prescricoes',
      input,
    );
    return data.data;
  },
};
