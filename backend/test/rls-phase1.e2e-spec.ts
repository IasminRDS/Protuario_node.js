import { setupTestApp, TestContext } from './helpers/test-app';
import { createHospital, createPaciente, truncateAll } from './helpers/factories';

/**
 * RLS FASE 1 — prova ADVERSARIAL do isolamento no NÍVEL DO BANCO.
 *
 * Estratégia: as migrations do harness rodam como o superuser do container
 * (dono das tabelas), que IGNORA RLS. Para exercitar a policy, cada asserção
 * roda dentro de uma tx com `SET LOCAL ROLE prontuario_app` — a role NÃO-dona
 * criada pela migration rls_phase1 — assumindo a identidade que o app usará em
 * produção. Usamos SQL CRU ($queryRawUnsafe): isso contorna o middleware
 * app-layer ($use/scopeParams) e prova o enforcement do PostgreSQL PURO, sem
 * depender do wiring de aplicação nem da flag RLS_ENABLED.
 *
 * Enquanto estes testes não estiverem verdes, NÃO troque DATABASE_URL do app
 * para a role prontuario_app (o app leria vazio).
 */
describe('RLS Fase 1 — isolamento no banco (E2E, Postgres real)', () => {
  let ctx: TestContext;
  let hospitalA: string;
  let hospitalB: string;

  beforeAll(async () => {
    ctx = await setupTestApp();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await truncateAll(ctx.prisma);
    hospitalA = await createHospital(ctx.prisma, 'Hospital A');
    hospitalB = await createHospital(ctx.prisma, 'Hospital B');
    // Sementes inseridas como DONO (bypassa RLS) — 2 em A, 1 em B.
    await createPaciente(ctx.prisma, { hospitalId: hospitalA, nome: 'A-1', cpf: '11111111111' });
    await createPaciente(ctx.prisma, { hospitalId: hospitalA, nome: 'A-2', cpf: '22222222222' });
    await createPaciente(ctx.prisma, { hospitalId: hospitalB, nome: 'B-1', cpf: '33333333333' });
  });

  /** Roda `fn` sob a role do app, com (ou sem) o GUC de tenant setado. */
  async function asApp<T>(
    hospitalId: string | null,
    fn: (tx: {
      $queryRawUnsafe<R>(q: string, ...args: unknown[]): Promise<R>;
      $executeRawUnsafe(q: string, ...args: unknown[]): Promise<number>;
    }) => Promise<T>,
  ): Promise<T> {
    return ctx.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE prontuario_app');
      // set_config(_, _, true) = LOCAL: escopo desta tx. Sem chamada => GUC ausente.
      if (hospitalId !== null) {
        await tx.$executeRawUnsafe(
          "SELECT set_config('app.hospital_id', $1, true)",
          hospitalId,
        );
      }
      return fn(tx as never);
    });
  }

  const countPaciente = async (tx: {
    $queryRawUnsafe<R>(q: string, ...a: unknown[]): Promise<R>;
  }): Promise<number> => {
    const rows = await tx.$queryRawUnsafe<Array<{ n: number }>>(
      'SELECT count(*)::int AS n FROM paciente',
    );
    return rows[0].n;
  };

  it('1. leitura sob GUC=A enxerga só os pacientes de A', async () => {
    const n = await asApp(hospitalA, (tx) => countPaciente(tx));
    expect(n).toBe(2);
  });

  it('2. leitura sob GUC=B enxerga só o paciente de B', async () => {
    const n = await asApp(hospitalB, (tx) => countPaciente(tx));
    expect(n).toBe(1);
  });

  it('3. fail-closed: sem GUC setado, nenhuma linha é visível', async () => {
    const n = await asApp(null, (tx) => countPaciente(tx));
    expect(n).toBe(0);
  });

  it('4. tenant A não acessa linha específica de B (vazamento por id)', async () => {
    const rows = await asApp(hospitalA, (tx) =>
      tx.$queryRawUnsafe<Array<{ nome: string }>>(
        'SELECT nome FROM paciente WHERE nome = $1',
        'B-1',
      ),
    );
    expect(rows).toHaveLength(0);
  });

  it('5. WITH CHECK bloqueia INSERT cross-tenant (GUC=A gravando em B)', async () => {
    await expect(
      asApp(hospitalA, (tx) =>
        tx.$executeRawUnsafe(
          // $1::uuid: sem o cast o parâmetro chega como text e o erro seria de
          // TIPO (42804) — o teste passaria pelo motivo errado, sem exercitar
          // a policy WITH CHECK (42501).
          `INSERT INTO paciente (nome, sexo, data_nascimento, status, hospital_id, updated_at)
           VALUES ('intruso', 'M', '1990-01-01', 'REGISTERED', $1::uuid, now())`,
          hospitalB,
        ),
      ),
    ).rejects.toThrow(/row-level security|violates/i);
  });

  it('6. WITH CHECK permite INSERT no próprio tenant (GUC=A gravando em A)', async () => {
    await asApp(hospitalA, (tx) =>
      tx.$executeRawUnsafe(
        `INSERT INTO paciente (nome, sexo, data_nascimento, status, hospital_id, updated_at)
         VALUES ('legitimo', 'M', '1990-01-01', 'REGISTERED', $1::uuid, now())`,
        hospitalA,
      ),
    );
    const n = await asApp(hospitalA, (tx) => countPaciente(tx));
    expect(n).toBe(3);
  });

  it('7. o DONO (migrations/seed/monitor) segue vendo tudo (sem FORCE)', async () => {
    const rows = await ctx.prisma.$queryRawUnsafe<Array<{ n: number }>>(
      'SELECT count(*)::int AS n FROM paciente',
    );
    expect(rows[0].n).toBe(3); // 2 de A + 1 de B, sem escopo
  });
});
