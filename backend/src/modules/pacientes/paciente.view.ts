import { Paciente } from '@prisma/client';

/**
 * Estado de consistência institucional do registro clínico (§2.2/§11):
 *  - VALIDO:        vínculo com hospital existente;
 *  - QUARENTENA:    sem vínculo (hospital_id nulo);
 *  - INCONSISTENTE: vínculo quebrado (hospital_id aponta p/ hospital inexistente).
 * QUARENTENA e INCONSISTENTE são ambos congelados no banco (trigger).
 */
export type PacienteConsistencyState = 'VALIDO' | 'QUARENTENA' | 'INCONSISTENTE';

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
  /** Estado de consistência institucional (source of truth para a UI). */
  consistencyState: PacienteConsistencyState;
  /**
   * Atalho: registro NÃO-válido (QUARENTENA ou INCONSISTENTE) → congelado no
   * banco, ações mutáveis bloqueadas. Derivado de consistencyState.
   */
  emQuarentena: boolean;
}

/**
 * `consistencyState` é resolvido pelo service (I/O de checagem de vínculo) e
 * injetado aqui — o mapper permanece puro. `emQuarentena` é derivado.
 */
export function toPacienteView(
  p: Paciente,
  consistencyState: PacienteConsistencyState,
): PacienteView {
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
    consistencyState,
    emQuarentena: consistencyState !== 'VALIDO',
  };
}
