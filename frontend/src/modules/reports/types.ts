// Contratos alinhados aos DTOs do backend (materialized views).

export interface AtendimentoPorDia {
  dia: string; // YYYY-MM-DD
  totalAtendimentos: number;
  atualizadoEm: string | null;
}

export interface OcupacaoLeitos {
  ocupados: number;
  livres: number;
  total: number;
  taxaOcupacao: number;
  atualizadoEm: string | null;
}

export interface TempoMedio {
  totalAtendimentos: number;
  mediaMinutos: number;
  atualizadoEm: string | null;
}

export interface ExameRealizado {
  codigo: string;
  tipoExame: string;
  total: number;
  atualizadoEm: string | null;
}

/** Filtro de período (aplicado localmente enquanto o backend não filtra). */
export interface PeriodoFiltro {
  de?: string;
  ate?: string;
}
