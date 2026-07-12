'use client';

import { useState } from 'react';
import { Eye, IdCard, Syringe } from 'lucide-react';
import {
  prontuarioService,
  type AcessoProntuario,
  type SumarioPaciente,
} from '@/services/prontuario.service';
import { apiErrorMessage } from '@/services/api';
import { Card, EmptyState, PageHeader, Skeleton } from '@/components/ui/primitives';
import { PatientPicker } from '@/components/clinical/PatientPicker';
import type { Paciente } from '@/types';

const OPERACAO_LABEL: Record<string, string> = {
  PATIENT_VIEWED: 'Consulta ao prontuário',
  PDF_PRONTUARIO: 'Emissão de PDF do prontuário',
  EXPORTAR: 'Exportação de dados',
};

/**
 * Portal do Cidadão (visão "Meu SUS Digital"): cartão de vacinas e a trilha de
 * "quem acessou meu prontuário". Em produção, o próprio cidadão acessa esta
 * área autenticado por gov.br; aqui o profissional a consulta por paciente.
 */
export default function PortalCidadaoPage() {
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [sumario, setSumario] = useState<SumarioPaciente | null>(null);
  const [acessos, setAcessos] = useState<AcessoProntuario[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function selecionar(p: Paciente) {
    setPaciente(p);
    setCarregando(true);
    setErro(null);
    setSumario(null);
    setAcessos(null);
    try {
      const [s, a] = await Promise.all([
        prontuarioService.getSumario(p.id),
        prontuarioService.getAcessos(p.id),
      ]);
      setSumario(s);
      setAcessos(a);
    } catch (e) {
      setErro(apiErrorMessage(e, 'Falha ao carregar os dados do cidadão.'));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Portal do Cidadão"
        subtitle="Cartão de vacinas e transparência de acesso ao prontuário (LGPD)"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-1">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <IdCard className="h-4 w-4" /> Cidadão
          </h2>
          <PatientPicker selected={paciente} onSelect={selecionar} />
        </Card>

        <div className="space-y-4 lg:col-span-2">
          {erro && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{erro}</p>
          )}

          {!paciente ? (
            <Card className="p-4">
              <EmptyState
                title="Selecione um cidadão"
                hint="O cartão de vacinas e a trilha de acessos aparecem aqui."
              />
            </Card>
          ) : (
            <>
              <Card className="p-4">
                <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                  <Syringe className="h-4 w-4" /> Cartão de vacinas
                </h2>
                {carregando ? (
                  <Skeleton className="h-20" />
                ) : sumario && sumario.vacinas.length > 0 ? (
                  <ul className="divide-y divide-slate-100">
                    {sumario.vacinas.map((v, i) => (
                      <li key={i} className="flex items-center justify-between py-2 text-sm">
                        <span className="font-medium text-slate-800">
                          {v.nome} {v.dose ? `(${v.dose})` : ''}
                        </span>
                        <span className="text-xs text-slate-400">
                          {new Date(v.data).toLocaleDateString('pt-BR')}
                          {v.unidade ? ` · ${v.unidade}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400">Nenhuma vacina registrada.</p>
                )}
              </Card>

              <Card className="p-4">
                <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                  <Eye className="h-4 w-4" /> Quem acessou meu prontuário
                </h2>
                <p className="mb-3 text-xs text-slate-400">
                  Registro de todos os acessos ao seu prontuário (transparência LGPD).
                </p>
                {carregando ? (
                  <Skeleton className="h-20" />
                ) : acessos && acessos.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                          <th className="py-2 pr-4 font-medium">Profissional</th>
                          <th className="py-2 pr-4 font-medium">Ação</th>
                          <th className="py-2 pr-4 font-medium">Finalidade</th>
                          <th className="py-2 font-medium">Quando</th>
                        </tr>
                      </thead>
                      <tbody>
                        {acessos.map((a) => (
                          <tr key={a.id} className="border-b border-slate-100 last:border-0">
                            <td className="py-2 pr-4">
                              {a.quem}
                              {a.perfil && (
                                <span className="block text-xs text-slate-400">{a.perfil}</span>
                              )}
                            </td>
                            <td className="py-2 pr-4 text-xs">
                              {OPERACAO_LABEL[a.operacao] ?? a.operacao}
                            </td>
                            <td className="py-2 pr-4 text-xs capitalize">{a.finalidade}</td>
                            <td className="py-2 text-xs text-slate-500">
                              {new Date(a.quando).toLocaleString('pt-BR')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Nenhum acesso registrado ainda.</p>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
