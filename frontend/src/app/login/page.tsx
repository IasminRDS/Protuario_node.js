'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Activity } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { apiErrorMessage } from '@/services/api';
import { useAuthStore } from '@/store/auth.store';
import { Button, Field, Input } from '@/components/ui/primitives';

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

  async function onSubmit(data: FormData) {
    setServerError(null);
    try {
      const tokens = await authService.login(data.login, data.senha);
      doLogin(tokens);
      router.replace('/dashboard');
    } catch (err) {
      setServerError(apiErrorMessage(err, 'Falha na autenticação.'));
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <Activity className="h-9 w-9 text-clinic-primary" />
          <h1 className="text-lg font-bold text-slate-800">S-PE</h1>
          <p className="text-xs text-slate-400">Prontuário Eletrônico Hospitalar</p>
        </div>

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
        </form>
      </div>
    </div>
  );
}
