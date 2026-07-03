/**
 * Impressão digital determinística da identidade do cidadão. É a base da
 * proteção contra duplicação sob concorrência: gravada em coluna UNIQUE, faz o
 * banco rejeitar (P2002) a segunda criação concorrente da MESMA pessoa —
 * inclusive quando não há CPF/CNS (caminho heurístico).
 *
 * Prioridade: CPF > CNS > demográfico (nome + nascimento + nome da mãe).
 */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos (diacríticos combinantes)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function identityFingerprint(input: {
  cpf: string | null;
  cns: string | null;
  nome: string;
  dataNascimento: Date;
  nomeMae?: string | null;
}): string {
  if (input.cpf) return `cpf:${input.cpf}`;
  if (input.cns) return `cns:${input.cns}`;
  const nome = normalize(input.nome);
  const mae = input.nomeMae ? normalize(input.nomeMae) : '';
  const dob = input.dataNascimento.toISOString().slice(0, 10);
  return `demo:${nome}|${dob}|${mae}`;
}
