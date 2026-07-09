'use client';

import { useRef, useState } from 'react';
import { FileUp, Upload, X } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  PageHeader,
} from '@/components/ui/primitives';
import {
  importErrorMessage,
  useImportPacientes,
} from '../hooks/useImportPacientes';
import type { ImportResponse } from '../types';

const MAX_BYTES = 5 * 1024 * 1024;

export function CsvUploadPage() {
  const importar = useImportPacientes();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ImportResponse | null>(null);

  function selecionar(f: File | null) {
    setResultado(null);
    setErroLocal(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (!/\.csv$/i.test(f.name)) {
      setErroLocal('Selecione um arquivo .csv.');
      setFile(null);
      return;
    }
    if (f.size > MAX_BYTES) {
      setErroLocal('Arquivo excede o limite de 5MB.');
      setFile(null);
      return;
    }
    setFile(f);
  }

  async function enviar() {
    if (!file) return;
    setErroLocal(null);
    setResultado(null);
    try {
      const res = await importar.mutateAsync(file);
      setResultado(res);
    } catch (e) {
      setErroLocal(importErrorMessage(e));
    }
  }

  function limpar() {
    setFile(null);
    setResultado(null);
    setErroLocal(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div>
      <PageHeader
        title="Importação de pacientes (CSV)"
        subtitle="Formato: nome;cpf;data_nascimento;sexo — modo estrito (tudo ou nada)"
      />

      {/* Upload */}
      <Card className="mb-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 hover:border-clinic-primary">
            <FileUp className="h-4 w-4" />
            {file ? file.name : 'Escolher arquivo .csv'}
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => selecionar(e.target.files?.[0] ?? null)}
            />
          </label>

          <Button
            onClick={enviar}
            loading={importar.isPending}
            disabled={!file || importar.isPending}
          >
            <Upload className="h-4 w-4" />
            Enviar
          </Button>

          {(file || resultado) && (
            <Button variant="ghost" onClick={limpar} disabled={importar.isPending}>
              <X className="h-4 w-4" />
              Limpar
            </Button>
          )}
        </div>

        {file && (
          <p className="mt-2 text-xs text-slate-500">
            {(file.size / 1024).toFixed(1)} KB · máx. 5MB
          </p>
        )}
        {erroLocal && <p className="mt-2 text-sm text-red-600">{erroLocal}</p>}
      </Card>

      {resultado && <ResultadoImportacao resultado={resultado} />}
    </div>
  );
}

function ResultadoImportacao({ resultado }: { resultado: ImportResponse }) {
  return (
    <div className="space-y-4">
      {/* Resumo */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">Resultado</span>
          <Badge tone={resultado.sucesso ? 'green' : 'red'}>
            {resultado.sucesso ? 'Importado com sucesso' : 'Não importado (modo estrito)'}
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <Metric label="Total" value={resultado.total} tone="slate" />
          <Metric label="Válidos" value={resultado.validos} tone="green" />
          <Metric label="Inválidos" value={resultado.invalidos} tone="red" />
        </div>
        {!resultado.sucesso && resultado.invalidos > 0 && (
          <p className="mt-3 text-xs text-amber-700">
            Nenhum registro foi gravado: no modo estrito, qualquer erro cancela a
            importação inteira. Corrija as linhas abaixo e reenvie.
          </p>
        )}
      </Card>

      {/* Preview */}
      {resultado.preview.length > 0 && (
        <Card>
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
            Prévia ({resultado.preview.length} primeiras linhas)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Nome</th>
                  <th className="px-4 py-2">CPF</th>
                  <th className="px-4 py-2">Nascimento</th>
                  <th className="px-4 py-2">Sexo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resultado.preview.map((p, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 text-slate-800">{p.nome}</td>
                    <td className="px-4 py-2 text-slate-600">{p.cpf}</td>
                    <td className="px-4 py-2 text-slate-600">{p.dataNascimento}</td>
                    <td className="px-4 py-2 text-slate-600">{p.sexo ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Erros */}
      {resultado.erros.length > 0 && (
        <Card>
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-red-700">
            Erros ({resultado.erros.length})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 w-24">Linha</th>
                  <th className="px-4 py-2">Erro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resultado.erros.map((e, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 font-mono text-slate-600">{e.linha}</td>
                    <td className="px-4 py-2 text-red-600">{e.erro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'slate' | 'green' | 'red';
}) {
  const cls = {
    slate: 'text-slate-800',
    green: 'text-emerald-600',
    red: 'text-red-600',
  }[tone];
  return (
    <div className="rounded-md bg-slate-50 py-3">
      <p className={`text-2xl font-semibold ${cls}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
