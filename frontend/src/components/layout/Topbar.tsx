'use client';

import { useRouter } from 'next/navigation';
import {
  LogOut,
  UserCircle2,
  Building2,
  ShieldAlert,
  WifiOff,
  CloudUpload,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOfflineStore } from '@/lib/offline-queue';
import { Button } from '@/components/ui/primitives';

// Ambiente derivado da URL da API (determinístico, sem suposição).
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const ENVIRONMENT =
  process.env.NEXT_PUBLIC_ENV ??
  (API_URL.includes('localhost') || API_URL.includes('127.0.0.1') ? 'DEV' : 'PROD');

/**
 * Barra de contexto de tenant — SEMPRE visível (LGPD/ISO A.9: o operador nunca
 * deve ter dúvida em qual hospital e ambiente está atuando). Torna o isolamento
 * de tenant inequívoco e o sistema visualmente auditável.
 */
function TenantContextBar() {
  const { user } = useAuth();
  const isSuper = user?.superAdmin === true;
  const tenant = user?.hospitalId ?? null;

  return (
    <div
      className={`flex items-center gap-2 rounded-md px-3 py-1 text-xs font-medium ring-1 ring-inset ${
        isSuper
          ? 'bg-red-50 text-red-700 ring-red-200'
          : 'bg-slate-50 text-slate-600 ring-slate-200'
      }`}
      title="Contexto de operação (tenant/ambiente) — registrado em auditoria"
    >
      {isSuper ? (
        <ShieldAlert className="h-4 w-4" aria-hidden />
      ) : (
        <Building2 className="h-4 w-4" aria-hidden />
      )}
      <span>
        Tenant:{' '}
        <span className="font-semibold">
          {isSuper ? 'TODOS (Super-Admin)' : (tenant ?? '—')}
        </span>
      </span>
      <span className="text-slate-300">|</span>
      <span>Perfil: <span className="font-semibold">{user?.perfil ?? '—'}</span></span>
      <span className="text-slate-300">|</span>
      <span>
        Ambiente:{' '}
        <span
          className={`font-semibold ${ENVIRONMENT === 'PROD' ? 'text-red-600' : 'text-emerald-600'}`}
        >
          {ENVIRONMENT}
        </span>
      </span>
    </div>
  );
}

/**
 * Indicador do modo UBS offline (ADR-10): mostra ausência de rede e o tamanho
 * da fila local aguardando sincronização — o operador nunca fica na dúvida se
 * o registro "foi ou não foi".
 */
function OfflineIndicator() {
  const online = useOfflineStore((s) => s.online);
  const pending = useOfflineStore((s) => s.pending);
  const syncing = useOfflineStore((s) => s.syncing);

  if (online && pending === 0) return null;

  return (
    <div
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
        online
          ? 'bg-blue-50 text-blue-700 ring-blue-200'
          : 'bg-amber-50 text-amber-800 ring-amber-200'
      }`}
      title={
        online
          ? 'Sincronizando registros feitos offline'
          : 'Sem conexão — registros ficam na fila local e sobem quando a rede voltar'
      }
    >
      {online ? (
        <CloudUpload className={`h-4 w-4 ${syncing ? 'animate-pulse' : ''}`} aria-hidden />
      ) : (
        <WifiOff className="h-4 w-4" aria-hidden />
      )}
      <span>
        {online ? 'Sincronizando' : 'Offline'}
        {pending > 0 ? ` — ${pending} pendente${pending > 1 ? 's' : ''}` : ''}
      </span>
    </div>
  );
}

export function Topbar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
      <TenantContextBar />
      <div className="flex items-center gap-4">
        {user?.govbrSelo && (
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
            style={{
              background:
                user.govbrSelo === 'ouro'
                  ? '#d4a017'
                  : user.govbrSelo === 'prata'
                    ? '#8a96a3'
                    : '#a97142',
            }}
            title={`Autenticado com gov.br — selo ${user.govbrSelo}`}
          >
            gov.br {user.govbrSelo}
          </span>
        )}
        <OfflineIndicator />
        <div className="flex items-center gap-2 text-sm">
          <UserCircle2 className="h-5 w-5 text-slate-400" />
          <span className="font-medium text-slate-700">{user?.login}</span>
        </div>
        <Button variant="ghost" onClick={handleLogout} title="Sair">
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </header>
  );
}
