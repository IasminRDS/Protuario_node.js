import { api } from './api';
import type {
  ApiEnvelope,
  PaginatedResult,
  Atendimento,
  EvolucaoClinica,
} from '@/types';

/**
 * ⚠️ Endpoints previstos (contrato) — o backend NestJS ainda NÃO expõe o módulo
 * de Atendimento. As chamadas retornarão 404 até que as rotas sejam criadas.
 * A UI trata o erro (não usa dados falsos).
 */
export const atendimentoService = {
  async list(params: {
    status?: string;
    page?: number;
  }): Promise<PaginatedResult<Atendimento>> {
    const { data } = await api.get<ApiEnvelope<PaginatedResult<Atendimento>>>(
      '/atendimentos',
      { params },
    );
    return data.data;
  },

  async iniciar(pacienteId: string, tipo: string): Promise<Atendimento> {
    const { data } = await api.post<ApiEnvelope<Atendimento>>('/atendimentos', {
      pacienteId,
      tipo,
    });
    return data.data;
  },

  async registrarEvolucao(
    atendimentoId: string,
    evolucao: EvolucaoClinica,
  ): Promise<void> {
    await api.post(`/atendimentos/${atendimentoId}/evolucao`, evolucao);
  },

  async finalizar(atendimentoId: string): Promise<void> {
    await api.patch(`/atendimentos/${atendimentoId}/finalizar`);
  },
};
