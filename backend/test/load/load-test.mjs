/**
 * Teste de carga (autocannon) dos endpoints de LEITURA críticos, sob RLS.
 *
 * Uso:
 *   node test/load/load-test.mjs            # 20 conexões, 15s, /pacientes
 *   API=http://host:3000/api/v1 CONN=50 DUR=30 node test/load/load-test.mjs
 *
 * Requer o servidor rodando. Faz login e mede latência/throughput autenticado.
 */
import autocannon from 'autocannon';

const API = process.env.API ?? 'http://localhost:3000/api/v1';
const LOGIN = process.env.LOGIN ?? 'dr.souza';
const SENHA = process.env.SENHA ?? 'Medico@123';
const PATH = process.env.PATH_TEST ?? '/pacientes?page=1&pageSize=1';
const connections = Number(process.env.CONN ?? 20);
const duration = Number(process.env.DUR ?? 15);

const res = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ login: LOGIN, senha: SENHA }),
});
const { data } = await res.json();
if (!data?.accessToken) {
  console.error('Login falhou:', data);
  process.exit(1);
}

console.log(`Carga: ${connections} conexões, ${duration}s → GET ${PATH}`);
const result = await autocannon({
  url: `${API}${PATH}`,
  connections,
  duration,
  headers: { Authorization: `Bearer ${data.accessToken}` },
});

console.log('--- Resultado ---');
console.log(`req/s (média): ${result.requests.average}`);
console.log(`latência p50/p97.5/p99 (ms): ${result.latency.p50}/${result.latency.p97_5}/${result.latency.p99}`);
console.log(`2xx: ${result['2xx']} | não-2xx: ${result.non2xx}`);
