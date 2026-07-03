'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  pacientesService,
  type CreatePacienteInput,
} from '@/services/pacientes.service';
import { apiErrorMessage } from '@/services/api';
import { Button, Field, Input } from '@/components/ui/primitives';
import { useState } from 'react';

const schema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  dataNascimento: z.string().min(1, 'Data obrigatória'),
  sexo: z.enum(['M', 'F', 'O']),
  cpf: z.string().optional(),
  cns: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
});
type FormData = z.infer<typeof schema>;

export function PacienteForm({ onCreated }: { onCreated: () => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { sexo: 'M' },
  });

  async function onSubmit(data: FormData) {
    setServerError(null);
    try {
      const payload: CreatePacienteInput = {
        ...data,
        email: data.email || undefined,
      };
      await pacientesService.create(payload);
      reset();
      onCreated();
    } catch (err) {
      setServerError(apiErrorMessage(err, 'Não foi possível cadastrar.'));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <Field label="Nome completo" error={errors.nome?.message}>
        <Input {...register('nome')} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nascimento" error={errors.dataNascimento?.message}>
          <Input type="date" {...register('dataNascimento')} />
        </Field>
        <Field label="Sexo" error={errors.sexo?.message}>
          <select
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            {...register('sexo')}
          >
            <option value="M">Masculino</option>
            <option value="F">Feminino</option>
            <option value="O">Outro</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="CPF" error={errors.cpf?.message}>
          <Input placeholder="000.000.000-00" {...register('cpf')} />
        </Field>
        <Field label="CNS" error={errors.cns?.message}>
          <Input {...register('cns')} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Telefone" error={errors.telefone?.message}>
          <Input {...register('telefone')} />
        </Field>
        <Field label="E-mail" error={errors.email?.message}>
          <Input type="email" {...register('email')} />
        </Field>
      </div>

      {serverError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
          {serverError}
        </p>
      )}

      <Button type="submit" loading={isSubmitting} className="w-full">
        Cadastrar paciente
      </Button>
    </form>
  );
}
