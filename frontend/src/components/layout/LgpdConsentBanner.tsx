'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { lgpdService } from '@/services/lgpd.service';
import { Button } from '@/components/ui/primitives';

/**
 * Banner de consentimento LGPD (base legal art. 7º/11). Aparece enquanto o
 * usuário não tiver aceito a versão vigente do termo; o aceite é registrado no
 * backend (consentimento versionado + auditoria).
 */
export function LgpdConsentBanner() {
  const [visivel, setVisivel] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    lgpdService
      .status()
      .then((s) => setVisivel(!s.aceito))
      .catch(() => setVisivel(false)); // endpoint indisponível: não incomoda
  }, []);

  async function aceitar() {
    setSalvando(true);
    try {
      await lgpdService.consentir('assistencial');
      setVisivel(false);
    } catch {
      setSalvando(false);
    }
  }

  if (!visivel) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white p-4 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
      <div className="mx-auto flex max-w-screen-xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-xs text-slate-600">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-clinic-primary" aria-hidden />
          <span>
            Este sistema trata dados pessoais de saúde para finalidade{' '}
            <strong>assistencial</strong>, com acesso auditado, conforme a{' '}
            <strong>LGPD (Lei 13.709/2018)</strong>. Ao continuar, você reconhece o
            tratamento e o registro de acessos.
          </span>
        </p>
        <Button onClick={aceitar} loading={salvando} className="shrink-0">
          Li e concordo
        </Button>
      </div>
    </div>
  );
}
