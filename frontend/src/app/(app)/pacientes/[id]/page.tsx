'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  BedDouble,
  Droplets,
  Pill,
  Siren,
  Syringe,
} from 'lucide-react';
import Link from 'next/link';
import { pacientesService } from '@/services/pacientes.service';
import {
  prontuarioService,
  type SumarioPaciente,
} from '@/services/prontuario.service';
import { apiErrorMessage } from '@/services/api';
import {
  Card,
  Skeleton,
  Badge,
  ErrorState,
} from '@/components/ui/primitives';
import { PatientTimeline } from '@/components/clinical/PatientTimeline';
import { ClinicalStateBadge } from '@/components/clinical/ClinicalStateBadge';
import { Can } from '@/modules/shared/rbac/Can';
import { PdfButton } from '@/components/pdf/PdfButton';
import {
  pdfErrorMessage,
  useDownloadProntuario,
} from '@/modules/pdf/hooks/useDownloadPdf';
import type { Paciente } from '@/types';

function idade(dataNascimento: string): number {
  const nasc = new Date(dataNascimento);
  const hoje = new Date();
  let anos = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) anos--;
  return anos;
}

export default function ProntuarioPacientePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const downloadProntuario = useDownloadProntuario();

  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [sumario, setSumario] = useState<SumarioPaciente | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sumarioError, setSumarioError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    pacientesService
      .getById(id)
      .then(setPaciente)
      .catch((e) => setError(apiErrorMessage(e)))
      .finally(() => setLoading(false));

    prontuarioService
      .getSumario(id)
      .then(setSumario)
      .catch((e) => setSumarioError(apiErrorMessage(e, 'Falha ao carregar o sumário.')));
  }, [id]);

  const alertas = sumario?.alertas;

  return (
    <div>
      <Link
        href="/pacientes"
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar aos pacientes
      </Link>

      {loading ? (
        <Skeleton className="h-24" />
      ) : error ? (
        <ErrorState message={error} />
      ) : paciente ? (
        <>
          {/* Estado clínico SEMPRE explícito (§4.1) — inclui VALIDO (verde). */}
          {paciente.consistencyState && (
            <div className="mb-4">
              <ClinicalStateBadge state={paciente.consistencyState} />
            </div>
          )}

          {/* Cabeçalho do Sumário do Paciente (IPS-like) */}
          <Card className="mb-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold text-slate-800">
                  {sumario?.paciente.nomeSocial ?? paciente.nome}
                </h1>
                {sumario?.paciente.nomeSocial && (
                  <p className="text-xs text-slate-400">Nome civil: {paciente.nome}</p>
                )}
                <p className="text-sm text-slate-500">
                  {paciente.sexo} · {idade(paciente.dataNascimento)} anos ·{' '}
                  {new Date(paciente.dataNascimento).toLocaleDateString('pt-BR')}
                  {sumario?.paciente.municipio &&
                    ` · ${sumario.paciente.municipio}${sumario.paciente.uf ? `/${sumario.paciente.uf}` : ''}`}
                </p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>CPF: {paciente.cpf ?? '—'}</p>
                <p>CNS: {paciente.cns ?? '—'}</p>
              </div>
            </div>

            {/* Alertas clínicos: SEMPRE visíveis quando existem (segurança). */}
            {alertas && (
              <div className="mt-3 flex flex-wrap gap-2">
                {alertas.alergias ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white">
                    <AlertTriangle className="h-3.5 w-3.5" /> ALERGIAS: {alertas.alergias}
                  </span>
                ) : (
                  <Badge tone="slate">Sem alergias registradas</Badge>
                )}
                {alertas.tipoSanguineo && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">
                    <Droplets className="h-3.5 w-3.5" /> {alertas.tipoSanguineo}
                  </span>
                )}
                {alertas.internado && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                    <BedDouble className="h-3.5 w-3.5" /> Internado
                  </span>
                )}
                {alertas.notificacoesPendentes > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                    <Siren className="h-3.5 w-3.5" /> {alertas.notificacoesPendentes}{' '}
                    notificação(ões) pendente(s)
                  </span>
                )}
              </div>
            )}

            <Can perm="clinical:read">
              <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4">
                <PdfButton
                  label="Gerar prontuário (PDF)"
                  loading={downloadProntuario.isPending}
                  onClick={() => downloadProntuario.mutate(paciente.id)}
                />
                {downloadProntuario.isError && (
                  <span className="text-xs text-red-600">
                    {pdfErrorMessage(downloadProntuario.error)}
                  </span>
                )}
              </div>
            </Can>
          </Card>

          {sumarioError && (
            <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
              {sumarioError}
            </p>
          )}

          {/* Sumário: problemas ativos / medicamentos / vacinas */}
          {sumario && (
            <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="p-4">
                <h2 className="mb-2 text-sm font-semibold text-slate-700">
                  Problemas ativos
                </h2>
                {sumario.problemasAtivos.length === 0 ? (
                  <p className="text-xs text-slate-400">Nenhum problema ativo registrado.</p>
                ) : (
                  <ul className="space-y-2">
                    {sumario.problemasAtivos.map((p, i) => (
                      <li key={i} className="text-sm">
                        <p className="font-medium text-slate-800">{p.descricao}</p>
                        <p className="text-xs text-slate-500">{p.contexto}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="p-4">
                <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                  <Pill className="h-4 w-4" /> Medicamentos em uso (90 dias)
                </h2>
                {sumario.medicamentosEmUso.length === 0 ? (
                  <p className="text-xs text-slate-400">Nenhuma prescrição recente.</p>
                ) : (
                  <ul className="space-y-2">
                    {sumario.medicamentosEmUso.map((m, i) => (
                      <li key={i} className="text-sm">
                        <p className="font-medium text-slate-800">{m.medicamento}</p>
                        <p className="text-xs text-slate-500">
                          {m.posologia ?? 'posologia não informada'} ·{' '}
                          {new Date(m.prescritoEm).toLocaleDateString('pt-BR')}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="p-4">
                <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                  <Syringe className="h-4 w-4" /> Vacinas
                </h2>
                {sumario.vacinas.length === 0 ? (
                  <p className="text-xs text-slate-400">Nenhuma vacina registrada.</p>
                ) : (
                  <ul className="space-y-2">
                    {sumario.vacinas.map((v, i) => (
                      <li key={i} className="text-sm">
                        <p className="font-medium text-slate-800">
                          {v.nome} {v.dose ? `(${v.dose})` : ''}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(v.data).toLocaleDateString('pt-BR')}
                          {v.unidade ? ` · ${v.unidade}` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          )}

          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">
              Linha do tempo clínica
            </h2>
            {sumario ? (
              <PatientTimeline items={sumario.timeline} />
            ) : sumarioError ? (
              <p className="text-sm text-slate-500">Histórico indisponível.</p>
            ) : (
              <Skeleton className="h-24" />
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
