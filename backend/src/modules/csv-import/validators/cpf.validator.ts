/**
 * Validação de CPF pelo algoritmo oficial (dígitos verificadores) + rejeição de
 * sequências repetidas (000..., 111..., etc.). Puro e testável.
 */
export function limparCpf(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\D/g, '');
}

function digitoVerificador(base: string, pesoInicial: number): number {
  let soma = 0;
  for (let i = 0; i < base.length; i++) {
    soma += Number(base[i]) * (pesoInicial - i);
  }
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

export function isValidCpf(raw: string | null | undefined): boolean {
  const cpf = limparCpf(raw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // todos os dígitos iguais

  const dv1 = digitoVerificador(cpf.slice(0, 9), 10);
  if (dv1 !== Number(cpf[9])) return false;

  const dv2 = digitoVerificador(cpf.slice(0, 10), 11);
  if (dv2 !== Number(cpf[10])) return false;

  return true;
}
