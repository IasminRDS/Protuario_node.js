import { api } from './api';
import type { ApiEnvelope } from '@/types';

export type PrioridadeRegulacao = 'eletivo' | 'urgencia' | 'emergencia';
export type StatusRegulacao =
  | 'solicitado'
  | 'em_analise'
  | 'autorizado'
  | 'agendado'
  | 'realizado'
  | 'negado'
  | 'devolvido'
  | 'cancelado';

export type AcaoRegulacao =
  | 'analisar'
  | 'autorizar'
  | 'negar'
  | 'devolver'
  | 'agendar'
  | 'realizar'
  | 'cancelar';

export interface Encaminhamento {
  id: string;
  pacienteId: string;
  especialidade: string;
  servicoDestino: string | null;
  prioridade: PrioridadeRegulacao;
  motivo: string;
  hipoteseDiagnostica: string | null;
  cid: string | null;
  status: StatusRegulacao;
  dataSolicitacao: string;
  dataAgendada: string | null;
  dataRealizacao: string | null;
  parecerRegulacao: string | null;
  unidadeDestino: string | null;
  observacoes: string | null;
  paciente: {
    nome: string;
    cns: string | null;
    municipio: string | null;
    uf: string | null;
  };
}

export const regulacaoService = {
  async fila(filtros?: {
    status?: string;
    especialidade?: string;
    prioridade?: string;
  }): Promise<Encaminhamento[]> {
    const { data } = await api.get<ApiEnvelope<Encaminhamento[]>>('/regulacao/fila', {
      params: filtros,
    });
    return data.data;
  },

  async solicitar(input: {
    pacienteId: string;
    especialidade: string;
    prioridade: PrioridadeRegulacao;
    motivo: string;
    hipoteseDiagnostica?: string;
    cid?: string;
    servicoDestino?: string;
    observacoes?: string;
  }): Promise<Encaminhamento> {
    const { data } = await api.post<ApiEnvelope<Encaminhamento>>('/regulacao', input);
    return data.data;
  },

  async regular(
    id: string,
    input: {
      acao: AcaoRegulacao;
      parecer?: string;
      unidadeDestino?: string;
      dataAgendada?: string;
    },
  ): Promise<Encaminhamento> {
    const { data } = await api.patch<ApiEnvelope<Encaminhamento>>(
      `/regulacao/${id}`,
      input,
    );
    return data.data;
  },
};
