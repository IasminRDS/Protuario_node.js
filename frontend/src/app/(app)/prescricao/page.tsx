'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pill } from 'lucide-react';
import { prescricaoService } from '@/services/clinical.service';
import { apiErrorMessage } from '@/services/api';
import {
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Badge,
} from '@/components/ui/primitives';

const schema = z.object({
  atendimentoId: z.string().min(1, 'Informe o atendimento'),
  medicamento: z.string().min(1, 'Medicamento obrigatório'),
  dosagem: z.string().optional(),
  frequencia: z.string().optional(),
  duracao: z.string().optional(),
  observacoes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function PrescricaoPage() {
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setFeedback(null);
    try {
      await prescricaoService.emitir(data);
      setFeedback({ ok: true, msg: 'Prescrição emitida.' });
      reset();
    } catch (err) {
      setFeedback({ ok: false, msg: apiErrorMessage(err, 'Falha ao emitir prescrição.') });
    }
  }

  return (
    <div>
      <PageHeader
        title="Prescrição médica"
        subtitle="Medicamentos, posologia e observações clínicas"
        actions={<Badge tone="amber">endpoint /prescricoes pendente no backend</Badge>}
      />

      <Card className="max-w-2xl p-5">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Field label="ID do atendimento" error={errors.atendimentoId?.message}>
            <Input placeholder="Vincule ao atendimento em andamento" {...register('atendimentoId')} />
          </Field>
          <Field label="Medicamento" error={errors.medicamento?.message}>
            <Input placeholder="Ex.: Dipirona 500mg" {...register('medicamento')} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Dosagem">
              <Input placeholder="1 comp." {...register('dosagem')} />
            </Field>
            <Field label="Frequência">
              <Input placeholder="8/8h" {...register('frequencia')} />
            </Field>
            <Field label="Duração">
              <Input placeholder="7 dias" {...register('duracao')} />
            </Field>
          </div>
          <Field label="Observações clínicas">
            <textarea
              rows={3}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              {...register('observacoes')}
            />
          </Field>

          {feedback && (
            <p className={`rounded-md px-3 py-2 text-xs ${feedback.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
              {feedback.msg}
            </p>
          )}

          <Button type="submit" loading={isSubmitting}>
            <Pill className="h-4 w-4" /> Emitir prescrição
          </Button>
        </form>
      </Card>
    </div>
  );
}
