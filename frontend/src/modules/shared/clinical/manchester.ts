/**
 * Protocolo de Manchester — classificação de risco com as 5 cores oficiais e
 * tempo-alvo de atendimento. Fonte única para triagem, fila do PS e painel.
 */
export interface NivelManchester {
  valor: 'VERMELHO' | 'LARANJA' | 'AMARELO' | 'VERDE' | 'AZUL';
  rotulo: string;
  tempoAlvo: string;
  /** Cor oficial (hex) — usada em gráficos (Recharts). */
  hex: string;
  /** Classes Tailwind do chip/botão selecionado. */
  chip: string;
  /** Classes do anel de seleção. */
  ring: string;
}

export const MANCHESTER: NivelManchester[] = [
  {
    valor: 'VERMELHO',
    rotulo: 'Emergência',
    tempoAlvo: 'imediato',
    hex: '#dc2626',
    chip: 'bg-red-600 text-white',
    ring: 'ring-red-600',
  },
  {
    valor: 'LARANJA',
    rotulo: 'Muito urgente',
    tempoAlvo: 'até 10 min',
    hex: '#f97316',
    chip: 'bg-orange-500 text-white',
    ring: 'ring-orange-500',
  },
  {
    valor: 'AMARELO',
    rotulo: 'Urgente',
    tempoAlvo: 'até 60 min',
    hex: '#facc15',
    chip: 'bg-yellow-400 text-slate-900',
    ring: 'ring-yellow-400',
  },
  {
    valor: 'VERDE',
    rotulo: 'Pouco urgente',
    tempoAlvo: 'até 120 min',
    hex: '#16a34a',
    chip: 'bg-green-600 text-white',
    ring: 'ring-green-600',
  },
  {
    valor: 'AZUL',
    rotulo: 'Não urgente',
    tempoAlvo: 'até 240 min',
    hex: '#2563eb',
    chip: 'bg-blue-600 text-white',
    ring: 'ring-blue-600',
  },
];

export function nivelManchester(valor?: string | null): NivelManchester | null {
  if (!valor) return null;
  return MANCHESTER.find((n) => n.valor === valor.toUpperCase()) ?? null;
}
