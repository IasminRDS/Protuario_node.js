import { api } from './api';
import type {
  ApiEnvelope,
  PaginatedResult,
  Atendimento,
  EvolucaoClinica,
} from '@/types';

/**
 * Atendimentos clínicos. Mapeia para o módulo `encounters` do backend
 * (fluxo WAITING_DOCTOR → IN_CONSULTATION → DISCHARGED).
 */
export const atendimentoService = {
  async list(params: {
    status?: string;
    pacienteId?: string;
  }): Promise<PaginatedResult<Atendimento>> {
    const { data } = await api.get<ApiEnvelope<Atendimento[]>>('/encounters', {
      params,
    });
    const items = data.data;
    return {
      items,
      meta: { page: 1, pageSize: items.length, total: items.length, totalPages: 1 },
    };
  },

  async iniciar(pacienteId: string, tipo: string): Promise<Atendimento> {
    const { data } = await api.post<ApiEnvelope<Atendimento>>('/encounters', {
      pacienteId,
      tipo,
    });
    return data.data;
  },

  /** Registra a evolução como nota do atendimento (consolida os campos). */
  async registrarEvolucao(
    atendimentoId: string,
    evolucao: EvolucaoClinica,
  ): Promise<void> {
    const texto = [
      evolucao.queixaPrincipal && `Queixa: ${evolucao.queixaPrincipal}`,
      evolucao.conduta && `Conduta: ${evolucao.conduta}`,
      evolucao.evolucao,
    ]
      .filter(Boolean)
      .join('\n');
    await api.post(`/encounters/${atendimentoId}/notes`, {
      evolucao: texto,
      diagnostico: evolucao.hipoteseDiagnostica,
    });
  },

  async finalizar(atendimentoId: string): Promise<void> {
    await api.patch(`/encounters/${atendimentoId}/discharge`);
  },
};
