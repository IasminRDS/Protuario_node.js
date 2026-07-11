'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, KeyRound, ShieldCheck, ShieldOff } from 'lucide-react';
import {
  authService,
  type MfaSetup,
  type MfaStatus,
} from '@/services/auth.service';
import { apiErrorMessage } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Skeleton,
} from '@/components/ui/primitives';

export default function ContaPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  const carregar = useCallback(async () => {
    try {
      setStatus(await authService.mfaStatus());
    } catch (err) {
      setMsg({ ok: false, texto: apiErrorMessage(err, 'Falha ao consultar o MFA.') });
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function iniciarSetup() {
    setBusy(true);
    setMsg(null);
    try {
      setSetup(await authService.mfaSetup());
    } catch (err) {
      setMsg({ ok: false, texto: apiErrorMessage(err, 'Falha ao gerar o segredo.') });
    } finally {
      setBusy(false);
    }
  }

  async function confirmarAtivacao(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await authService.mfaEnable(code);
      setSetup(null);
      setCode('');
      setMsg({
        ok: true,
        texto: 'MFA ativado. No próximo login será pedido o código do autenticador.',
      });
      await carregar();
    } catch (err) {
      setMsg({ ok: false, texto: apiErrorMessage(err, 'Código inválido.') });
    } finally {
      setBusy(false);
    }
  }

  async function desativar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await authService.mfaDisable(code);
      setCode('');
      setMsg({ ok: true, texto: 'MFA desativado.' });
      await carregar();
    } catch (err) {
      setMsg({ ok: false, texto: apiErrorMessage(err, 'Código inválido.') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Minha Conta"
        subtitle="Identificação e segurança da sessão"
      />

      <div className="grid max-w-3xl grid-cols-1 gap-4">
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Identificação</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-400">Login</p>
              <p className="font-medium text-slate-800">{user?.login ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Perfil</p>
              <p className="font-medium text-slate-800">{user?.perfil ?? '—'}</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
              <KeyRound className="h-4 w-4" /> Verificação em duas etapas (MFA)
            </h2>
            {status &&
              (status.enabled ? (
                <Badge tone="green">Ativo</Badge>
              ) : (
                <Badge tone="amber">Inativo</Badge>
              ))}
          </div>

          <p className="mb-4 text-xs text-slate-500">
            Código TOTP de 6 dígitos gerado por aplicativo autenticador (Google
            Authenticator, Microsoft Authenticator, FreeOTP). Obrigatório para perfis
            administrativos em operações de exportação de dados e backup (LGPD).
          </p>

          {msg && (
            <p
              className={`mb-3 rounded-md px-3 py-2 text-xs ${
                msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
              }`}
            >
              {msg.texto}
            </p>
          )}

          {status === null ? (
            <Skeleton className="h-20 w-full" />
          ) : status.enabled ? (
            <form onSubmit={desativar} className="flex items-end gap-3">
              <Field label="Código atual (para desativar)">
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                />
              </Field>
              <Button
                type="submit"
                variant="ghost"
                className="text-red-600"
                loading={busy}
                disabled={code.length !== 6}
              >
                <ShieldOff className="h-4 w-4" /> Desativar MFA
              </Button>
            </form>
          ) : setup ? (
            <div className="space-y-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="mb-1 text-xs font-medium text-slate-600">
                  1. No aplicativo autenticador, adicione uma conta por chave manual:
                </p>
                <div className="flex items-center gap-2">
                  <code className="break-all rounded bg-white px-2 py-1 font-mono text-sm text-slate-800 ring-1 ring-slate-200">
                    {setup.secret}
                  </code>
                  <button
                    type="button"
                    className="text-slate-400 hover:text-slate-600"
                    title="Copiar segredo"
                    onClick={() => navigator.clipboard?.writeText(setup.secret)}
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2 break-all text-[11px] text-slate-400">
                  ou use o link: {setup.otpauthUrl}
                </p>
              </div>
              <form onSubmit={confirmarAtivacao} className="flex items-end gap-3">
                <Field label="2. Código exibido no aplicativo">
                  <Input
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    autoFocus
                  />
                </Field>
                <Button type="submit" loading={busy} disabled={code.length !== 6}>
                  <ShieldCheck className="h-4 w-4" /> Confirmar e ativar
                </Button>
              </form>
            </div>
          ) : (
            <Button onClick={iniciarSetup} loading={busy}>
              <ShieldCheck className="h-4 w-4" /> Ativar MFA
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}
