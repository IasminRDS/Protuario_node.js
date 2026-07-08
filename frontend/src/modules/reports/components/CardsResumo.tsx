'use client';

import { useOcupacaoLeitos, useTempoMedio } from '../hooks/useReports';
import { OcupacaoCard } from './OcupacaoCard';
import { TempoMedioCard } from './TempoMedioCard';

/** Cards-resumo do topo do dashboard (ocupação + tempo médio). */
export function CardsResumo() {
  const ocupacao = useOcupacaoLeitos();
  const tempo = useTempoMedio();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <OcupacaoCard data={ocupacao.data} isLoading={ocupacao.isLoading} />
      <TempoMedioCard data={tempo.data} isLoading={tempo.isLoading} />
    </div>
  );
}
