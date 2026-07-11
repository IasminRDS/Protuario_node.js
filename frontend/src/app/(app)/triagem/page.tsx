'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Clock3 } from 'lucide-react';
import { triagemService } from '@/services/clinical.service';
import { apiErrorMessage } from '@/services/api';
import { MANCHESTER } from '@/modules/shared/clinical/manchester';
import {
  Button,
  Card,
  Field,
  Input,
  PageHeader,
} from '@/components/ui/primitives';
import { PatientPicker } from '@/components/clinical/PatientPicker';
import { cn } from '@/utils/cn';
import type { Paciente } from '@/types';

const schema = z.object({
  pressao: z.string().optional(),
  temperatura: z.coerce.number().optional(),
  frequencia: z.coerce.number().optional(),
  saturacao: z.coerce.number().optional(),
  peso: z.coerce.number().optional(),
  altura: z.coerce.number().optional(),
  observacoes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function TriagemPage() {
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [classificacao, setClassificacao] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const { register, handleSubmit, reset, formState: { isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    if (!paciente) {
      setFeedback({ ok: false, msg: 'Selecione um paciente.' });
      return;
    }
    if (!classificacao) {
      setFeedback({ ok: false, msg: 'Selecione a classificação de risco (Manchester).' });
      return;
    }
    setFeedback(null);
    try {
      const resultado = await triagemService.registrar({
        pacienteId: paciente.id,
        pacienteNome: paciente.nome,
        classificacao,
        ...data,
      });
      setFeedback({
        ok: true,
        msg: resultado.queued
          ? 'Sem conexão: triagem salva no dispositivo e será sincronizada automaticamente.'
          : 'Triagem registrada.',
      });
      reset();
      setClassificacao(null);
    } catch (err) {
      setFeedback({ ok: false, msg: apiErrorMessage(err, 'Falha ao registrar triagem.') });
    }
  }

  return (
    <div>
      <PageHeader
        title="Triagem"
        subtitle="Sinais vitais e classificação de risco — Protocolo de Manchester"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-1">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Paciente</h2>
          <PatientPicker selected={paciente} onSelect={setPaciente} />
        </Card>

        <Card className="p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Sinais vitais {paciente && `— ${paciente.nome}`}
          </h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Field label="Pressão arterial">
                <Input placeholder="120/80" {...register('pressao')} />
              </Field>
              <Field label="Temperatura (°C)">
                <Input type="number" step="0.1" {...register('temperatura')} />
              </Field>
              <Field label="Freq. cardíaca (bpm)">
                <Input type="number" {...register('frequencia')} />
              </Field>
              <Field label="Saturação (%)">
                <Input type="number" step="0.1" {...register('saturacao')} />
              </Field>
              <Field label="Peso (kg)">
                <Input type="number" step="0.1" {...register('peso')} />
              </Field>
              <Field label="Altura (m)">
                <Input type="number" step="0.01" {...register('altura')} />
              </Field>
            </div>

            <Field label="Classificação de risco (Manchester)">
              <div
                role="radiogroup"
                aria-label="Classificação de risco Manchester"
                className="grid grid-cols-2 gap-2 sm:grid-cols-5"
              >
                {MANCHESTER.map((nivel) => {
                  const ativo = classificacao === nivel.valor;
                  return (
                    <button
                      key={nivel.valor}
                      type="button"
                      role="radio"
                      aria-checked={ativo}
                      onClick={() => setClassificacao(nivel.valor)}
                      className={cn(
                        'flex flex-col items-center gap-0.5 rounded-md px-2 py-2 text-xs font-semibold transition-all',
                        nivel.chip,
                        ativo
                          ? `ring-2 ring-offset-2 ${nivel.ring} scale-[1.03]`
                          : 'opacity-60 hover:opacity-100',
                      )}
                    >
                      <span>{nivel.rotulo}</span>
                      <span className="flex items-center gap-1 text-[10px] font-normal">
                        <Clock3 className="h-3 w-3" aria-hidden /> {nivel.tempoAlvo}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Observações">
              <textarea
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                rows={2}
                {...register('observacoes')}
              />
            </Field>

            {feedback && (
              <p
                className={`rounded-md px-3 py-2 text-xs ${
                  feedback.ok
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-red-50 text-red-600'
                }`}
              >
                {feedback.msg}
              </p>
            )}

            <Button type="submit" loading={isSubmitting} disabled={!paciente}>
              Registrar triagem
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
