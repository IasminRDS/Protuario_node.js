'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Activity, ShieldCheck } from 'lucide-react';
import { authService, govbrLoginUrl, isMfaChallenge } from '@/services/auth.service';
import { apiErrorMessage } from '@/services/api';
import { useAuthStore } from '@/store/auth.store';
import { Button, Field, Input } from '@/components/ui/primitives';
import { GovBar, GovFooter } from '@/components/layout/GovBar';

const schema = z.object({
  login: z.string().min(1, 'Informe o login'),
  senha: z.string().min(1, 'Informe a senha'),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const doLogin = useAuthStore((s) => s.login);
  const hydrate = useAuthStore((s) => s.hydrate);
  const [serverError, setServerError] = useState<string | null>(null);

  // Etapa 2 (MFA): quando o backend responde mfaRequired, guardamos o token do
  // desafio e trocamos o formulário pelo campo de código do autenticador.
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { login: 'admin', senha: '' },
  });

  // Se já houver sessão válida, entra direto.
  useEffect(() => {
    hydrate();
    if (useAuthStore.getState().isAuthenticated()) {
      router.replace('/dashboard');
    }
  }, [hydrate, router]);

  // Retorno do gov.br: o callback redireciona para cá com ?govbr=<código único>
  // (ou ?govbr_erro=1). Trocamos o código pelos tokens e entramos.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('govbr_erro')) {
      setServerError('Não foi possível concluir o login com gov.br.');
      window.history.replaceState({}, '', '/login');
      return;
    }
    const code = params.get('govbr');
    if (!code) return;
    window.history.replaceState({}, '', '/login'); // limpa o código da URL
    authService
      .govbrSession(code)
      .then((tokens) => {
        doLogin(tokens);
        router.replace('/dashboard');
      })
      .catch((err) => setServerError(apiErrorMessage(err, 'Falha no login gov.br.')));
  }, [doLogin, router]);

  async function onSubmit(data: FormData) {
    setServerError(null);
    try {
      const resultado = await authService.login(data.login, data.senha);
      if (isMfaChallenge(resultado)) {
        setMfaToken(resultado.mfaToken);
        return;
      }
      doLogin(resultado);
      router.replace('/dashboard');
    } catch (err) {
      setServerError(apiErrorMessage(err, 'Falha na autenticação.'));
    }
  }

  async function onVerifyMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaToken || mfaCode.length !== 6) return;
    setServerError(null);
    setVerifying(true);
    try {
      const tokens = await authService.mfaVerify(mfaToken, mfaCode);
      doLogin(tokens);
      router.replace('/dashboard');
    } catch (err) {
      setServerError(apiErrorMessage(err, 'Código inválido.'));
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-clinic-bg">
      <GovBar />
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6 flex flex-col items-center gap-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-clinic-primary">
              <Activity className="h-6 w-6 text-white" aria-hidden />
            </span>
            <h1 className="text-lg font-bold text-slate-800">SNPE</h1>
            <p className="text-xs text-slate-400">
              Sistema Nacional de Prontuário Eletrônico
            </p>
          </div>

        {mfaToken ? (
          <form onSubmit={onVerifyMfa} className="space-y-4">
            <div className="flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              Verificação em duas etapas: informe o código do seu aplicativo autenticador.
            </div>
            <Field label="Código MFA (6 dígitos)">
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
            </Field>

            {serverError && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
                {serverError}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              loading={verifying}
              disabled={mfaCode.length !== 6}
            >
              Verificar código
            </Button>
            <button
              type="button"
              className="w-full text-center text-xs text-slate-400 hover:text-slate-600"
              onClick={() => {
                setMfaToken(null);
                setMfaCode('');
                setServerError(null);
              }}
            >
              Voltar ao login
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Field label="Login" error={errors.login?.message}>
              <Input placeholder="admin" autoComplete="username" {...register('login')} />
            </Field>
            <Field label="Senha" error={errors.senha?.message}>
              <Input
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                {...register('senha')}
              />
            </Field>

            {serverError && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
                {serverError}
              </p>
            )}

            <Button type="submit" className="w-full" loading={isSubmitting}>
              Entrar
            </Button>

            <div className="flex items-center gap-3 py-1">
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-[11px] uppercase tracking-wide text-slate-400">ou</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            {/* Login federado gov.br. Redirect de página inteira (fluxo OIDC). */}
            <a
              href={govbrLoginUrl()}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-govbr-blue px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-govbr-blue-dark"
            >
              Entrar com <span className="font-bold">gov<span className="text-govbr-yellow">.br</span></span>
            </a>
          </form>
        )}
        </div>
      </div>
      <GovFooter />
    </div>
  );
}
