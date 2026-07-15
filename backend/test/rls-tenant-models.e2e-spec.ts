import { setupTestApp, TestContext } from './helpers/test-app';
import {
  createCirurgia,
  createExame,
  createHospital,
  createInternacao,
  createPaciente,
  createTipoExame,
  createVacinaAplicada,
  truncateAll,
} from './helpers/factories';

/**
 * RLS — prova ADVERSARIAL no NÍVEL DO BANCO para os 4 modelos adicionados a
 * TENANT_MODELS (Internacao, ExameSolicitado, VacinaAplicada, Cirurgia) pela
 * migration 20260716. Mesma estratégia do rls-phase1: cada asserção roda sob
 * `SET LOCAL ROLE prontuario_app` (a role não-dona que o app usa em produção)
 * com SQL cru — contorna o middleware app-layer e prova o enforcement do
 * PostgreSQL puro.
 */
describe('RLS tenant models — isolamento no banco dos 4 modelos (E2E)', () => {
  let ctx: TestContext;
  let hospitalA: string;
  let hospitalB: string;

  const TABELAS = ['internacao', 'exame_solicitado', 'vacina_aplicada', 'cirurgia'];

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
    const pacA = await createPaciente(ctx.prisma, { hospitalId: hospitalA, nome: 'A-P', cpf: '11111111111' });
    const pacB = await createPaciente(ctx.prisma, { hospitalId: hospitalB, nome: 'B-P', cpf: '22222222222' });
    const tipo = await createTipoExame(ctx.prisma);

    // 2 registros em A, 1 em B, para cada um dos 4 modelos (inseridos como DONO,
    // que bypassa RLS).
    for (let i = 0; i < 2; i++) {
      await createInternacao(ctx.prisma, { pacienteId: pacA, hospitalId: hospitalA });
      await createExame(ctx.prisma, { pacienteId: pacA, tipoExameId: tipo, hospitalId: hospitalA });
      await createVacinaAplicada(ctx.prisma, { pacienteId: pacA, hospitalId: hospitalA });
      await createCirurgia(ctx.prisma, { pacienteId: pacA, hospitalId: hospitalA });
    }
    await createInternacao(ctx.prisma, { pacienteId: pacB, hospitalId: hospitalB });
    await createExame(ctx.prisma, { pacienteId: pacB, tipoExameId: tipo, hospitalId: hospitalB });
    await createVacinaAplicada(ctx.prisma, { pacienteId: pacB, hospitalId: hospitalB });
    await createCirurgia(ctx.prisma, { pacienteId: pacB, hospitalId: hospitalB });
  });

  /** Roda `fn` sob a role do app, com GUC de tenant/superadmin conforme opts. */
  async function asApp<T>(
    opts: { hospitalId?: string | null; superadmin?: boolean },
    fn: (tx: {
      $queryRawUnsafe<R>(q: string, ...a: unknown[]): Promise<R>;
      $executeRawUnsafe(q: string, ...a: unknown[]): Promise<number>;
    }) => Promise<T>,
  ): Promise<T> {
    return ctx.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL ROLE prontuario_app');
      if (opts.hospitalId) {
        await tx.$executeRawUnsafe("SELECT set_config('app.hospital_id', $1, true)", opts.hospitalId);
      }
      if (opts.superadmin) {
        await tx.$executeRawUnsafe("SELECT set_config('app.superadmin', 'on', true)");
      }
      return fn(tx as never);
    });
  }

  const count = (
    tx: { $queryRawUnsafe<R>(q: string, ...a: unknown[]): Promise<R> },
    tabela: string,
  ) =>
    tx
      .$queryRawUnsafe<Array<{ n: number }>>(`SELECT count(*)::int AS n FROM ${tabela}`)
      .then((r) => r[0].n);

  it('GUC=A enxerga só os 2 registros de A em cada tabela', async () => {
    for (const t of TABELAS) {
      expect(await asApp({ hospitalId: hospitalA }, (tx) => count(tx, t))).toBe(2);
    }
  });

  it('GUC=B enxerga só o 1 registro de B em cada tabela', async () => {
    for (const t of TABELAS) {
      expect(await asApp({ hospitalId: hospitalB }, (tx) => count(tx, t))).toBe(1);
    }
  });

  it('fail-closed: sem GUC, nenhuma linha é visível', async () => {
    for (const t of TABELAS) {
      expect(await asApp({ hospitalId: null }, (tx) => count(tx, t))).toBe(0);
    }
  });

  it('SuperAdmin (GUC app.superadmin=on) lê todos os tenants', async () => {
    for (const t of TABELAS) {
      expect(await asApp({ superadmin: true }, (tx) => count(tx, t))).toBe(3);
    }
  });

  it('WITH CHECK bloqueia INSERT cross-tenant (GUC=A gravando em B)', async () => {
    const pacB = await ctx.prisma.paciente.findFirstOrThrow({ where: { hospitalId: hospitalB } });
    await expect(
      asApp({ hospitalId: hospitalA }, (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO cirurgia (paciente_id, descricao, status, hospital_id, created_at)
           VALUES ($1, 'intrusa', 'agendada', $2::uuid, now())`,
          pacB.id,
          hospitalB,
        ),
      ),
    ).rejects.toThrow(/row-level security|violates/i);
  });

  it('o DONO (migrations/seed) segue vendo tudo (sem FORCE)', async () => {
    for (const t of TABELAS) {
      const rows = await ctx.prisma.$queryRawUnsafe<Array<{ n: number }>>(
        `SELECT count(*)::int AS n FROM ${t}`,
      );
      expect(rows[0].n).toBe(3);
    }
  });
});
