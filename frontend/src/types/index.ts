// Contratos alinhados ao backend NestJS (envelope { success, data, message, traceId }).

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  traceId?: string;
}

export interface ApiError {
  success: false;
  timestamp: string;
  path: string;
  error: { code: string; message: string };
  traceId?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export type Perfil =
  | 'SuperAdmin'
  | 'Administrador'
  | 'Medico'
  | 'Enfermeiro'
  | 'Farmaceutico'
  | 'Recepcao'
  | 'Gestor';

export interface AuthUser {
  id: string;
  login: string;
  perfil: Perfil;
  hospitalId: string | null; // tenant ativo (null = SuperAdmin cross-tenant)
  superAdmin: boolean;
  exp?: number;
}

/**
 * Estado de consistência institucional (§2.2/§11) — source of truth do backend,
 * nunca inferido na UI. VALIDO | QUARENTENA (sem vínculo) | INCONSISTENTE (vínculo
 * quebrado). QUARENTENA e INCONSISTENTE são congelados (bloqueiam mutação).
 */
export type PacienteConsistencyState = 'VALIDO' | 'QUARENTENA' | 'INCONSISTENTE';

export interface Paciente {
  id: string;
  nome: string;
  cpf: string | null;
  cns: string | null;
  sexo: string;
  dataNascimento: string;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  createdAt: string;
  updatedAt: string;
  /** Estado de consistência institucional (backend-driven). */
  consistencyState?: PacienteConsistencyState;
  /** Derivado: registro não-VÁLIDO (congelado). Bloqueia ações mutáveis. */
  emQuarentena?: boolean;
}

export interface Auditoria {
  id: string;
  usuarioId: string | null;
  modulo: string;
  operacao: string;
  objeto: string | null;
  resultado: string | null;
  ip: string | null;
  dataEvento: string;
}

// ---- Contratos clínicos (endpoints previstos no backend; ainda não expostos) ----
export interface Triagem {
  id: string;
  pacienteId: string;
  pressao?: string;
  temperatura?: number;
  frequencia?: number;
  saturacao?: number;
  peso?: number;
  altura?: number;
  classificacao?: string;
  observacoes?: string;
  createdAt: string;
}

export interface Atendimento {
  id: string;
  pacienteId: string;
  medicoId: string;
  tipo: string;
  status: 'EM_ANDAMENTO' | 'FINALIZADO' | 'CANCELADO';
  data: string;
}

export interface EvolucaoClinica {
  queixaPrincipal: string;
  hipoteseDiagnostica: string;
  conduta: string;
  evolucao: string;
}

export interface Prescricao {
  id: string;
  atendimentoId: string;
  medicamento: string;
  dosagem?: string;
  frequencia?: string;
  duracao?: string;
  observacoes?: string;
  createdAt: string;
}
