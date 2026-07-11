'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useVisibleNavGroups } from '@/modules/shared/rbac/useNav';
import { cn } from '@/utils/cn';

const STORAGE_KEY = 'snpe-nav-abertas';

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const grupos = useVisibleNavGroups();

  // Categorias abertas: escolha do usuário persistida + a categoria da rota
  // ativa sempre aberta (nunca esconder onde o operador está).
  const [abertas, setAbertas] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY);
      setAbertas(salvo ? (JSON.parse(salvo) as Record<string, boolean>) : {});
    } catch {
      setAbertas({});
    }
  }, []);

  if (!user) return null;

  const grupoAtivo = grupos.find((g) =>
    g.items.some((i) => pathname.startsWith(i.href)),
  )?.titulo;

  function estaAberta(titulo: string): boolean {
    if (titulo === grupoAtivo) return true;
    // Padrão (sem preferência salva): tudo aberto — descoberta > densidade.
    return abertas?.[titulo] ?? true;
  }

  function alternar(titulo: string) {
    const proximo = { ...(abertas ?? {}), [titulo]: !estaAberta(titulo) };
    setAbertas(proximo);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(proximo));
    } catch {
      /* localStorage indisponível — estado fica só em memória */
    }
  }

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-clinic-primary">
          <Activity className="h-5 w-5 text-white" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-bold text-slate-800">SNPE</p>
          <p className="text-[11px] text-slate-400">Prontuário Eletrônico Nacional</p>
        </div>
      </div>

      <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto p-2">
        {grupos.map((grupo, gi) => {
          const aberta = grupo.titulo ? estaAberta(grupo.titulo) : true;
          return (
            <div key={grupo.titulo ?? gi} className={gi > 0 ? 'mt-2' : undefined}>
              {grupo.titulo && (
                <button
                  type="button"
                  onClick={() => alternar(grupo.titulo!)}
                  aria-expanded={aberta}
                  className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                >
                  {grupo.titulo}
                  <ChevronDown
                    aria-hidden
                    className={cn(
                      'h-3.5 w-3.5 transition-transform',
                      !aberta && '-rotate-90',
                    )}
                  />
                </button>
              )}
              {aberta && (
                <div className="space-y-0.5">
                  {grupo.items.map((item) => {
                    const active = pathname.startsWith(item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                          active
                            ? 'bg-clinic-primary/10 text-clinic-primary'
                            : 'text-slate-600 hover:bg-slate-100',
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-3 text-[11px] text-slate-400">
        Perfil: <span className="font-medium text-slate-600">{user.perfil}</span>
      </div>
    </aside>
  );
}
