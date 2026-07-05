import { setupTestApp, TestContext } from './helpers/test-app';
import { PrismaService } from '../src/infra/prisma/prisma.service';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Prova do §1.4 no nível do banco: "check-then-act" (SELECT depois INSERT) sofre
 * race sob concorrência real — várias requisições passam pela guarda e executam
 * a lógica. O claim atômico (INSERT ... ON CONFLICT DO NOTHING RETURNING) garante
 * execução única.
 */
describe('Idempotência — claim atômico vs check-then-act (E2E, Postgres real)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  beforeAll(async () => {
    ctx = await setupTestApp();
    prisma = ctx.prisma;
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE idempotency_keys');
  });

  // "check-then-act": lê, e SE não existe, executa e insere. Janela de race.
  async function naiveExecute(key: string, counter: { n: number }): Promise<void> {
    const found = await prisma.$queryRawUnsafe<{ key: string }[]>(
      'SELECT key FROM idempotency_keys WHERE key = $1',
      key,
    );
    if (found.length > 0) return; // replay
    await sleep(30); // alarga a janela → torna o race determinístico
    counter.n++; // <<< a "lógica" executa aqui (o bug: executa múltiplas vezes)
    try {
      await prisma.$executeRawUnsafe(
        "INSERT INTO idempotency_keys(key,request_hash,status) VALUES ($1,'h','in_progress')",
        key,
      );
    } catch {
      /* perdeu a corrida do INSERT — mas a lógica já rodou */
    }
  }

  // Claim atômico: só o vencedor do INSERT executa a lógica.
  async function atomicExecute(key: string, counter: { n: number }): Promise<void> {
    const claimed = await prisma.$queryRawUnsafe<{ key: string }[]>(
      "INSERT INTO idempotency_keys(key,request_hash,status) VALUES ($1,'h','in_progress') ON CONFLICT (key) DO NOTHING RETURNING key",
      key,
    );
    if (claimed.length === 0) return; // duplicada → replay
    counter.n++; // só o vencedor
  }

  it('PROVA DA FALHA: check-then-act executa a lógica MAIS DE UMA VEZ', async () => {
    const counter = { n: 0 };
    await Promise.all(
      Array.from({ length: 5 }, () => naiveExecute('same-key', counter)),
    );
    expect(counter.n).toBeGreaterThan(1); // race real: 5 execuções
  });

  it('PROVA DA CORREÇÃO: claim atômico executa EXATAMENTE UMA vez', async () => {
    const counter = { n: 0 };
    await Promise.all(
      Array.from({ length: 5 }, () => atomicExecute('same-key', counter)),
    );
    expect(counter.n).toBe(1); // execução única garantida
    const rows = await prisma.$queryRawUnsafe<Array<{ c: number }>>(
      'SELECT count(*)::int AS c FROM idempotency_keys',
    );
    expect(Number(rows[0].c)).toBe(1);
  });
});
