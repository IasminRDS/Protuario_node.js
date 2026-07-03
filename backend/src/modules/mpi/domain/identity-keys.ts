/**
 * Chaves determinísticas de identidade. São a fonte de verdade da identidade
 * global (tabela cidadao_identity_key, cada chave UNIQUE):
 *   - "cpf:<cpf>"  (autoritativa)
 *   - "cns:<cns>"
 *   - "demo:<nome|nascimento|mae>"  (apenas quando NÃO há CPF/CNS)
 *
 * Regra anti-split: qualquer identificador compartilhado colide na UNIQUE e
 * força resolução para o MESMO cidadão. Chaves fortes divergentes = pessoas
 * distintas (nunca fundidas). O caso raro "mesma pessoa, um com CPF e outro
 * sem, criados concorrentemente" é fechado depois pela reconciliação assíncrona.
 */
export type IdentityKind = 'CPF' | 'CNS' | 'DEMO';

export interface IdentityKey {
  key: string;
  kind: IdentityKind;
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function demoValue(
  nome: string,
  dataNascimento: Date,
  nomeMae?: string | null,
): string {
  const dob = dataNascimento.toISOString().slice(0, 10);
  const mae = nomeMae ? normalize(nomeMae) : '';
  return `demo:${normalize(nome)}|${dob}|${mae}`;
}

export function computeIdentityKeys(input: {
  cpf: string | null;
  cns: string | null;
  nome: string;
  dataNascimento: Date;
  nomeMae?: string | null;
}): IdentityKey[] {
  const keys: IdentityKey[] = [];
  if (input.cpf) keys.push({ key: `cpf:${input.cpf}`, kind: 'CPF' });
  if (input.cns) keys.push({ key: `cns:${input.cns}`, kind: 'CNS' });
  // Chave demográfica só para registros sem identificador forte (evita
  // fusão indevida de homônimos com CPFs distintos).
  if (!input.cpf && !input.cns) {
    keys.push({ key: demoValue(input.nome, input.dataNascimento, input.nomeMae), kind: 'DEMO' });
  }
  return keys;
}

/** Chaves fortes (para reconciliação: vincular CPF/CNS a um registro existente). */
export function strongKeys(cpf: string | null, cns: string | null): IdentityKey[] {
  const keys: IdentityKey[] = [];
  if (cpf) keys.push({ key: `cpf:${cpf}`, kind: 'CPF' });
  if (cns) keys.push({ key: `cns:${cns}`, kind: 'CNS' });
  return keys;
}
