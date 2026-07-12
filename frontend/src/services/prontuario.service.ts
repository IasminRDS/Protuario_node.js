import { api } from './api';
import type { ApiEnvelope } from '@/types';

export type TimelineTipo =
  | 'ATENDIMENTO'
  | 'TRIAGEM'
  | 'PRESCRICAO'
  | 'EVOLUCAO'
  | 'INTERNACAO'
  | 'ALTA'
  | 'EXAME'
  | 'VACINA'
  | 'CIRURGIA'
  | 'ENCAMINHAMENTO'
  | 'NOTIFICACAO';

export interface ProntuarioTimelineItem {
  id: string;
  tipo: TimelineTipo;
  data: string;
  profissional?: string;
  resumo: string;
  detalhe?: string;
}

export interface ProntuarioCompleto {
  pacienteId: string;
  timeline: ProntuarioTimelineItem[];
}

export interface SumarioPaciente {
  paciente: {
    id: string;
    nome: string;
    nomeSocial: string | null;
    cpf: string | null;
    cns: string | null;
    sexo: string;
    dataNascimento: string;
    tipoSanguineo: string | null;
    alergias: string | null;
    municipio: string | null;
    uf: string | null;
    telefone: string | null;
    status: string;
  };
  alertas: {
    alergias: string | null;
    tipoSanguineo: string | null;
    notificacoesPendentes: number;
    internado: boolean;
  };
  problemasAtivos: {
    origem: 'INTERNACAO' | 'REGULACAO';
    descricao: string;
    desde: string | null;
    contexto: string;
  }[];
  medicamentosEmUso: {
    medicamento: string;
    posologia: string | null;
    prescritoEm: string;
  }[];
  vacinas: {
    nome: string;
    dose: string | null;
    data: string;
    unidade: string | null;
  }[];
  timeline: ProntuarioTimelineItem[];
}

export interface AcessoProntuario {
  id: string;
  quem: string;
  perfil: string | null;
  operacao: string;
  finalidade: string;
  ip: string | null;
  quando: string;
}

export const prontuarioService = {
  async getAcessos(pacienteId: string): Promise<AcessoProntuario[]> {
    const { data } = await api.get<ApiEnvelope<AcessoProntuario[]>>(
      `/prontuarios/${pacienteId}/acessos`,
    );
    return data.data;
  },

  async getByPaciente(pacienteId: string): Promise<ProntuarioCompleto> {
    const { data } = await api.get<ApiEnvelope<ProntuarioCompleto>>(
      `/prontuarios/${pacienteId}`,
    );
    return data.data;
  },

  /** Sumário do Paciente (IPS-like): alertas + problemas + medicamentos + timeline. */
  async getSumario(pacienteId: string): Promise<SumarioPaciente> {
    const { data } = await api.get<ApiEnvelope<SumarioPaciente>>(
      `/prontuarios/${pacienteId}/sumario`,
    );
    return data.data;
  },
};
