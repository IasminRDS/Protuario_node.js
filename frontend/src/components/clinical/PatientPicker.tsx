'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { pacientesService } from '@/services/pacientes.service';
import { apiErrorMessage } from '@/services/api';
import { useDebounce } from '@/hooks/useDebounce';
import { Input, Skeleton } from '@/components/ui/primitives';
import { cn } from '@/utils/cn';
import type { Paciente } from '@/types';

export function PatientPicker({
  selected,
  onSelect,
}: {
  selected: Paciente | null;
  onSelect: (p: Paciente) => void;
}) {
  const [busca, setBusca] = useState('');
  const debounced = useDebounce(busca);
  const [items, setItems] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    pacientesService
      .list({ page: 1, pageSize: 8, nome: debounced || undefined })
      .then((r) => setItems(r.items))
      .catch((e) => setError(apiErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [debounced]);

  return (
    <div>
      <div className="relative mb-2">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          className="pl-9"
          placeholder="Buscar paciente por nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : loading ? (
        <Skeleton className="h-24" />
      ) : (
        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {items.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelect(p)}
                className={cn(
                  'w-full rounded-md px-3 py-2 text-left text-sm',
                  selected?.id === p.id
                    ? 'bg-clinic-primary/10 text-clinic-primary'
                    : 'hover:bg-slate-100',
                )}
              >
                <span className="font-medium">{p.nome}</span>{' '}
                <span className="text-xs text-slate-400">
                  {p.cpf ?? 'sem CPF'}
                </span>
              </button>
            </li>
          ))}
          {items.length === 0 && (
            <li className="px-3 py-2 text-xs text-slate-400">
              Nenhum paciente.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
