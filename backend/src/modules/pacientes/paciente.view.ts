import { Paciente } from '@prisma/client';

export interface PacienteView {
  id: string;
  nome: string;
  cpf: string | null;
  cns: string | null;
  sexo: string;
  dataNascimento: Date;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toPacienteView(p: Paciente): PacienteView {
  return {
    id: p.id.toString(),
    nome: p.nome,
    cpf: p.cpf,
    cns: p.cns,
    sexo: p.sexo,
    dataNascimento: p.dataNascimento,
    telefone: p.telefone,
    email: p.email,
    endereco: p.endereco,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
