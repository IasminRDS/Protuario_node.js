import { api } from '@/services/api';
import type { ApiEnvelope, PaginatedResult, Paciente } from '@/types';

// NOTA DE CONTRATO: estas rotas EXISTEM no backend (/pacientes). Para tipagem
// automática de DTOs, gerar tipos do Swagger do backend:
//   npx openapi-typescript http://localhost:3000/api/docs-json -o src/modules/shared/api/schema.d.ts
// e substituir os tipos manuais por `paths[...]['responses']`.

export interface ListParams {
  page?: number;
  pageSize?: number;
  nome?: string;
  cpf?: string;
}

export interface CreatePatientDto {
  nome: string;
  dataNascimento: string;
  sexo: string;
  cpf?: string;
  cns?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
}

export const patientsService = {
  list(params: ListParams): Promise<PaginatedResult<Paciente>> {
    return api
      .get<ApiEnvelope<PaginatedResult<Paciente>>>('/pacientes', { params })
      .then((r) => r.data.data);
  },
  getById(id: string): Promise<Paciente> {
    return api
      .get<ApiEnvelope<Paciente>>(`/pacientes/${id}`)
      .then((r) => r.data.data);
  },
  create(dto: CreatePatientDto): Promise<Paciente> {
    return api
      .post<ApiEnvelope<Paciente>>('/pacientes', dto)
      .then((r) => r.data.data);
  },
  update(id: string, dto: Partial<CreatePatientDto>): Promise<Paciente> {
    return api
      .patch<ApiEnvelope<Paciente>>(`/pacientes/${id}`, dto)
      .then((r) => r.data.data);
  },
};
