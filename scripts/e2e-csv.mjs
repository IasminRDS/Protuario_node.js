#!/usr/bin/env node
/**
 * Validação E2E determinística da importação CSV (POST /csv/pacientes/import).
 * Node 20+ (fetch/FormData/Blob nativos). Re-executável: gera CPFs válidos novos
 * a cada run para evitar colisão. Verifica insert/rollback pela contagem de
 * pacientes (GET /pacientes) e a semântica STRICT/duplicidade pela resposta.
 *
 * Uso:
 *   node scripts/e2e-csv.mjs --base http://localhost:3011/api/v1 \
 *                            --login gestor --senha Gestor@123
 */

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);
const BASE = args.base ?? 'http://localhost:3000/api/v1';
const LOGIN = args.login ?? 'gestor';
const SENHA = args.senha ?? 'Gestor@123';

// --- CPF válido (dígitos verificadores oficiais) --------------------------
function gerarCpf() {
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const dv = (arr) => {
    const start = arr.length + 1;
    const soma = arr.reduce((s, n, i) => s + n * (start - i), 0);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(base);
  const d2 = dv([...base, d1]);
  return base.join('') + d1 + d2;
}

let token;
async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  return res;
}

async function totalPacientes() {
  const r = await api('/pacientes?page=1&pageSize=1');
  const j = await r.json();
  return j.data.meta.total;
}

async function upload(csv) {
  const form = new FormData();
  form.append('file', new Blob([csv], { type: 'text/csv' }), 'pacientes.csv');
  const r = await api('/csv/pacientes/import', { method: 'POST', body: form });
  const j = await r.json();
  return { status: r.status, data: j.data };
}

const results = [];
function check(nome, cond, detalhe) {
  results.push({ nome, ok: !!cond, detalhe });
  console.log(`  [${cond ? 'PASS' : 'FALHA'}] ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
}

(async () => {
  // Login
  const lr = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: LOGIN, senha: SENHA }),
  });
  const lj = await lr.json();
  token = lj?.data?.accessToken;
  if (!token) {
    console.error('Falha no login:', JSON.stringify(lj));
    process.exit(1);
  }
  console.log(`Autenticado como ${LOGIN}.`);

  const cpfA = gerarCpf();
  const cpfB = gerarCpf();
  const header = 'nome;cpf;data_nascimento;sexo';

  // 1) CSV válido → insere
  console.log('\n1) CSV válido (2 novos):');
  const antes1 = await totalPacientes();
  const r1 = await upload(
    `${header}\nJoao E2E;${cpfA};1988-03-12;M\nMaria E2E;${cpfB};1992-07-25;F\n`,
  );
  const depois1 = await totalPacientes();
  check('HTTP 201', r1.status === 201, `status=${r1.status}`);
  check('sucesso=true', r1.data?.sucesso === true);
  check('validos=2, invalidos=0', r1.data?.validos === 2 && r1.data?.invalidos === 0);
  check('2 pacientes inseridos', depois1 === antes1 + 2, `${antes1} → ${depois1}`);
  check('preview presente', Array.isArray(r1.data?.preview) && r1.data.preview.length === 2);

  // 2) CSV inválido (1 CPF ruim) → STRICT: nada inserido
  console.log('\n2) CSV inválido (1 CPF inválido):');
  const antes2 = await totalPacientes();
  const r2 = await upload(
    `${header}\nValido E2E;${gerarCpf()};1990-01-01;M\nInvalido;12345678900;1990-01-01;F\n`,
  );
  const depois2 = await totalPacientes();
  check('sucesso=false', r2.data?.sucesso === false);
  check('invalidos>=1 com erro de CPF', r2.data?.invalidos >= 1 && r2.data?.erros?.some((e) => /CPF/i.test(e.erro)));
  check('rollback total (nada inserido)', depois2 === antes2, `${antes2} → ${depois2}`);

  // 3) CSV duplicado (CPF já inserido no passo 1)
  console.log('\n3) CSV duplicado (CPF já existente):');
  const antes3 = await totalPacientes();
  const r3 = await upload(`${header}\nDuplicado;${cpfA};1988-03-12;M\n`);
  const depois3 = await totalPacientes();
  check('duplicado marcado inválido', r3.data?.invalidos === 1 && r3.data?.erros?.some((e) => /cadastrad/i.test(e.erro)));
  check('nada inserido', depois3 === antes3, `${antes3} → ${depois3}`);

  const falhas = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - falhas.length}/${results.length} checks OK ===`);
  process.exit(falhas.length === 0 ? 0 : 1);
})().catch((e) => {
  console.error('ERRO:', e);
  process.exit(1);
});
