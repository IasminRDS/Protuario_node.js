'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  type QueryClient as QueryClientType,
} from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { initOfflineSync } from '@/lib/offline-queue';

/**
 * Provider global do TanStack Query. Regras pensadas para sistema clínico:
 *  - NÃO re-tentar em erros 4xx (403/404/409 são respostas de negócio legítimas;
 *    re-tentar só mascara o erro e gera efeitos colaterais).
 *  - staleTime curto: dados clínicos (fila, leitos) mudam rápido.
 *  - refetch ao focar a janela: enfermagem/médico alternam telas o tempo todo.
 */
function makeClient(): QueryClientType {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => {
          const status = (error as AxiosError)?.response?.status;
          if (status && status >= 400 && status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  // Uma instância por montagem do app (evita compartilhar cache entre requests no SSR).
  const [client] = useState(makeClient);

  // Modo UBS (PWA): registra o service worker e liga a sincronização da fila
  // offline (IndexedDB) — mutações enfileiradas sobem quando a rede volta.
  useEffect(() => {
    initOfflineSync();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* SW é progressivo: sem suporte/permissão, o app segue 100% online */
      });
    }
  }, []);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
