'use client';

import { useEffect, useRef, useState } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/primitives';
import {
  terminologiaService,
  type Cid10,
  type MedicamentoCatalogo,
} from '@/services/terminologia.service';

/**
 * Combobox de terminologia (autocomplete de catálogo oficial). O valor final é
 * TEXTO no formulário (código CID ou nome do medicamento) — o dropdown apenas
 * acelera e padroniza a digitação; texto livre continua permitido.
 */
function TerminologyCombobox<T>({
  value,
  onChange,
  placeholder,
  buscar,
  renderItem,
  pickValue,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  buscar: (q: string) => Promise<T[]>;
  renderItem: (item: T) => React.ReactNode;
  pickValue: (item: T) => string;
  ariaLabel: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [items, setItems] = useState<T[]>([]);
  const debounced = useDebounce(value);
  const boxRef = useRef<HTMLDivElement>(null);
  // Suprime a busca imediatamente após uma seleção (o onChange da seleção
  // dispararia o dropdown de novo).
  const skipNext = useRef(false);

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    let ativo = true;
    if (!debounced.trim()) {
      setItems([]);
      return;
    }
    buscar(debounced)
      .then((r) => {
        if (ativo) {
          setItems(r);
          setAberto(r.length > 0);
        }
      })
      .catch(() => ativo && setItems([]));
    return () => {
      ativo = false;
    };
  }, [debounced, buscar]);

  // Fecha ao clicar fora.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <Input
        role="combobox"
        aria-expanded={aberto}
        aria-label={ariaLabel}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => items.length > 0 && setAberto(true)}
        onKeyDown={(e) => e.key === 'Escape' && setAberto(false)}
      />
      {aberto && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          {items.map((item, i) => (
            <li key={i} role="option" aria-selected={false}>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100"
                onClick={() => {
                  skipNext.current = true;
                  onChange(pickValue(item));
                  setAberto(false);
                }}
              >
                {renderItem(item)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Autocomplete de CID-10 — o valor do campo é o CÓDIGO (ex.: "A90"). */
export function CidPicker({
  value,
  onChange,
  placeholder = 'Código ou descrição (ex.: A90, dengue)',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <TerminologyCombobox<Cid10>
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      ariaLabel="Buscar CID-10"
      buscar={(q) => terminologiaService.cid10(q)}
      pickValue={(c) => c.codigo}
      renderItem={(c) => (
        <>
          <span className="font-mono text-xs font-semibold text-clinic-primary">
            {c.codigo}
          </span>{' '}
          <span className="text-slate-700">{c.descricao}</span>
        </>
      )}
    />
  );
}

/** Autocomplete de medicamento (RENAME) — o valor é "nome apresentação". */
export function MedicamentoPicker({
  value,
  onChange,
  placeholder = 'Nome do medicamento (ex.: amoxicilina)',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <TerminologyCombobox<MedicamentoCatalogo>
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      ariaLabel="Buscar medicamento"
      buscar={(q) => terminologiaService.medicamentos(q)}
      pickValue={(m) => `${m.nome} ${m.apresentacao}`}
      renderItem={(m) => (
        <>
          <span className="font-medium text-slate-800">{m.nome}</span>{' '}
          <span className="text-xs text-slate-500">
            {m.apresentacao} · {m.via}
          </span>
        </>
      )}
    />
  );
}
