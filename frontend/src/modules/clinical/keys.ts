/**
 * Fábrica central de query keys do domínio clínico. Centralizar evita chaves
 * divergentes entre queries e as invalidações das mutations.
 */
export const clinicalKeys = {
  ps: {
    fila: ['clinical', 'ps', 'fila'] as const,
    detail: (id: string) => ['clinical', 'ps', id] as const,
  },
  leitos: (status?: string) =>
    ['clinical', 'leitos', status ?? 'todos'] as const,
  setores: ['clinical', 'setores'] as const,
  internacoes: ['clinical', 'internacoes', 'ativas'] as const,
  internacao: (id: string) => ['clinical', 'internacao', id] as const,
  tiposExame: ['clinical', 'exames', 'tipos'] as const,
  examesByPaciente: (pacienteId: string) =>
    ['clinical', 'exames', 'paciente', pacienteId] as const,
  prescricoesByPaciente: (pacienteId: string) =>
    ['clinical', 'prescricoes', 'paciente', pacienteId] as const,
};
