'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { BadgeCheck, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import {
  documentosService,
  type VerificacaoDocumento,
} from '@/services/documentos.service';
import { apiErrorMessage } from '@/services/api';
import { GovBar, GovFooter } from '@/components/layout/GovBar';

/**
 * Página PÚBLICA de verificação de autenticidade (destino do QR impresso no
 * PDF). Sem login e sem PHI: confirma emissão pelo SNPE e integridade da
 * assinatura digital.
 */
export default function VerificarDocumentoPage() {
  const { id } = useParams<{ id: string }>();
  const [doc, setDoc] = useState<VerificacaoDocumento | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!id) return;
    documentosService
      .verificar(id)
      .then(setDoc)
      .catch((e) => setErro(apiErrorMessage(e, 'Documento não encontrado.')))
      .finally(() => setCarregando(false));
  }, [id]);

  const valido = doc?.assinaturaValida === true;

  return (
    <div className="flex min-h-screen flex-col bg-clinic-bg">
      <GovBar />
      <main className="flex flex-1 items-start justify-center p-4">
        <div className="mt-8 w-full max-w-lg">
          <div className="mb-4 flex flex-col items-center gap-2 text-center">
            <ShieldCheck className="h-9 w-9 text-clinic-primary" aria-hidden />
            <h1 className="text-lg font-bold text-slate-800">
              Verificação de documento
            </h1>
            <p className="text-xs text-slate-500">
              Sistema Nacional de Prontuário Eletrônico (SNPE)
            </p>
          </div>

          {carregando ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-8 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" /> Verificando…
            </div>
          ) : erro ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
              <ShieldAlert className="mx-auto mb-2 h-8 w-8 text-red-600" aria-hidden />
              <p className="font-semibold text-red-700">Documento não localizado</p>
              <p className="mt-1 text-sm text-red-600">{erro}</p>
            </div>
          ) : doc ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div
                className={`flex items-center gap-3 p-5 ${
                  valido ? 'bg-emerald-600' : 'bg-red-600'
                } text-white`}
              >
                {valido ? (
                  <BadgeCheck className="h-8 w-8 shrink-0" aria-hidden />
                ) : (
                  <ShieldAlert className="h-8 w-8 shrink-0" aria-hidden />
                )}
                <div>
                  <p className="text-base font-bold">
                    {valido
                      ? 'Documento autêntico e íntegro'
                      : 'Assinatura inválida'}
                  </p>
                  <p className="text-xs opacity-90">
                    {valido
                      ? 'Emitido e assinado digitalmente pelo SNPE.'
                      : 'A assinatura não confere com o registro.'}
                  </p>
                </div>
              </div>

              <dl className="divide-y divide-slate-100 p-5 text-sm">
                <Linha rotulo="Tipo de documento" valor={doc.tipoLabel} />
                <Linha rotulo="Assinado por" valor={doc.signatario} />
                {doc.signatarioDoc && (
                  <Linha rotulo="Registro profissional" valor={doc.signatarioDoc} />
                )}
                <Linha
                  rotulo="Emitido em"
                  valor={new Date(doc.emitidoEm).toLocaleString('pt-BR')}
                />
                <Linha rotulo="Algoritmo" valor={doc.algoritmo} />
                <div className="py-2">
                  <dt className="text-xs text-slate-400">Código de verificação</dt>
                  <dd className="font-mono text-xs break-all text-slate-600">{doc.id}</dd>
                </div>
                <div className="py-2">
                  <dt className="text-xs text-slate-400">Hash SHA-256 do documento</dt>
                  <dd className="font-mono text-[11px] break-all text-slate-500">
                    {doc.hash}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}

          <p className="mt-4 text-center text-[11px] text-slate-400">
            Esta página não exibe dados clínicos do paciente (LGPD). Confirma
            apenas a autenticidade e a integridade da assinatura.
          </p>
        </div>
      </main>
      <GovFooter />
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <dt className="text-xs text-slate-400">{rotulo}</dt>
      <dd className="text-right font-medium text-slate-700">{valor}</dd>
    </div>
  );
}
