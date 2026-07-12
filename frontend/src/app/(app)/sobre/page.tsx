'use client';

import {
  Activity,
  FileSignature,
  Fingerprint,
  Landmark,
  Network,
  ShieldCheck,
} from 'lucide-react';
import { Card, PageHeader } from '@/components/ui/primitives';

const RECURSOS = [
  { icon: Landmark, titulo: 'Login gov.br', desc: 'Autenticação federada OIDC com selos de confiabilidade (bronze/prata/ouro).' },
  { icon: FileSignature, titulo: 'Assinatura digital', desc: 'Documentos clínicos assinados (SHA-256/RSA) com QR de verificação pública.' },
  { icon: Network, titulo: 'Interoperabilidade RNDS', desc: 'Envio de registros clínicos em FHIR R4 (RAC, RIA, resultados de exame).' },
  { icon: Fingerprint, titulo: 'Identidade nacional (MPI)', desc: 'Cidadão único por CPF/CNS, distinto do registro clínico local.' },
  { icon: ShieldCheck, titulo: 'Auditoria verificável', desc: 'Trilha imutável com cadeia de hash (não-repúdio, ADR-06) e RLS por tenant.' },
  { icon: Activity, titulo: 'Vigilância e regulação', desc: 'Notificação compulsória (SINAN), regulação de vagas e painel epidemiológico.' },
];

export default function SobrePage() {
  return (
    <div>
      <PageHeader
        title="Sobre o Sistema"
        subtitle="Sistema Nacional de Prontuário Eletrônico (SNPE)"
      />

      <Card className="mb-4 p-5">
        <p className="text-sm text-slate-600">
          O <strong>SNPE</strong> é uma plataforma de prontuário eletrônico com
          arquitetura de nível nacional: identidade federada do cidadão (MPI),
          isolamento de dados por estabelecimento (RLS), interoperabilidade com a
          RNDS via FHIR R4, e conformidade com a LGPD (acesso auditado e
          transparência ao titular). Segue o Padrão Digital de Governo (gov.br) e
          os requisitos de acessibilidade (eMAG / VLibras).
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-400">Versão</dt>
            <dd className="font-mono font-medium text-slate-700">v1.4.0-dev</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Interoperabilidade</dt>
            <dd className="font-medium text-slate-700">FHIR R4 · RNDS</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Autenticação</dt>
            <dd className="font-medium text-slate-700">gov.br · MFA</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Conformidade</dt>
            <dd className="font-medium text-slate-700">LGPD · eMAG</dd>
          </div>
        </dl>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {RECURSOS.map((r) => {
          const Icon = r.icon;
          return (
            <Card key={r.titulo} className="p-4">
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-clinic-primary/10 text-clinic-primary">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">{r.titulo}</h3>
              <p className="mt-0.5 text-xs text-slate-500">{r.desc}</p>
            </Card>
          );
        })}
      </div>

      <p className="mt-6 text-center text-[11px] text-slate-400">
        Ministério da Saúde · Ambiente de desenvolvimento. As integrações
        externas (gov.br, RNDS, ICP-Brasil) operam em modo simulado até o
        credenciamento oficial.
      </p>
    </div>
  );
}
