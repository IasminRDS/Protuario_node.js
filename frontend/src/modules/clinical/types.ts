// Contratos clínicos alinhados aos DTOs/respostas do backend (Fase 2).
// Ids são strings (BigInt serializado como string pelo backend).

export interface PacienteRef {
  nome: string;
}

// --- Pronto-Socorro --------------------------------------------------------
export type PsStatus =
  | 'em_espera'
  | 'em_atendimento'
  | 'internado'
  | 'alta'
  | 'obito';

export interface AtendimentoPS {
  id: string;
  pacienteId: string;
  motivoConsulta: string;
  status: PsStatus;
  dataChegada: string;
  dataAtendimento?: string | null;
  dataLiberacao?: string | null;
  diagnosticoPreliminar?: string | null;
  conduta?: string | null;
  paciente?: PacienteRef;
}

export interface CreateChegadaInput {
  pacienteId: string;
  motivoConsulta: string;
  triagemId?: string;
}

export interface FinalizarPsInput {
  desfecho: 'alta' | 'internado' | 'obito';
  diagnosticoPreliminar?: string;
  conduta?: string;
}

// --- Exames ----------------------------------------------------------------
export interface TipoExame {
  id: string;
  codigo: string;
  nome: string;
  categoria?: string | null;
}

export type ExameStatus =
  | 'solicitado'
  | 'coletado'
  | 'em_analise'
  | 'resultado_disponivel'
  | 'cancelado';

export interface ExameSolicitado {
  id: string;
  pacienteId: string;
  status: ExameStatus;
  urgencia: string;
  indicacaoClinica?: string | null;
  resultadoTexto?: string | null;
  interpretacao?: string | null;
  dataSolicitacao: string;
  dataResultado?: string | null;
  tipoExame?: { codigo: string; nome: string };
}

export interface SolicitarExameInput {
  pacienteId: string;
  tipoExameId: string;
  urgencia?: 'rotina' | 'urgente' | 'urgentissimo';
  indicacaoClinica?: string;
}

export interface RegistrarResultadoInput {
  resultadoTexto?: string;
  resultadoValor?: string;
  resultadoUnidade?: string;
  valorReferencia?: string;
  interpretacao?: 'normal' | 'alterado' | 'critico' | 'indeterminado';
}

// --- Prescrição hospitalar -------------------------------------------------
export interface ItemPrescricaoHospInput {
  medicamentoId?: string;
  nomeLivre?: string;
  dose?: string;
  via?: string;
  frequencia?: string;
  instrucoes?: string;
}

export interface AdministracaoMed {
  id: string;
  status: string;
  dataAdministracao?: string | null;
  observacoes?: string | null;
}

export interface ItemPrescricaoHosp extends ItemPrescricaoHospInput {
  id: string;
  administracoes?: AdministracaoMed[];
}

export interface PrescricaoHosp {
  id: string;
  pacienteId: string;
  status: string;
  dataPrescricao: string;
  observacoes?: string | null;
  itens: ItemPrescricaoHosp[];
}

export interface CreatePrescricaoHospInput {
  pacienteId: string;
  internacaoId?: string;
  validadeHoras?: number;
  observacoes?: string;
  itens: ItemPrescricaoHospInput[];
}

// --- Internação / Leitos ---------------------------------------------------
export type LeitoStatus =
  | 'livre'
  | 'ocupado'
  | 'reservado'
  | 'em_higienizacao'
  | 'interditado';

export interface Leito {
  id: string;
  numero: string;
  tipo?: string | null;
  status: LeitoStatus;
  setorId: string;
  setor?: { nome: string; sigla?: string | null };
}

export interface Setor {
  id: string;
  nome: string;
  sigla?: string | null;
  tipo: string;
  leitos?: Leito[];
}

export interface EvolucaoInternacao {
  id: string;
  tipo: string;
  subjetivo?: string | null;
  objetivo?: string | null;
  avaliacao?: string | null;
  plano?: string | null;
  createdAt: string;
}

export interface Internacao {
  id: string;
  pacienteId: string;
  leito: string;
  status: string;
  tipo: string;
  entrada: string;
  alta?: string | null;
  motivo?: string | null;
  paciente?: PacienteRef;
  leitoRef?: { numero: string };
  evolucoes?: EvolucaoInternacao[];
}

export interface InternarInput {
  pacienteId: string;
  leitoId: string;
  motivo: string;
  medicoId?: string;
  tipo?: string;
  hipoteseDiag?: string;
  cidPrincipal?: string;
}

export interface EvolucaoInput {
  tipo?: string;
  pressaoArterial?: string;
  temperatura?: number;
  subjetivo?: string;
  objetivo?: string;
  avaliacao?: string;
  plano?: string;
}

export interface AltaInput {
  tipoAlta:
    | 'curado'
    | 'melhorado'
    | 'transferencia'
    | 'obito'
    | 'a_pedido'
    | 'evasao';
  sumarioAlta?: string;
  cidAlta?: string;
}
