import { api } from './api';
import type { ApiEnvelope } from '@/types';

export type StatusNotificacao = 'PENDENTE' | 'ENVIADA' | 'DESCARTADA';

export interface NotificacaoCompulsoria {
  id: string;
  pacienteId: string;
  origem: 'INTERNACAO' | 'ALTA' | 'REGULACAO' | 'MANUAL';
  origemId: string | null;
  cid: string;
  agravo: string;
  imediata: boolean;
  status: StatusNotificacao;
  observacoes: string | null;
  motivoDescarte: string | null;
  createdAt: string;
  resolvidaEm: string | null;
  paciente: {
    nome: string;
    cns: string | null;
    municipio: string | null;
    uf: string | null;
  };
}

export interface AgravoNotificavel {
  agravo: string;
  cids: string[];
  imediata: boolean;
}

export const vigilanciaService = {
  async listar(status?: StatusNotificacao): Promise<NotificacaoCompulsoria[]> {
    const { data } = await api.get<ApiEnvelope<NotificacaoCompulsoria[]>>(
      '/vigilancia/notificacoes',
      { params: status ? { status } : undefined },
    );
    return data.data;
  },

  async agravos(): Promise<AgravoNotificavel[]> {
    const { data } = await api.get<ApiEnvelope<AgravoNotificavel[]>>('/vigilancia/agravos');
    return data.data;
  },

  async criarManual(input: {
    pacienteId: string;
    cid: string;
    observacoes?: string;
  }): Promise<NotificacaoCompulsoria> {
    const { data } = await api.post<ApiEnvelope<NotificacaoCompulsoria>>(
      '/vigilancia/notificacoes',
      input,
    );
    return data.data;
  },

  async resolver(
    id: string,
    acao: 'ENVIAR' | 'DESCARTAR',
    motivo?: string,
  ): Promise<NotificacaoCompulsoria> {
    const { data } = await api.patch<ApiEnvelope<NotificacaoCompulsoria>>(
      `/vigilancia/notificacoes/${id}`,
      { acao, motivo },
    );
    return data.data;
  },
};
