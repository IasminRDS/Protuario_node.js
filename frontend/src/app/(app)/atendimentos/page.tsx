'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Stethoscope, CheckCircle2 } from 'lucide-react';
import { atendimentoService } from '@/services/atendimento.service';
import { apiErrorMessage } from '@/services/api';
import {
  Button,
  Card,
  Field,
  Input,
  PageHeader,
} from '@/components/ui/primitives';
import { PatientPicker } from '@/components/clinical/PatientPicker';
import type { Atendimento, Paciente } from '@/types';

const schema = z.object({
  queixaPrincipal: z.string().min(1, 'Informe a queixa'),
  hipoteseDiagnostica: z.string().min(1, 'Informe a hipótese'),
  conduta: z.string().min(1, 'Informe a conduta'),
  evolucao: z.string().min(1, 'Descreva a evolução'),
});
type FormData = z.infer<typeof schema>;

export default function AtendimentosPage() {
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [atendimento, setAtendimento] = useState<Atendimento | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  async function iniciar() {
    if (!paciente) return;
    setFeedback(null);
    try {
      const at = await atendimentoService.iniciar(paciente.id, 'CONSULTA');
      setAtendimento(at);
    } catch (err) {
      setFeedback({ ok: false, msg: apiErrorMessage(err, 'Não foi possível iniciar o atendimento.') });
    }
  }

  async function salvarEvolucao(data: FormData) {
    if (!atendimento) return;
    setFeedback(null);
    try {
      await atendimentoService.registrarEvolucao(atendimento.id, data);
      setFeedback({ ok: true, msg: 'Evolução registrada no prontuário.' });
    } catch (err) {
      setFeedback({ ok: false, msg: apiErrorMessage(err, 'Falha ao registrar evolução.') });
    }
  }

  async function finalizar() {
    if (!atendimento) return;
    try {
      await atendimentoService.finalizar(atendimento.id);
      setAtendimento(null);
      setPaciente(null);
      setFeedback({ ok: true, msg: 'Atendimento finalizado.' });
    } catch (err) {
      setFeedback({ ok: false, msg: apiErrorMessage(err, 'Falha ao finalizar.') });
    }
  }

  return (
    <div>
      <PageHeader
        title="Atendimento médico"
        subtitle="Evolução clínica, diagnóstico e conduta"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-1">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Paciente</h2>
          <PatientPicker selected={paciente} onSelect={(p) => { setPaciente(p); setAtendimento(null); }} />
          {paciente && !atendimento && (
            <Button className="mt-3 w-full" onClick={iniciar}>
              <Stethoscope className="h-4 w-4" /> Iniciar atendimento
            </Button>
          )}
          {atendimento && (
            <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              Atendimento #{atendimento.id} em andamento
            </div>
          )}
        </Card>

        <Card className="p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Evolução clínica</h2>
          <form onSubmit={handleSubmit(salvarEvolucao)} className="space-y-3">
            <Field label="Queixa principal" error={errors.queixaPrincipal?.message}>
              <Input {...register('queixaPrincipal')} disabled={!atendimento} />
            </Field>
            <Field label="Hipótese diagnóstica" error={errors.hipoteseDiagnostica?.message}>
              <Input {...register('hipoteseDiagnostica')} disabled={!atendimento} />
            </Field>
            <Field label="Conduta" error={errors.conduta?.message}>
              <Input {...register('conduta')} disabled={!atendimento} />
            </Field>
            <Field label="Evolução" error={errors.evolucao?.message}>
              <textarea
                rows={4}
                disabled={!atendimento}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50"
                {...register('evolucao')}
              />
            </Field>

            {feedback && (
              <p className={`rounded-md px-3 py-2 text-xs ${feedback.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                {feedback.msg}
              </p>
            )}

            <div className="flex gap-2">
              <Button type="submit" loading={isSubmitting} disabled={!atendimento}>
                Salvar evolução
              </Button>
              <Button type="button" variant="secondary" onClick={finalizar} disabled={!atendimento}>
                <CheckCircle2 className="h-4 w-4" /> Finalizar consulta
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
