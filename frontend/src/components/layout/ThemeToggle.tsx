'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const STORAGE_KEY = 'snpe-tema';

type Tema = 'light' | 'dark';

function temaAtual(): Tema {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/**
 * Alternador claro/escuro. O tema é aplicado como `data-theme` no <html>
 * (o CSS re-tematiza via tokens) e persistido; o script inline do layout
 * aplica a preferência ANTES da hidratação (sem flash).
 */
export function ThemeToggle() {
  // Evita mismatch de hidratação: só renderiza o ícone após montar.
  const [tema, setTema] = useState<Tema | null>(null);

  useEffect(() => {
    setTema(temaAtual());
  }, []);

  function alternar() {
    const proximo: Tema = temaAtual() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = proximo;
    try {
      localStorage.setItem(STORAGE_KEY, proximo);
    } catch {
      /* sem storage: vale só para a sessão */
    }
    setTema(proximo);
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={tema === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      title={tema === 'dark' ? 'Tema claro' : 'Tema escuro'}
      className="flex h-6 w-6 items-center justify-center rounded text-slate-300 hover:bg-white/10 hover:text-white"
    >
      {tema === 'dark' ? (
        <Sun className="h-4 w-4" aria-hidden />
      ) : (
        <Moon className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}
