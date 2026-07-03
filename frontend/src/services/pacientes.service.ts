import { api } from './api';
import type { ApiEnvelope, PaginatedResult, Paciente } from '@/types';

export interface ListPacientesParams {
  page?: number;
  pageSize?: number;
  nome?: string;
  cpf?: string;
}

export interface CreatePacienteInput {
  nome: string;
  dataNascimento: string;
  sexo: string;
  cpf?: string;
  cns?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
}

export const pacientesService = {
  async list(
    params: ListPacientesParams,
  ): Promise<PaginatedResult<Paciente>> {
    const { data } = await api.get<ApiEnvelope<PaginatedResult<Paciente>>>(
      '/pacientes',
      { params },
    );
    return data.data;
  },

  async getById(id: string): Promise<Paciente> {
    const { data } = await api.get<ApiEnvelope<Paciente>>(`/pacientes/${id}`);
    return data.data;
  },

  async create(input: CreatePacienteInput): Promise<Paciente> {
    const { data } = await api.post<ApiEnvelope<Paciente>>('/pacientes', input);
    return data.data;
  },

  async update(
    id: string,
    input: Partial<CreatePacienteInput>,
  ): Promise<Paciente> {
    const { data } = await api.patch<ApiEnvelope<Paciente>>(
      `/pacientes/${id}`,
      input,
    );
    return data.data;
  },
};
