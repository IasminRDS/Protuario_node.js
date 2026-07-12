import { api } from './api';
import { postWithOfflineQueue } from '@/lib/offline-queue';
import type { ApiEnvelope, Triagem, Prescricao } from '@/types';

export interface TriagemInput {
  pacienteId: string;
  pacienteNome?: string; // só para o rótulo da fila offline
  pressao?: string;
  temperatura?: number;
  frequencia?: number;
  saturacao?: number;
  peso?: number;
  altura?: number;
  classificacao: string; // Manchester: VERMELHO|LARANJA|AMARELO|VERDE|AZUL
  observacoes?: string;
}

export const triagemService = {
  /**
   * Registra a triagem no backend (`POST /triage`, contrato em inglês do DTO).
   * Sem rede (modo UBS), enfileira offline com Idempotency-Key e sincroniza
   * ao reconectar — o retorno indica qual caminho foi tomado.
   */
  async registrar(
    input: TriagemInput,
  ): Promise<{ queued: false; data: Triagem } | { queued: true }> {
    const payload = {
      pacienteId: input.pacienteId,
      pressure: input.pressao,
      temperature: input.temperatura,
      heartRate: input.frequencia,
      oxygenSaturation: input.saturacao,
      weight: input.peso,
      height: input.altura,
      riskLevel: input.classificacao,
      observacoes: input.observacoes,
    };
    return postWithOfflineQueue<Triagem>(
      '/triage',
      payload,
      `Triagem — ${input.pacienteNome ?? `paciente ${input.pacienteId}`}`,
    );
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
    // Backend: módulo `prescriptions` (campos em inglês).
    const { data } = await api.post<ApiEnvelope<Prescricao>>('/prescriptions', {
      atendimentoId: input.atendimentoId,
      medication: input.medicamento,
      dosage: input.dosagem,
      frequency: input.frequencia,
      duration: input.duracao,
      observacoes: input.observacoes,
    });
    return data.data;
  },
};
