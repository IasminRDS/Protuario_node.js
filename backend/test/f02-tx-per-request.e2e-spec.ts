import request from 'supertest';
import { setupTestApp, TestContext } from './helpers/test-app';
import {
  authorize,
  createHospital,
  createTestUser,
  signToken,
  truncateAll,
  TestUser,
} from './helpers/factories';
import { PacientesRepository } from '../src/modules/pacientes/pacientes.repository';
import { AuditoriaService } from '../src/modules/auditoria/auditoria.service';
import { gate, Trace } from './utils/concurrency-scheduler';

const API = '/api/v1';

describe('F0.2 — transaction-per-request + concorrência determinística (E2E)', () => {
  let ctx: TestContext;
  let repo: PacientesRepository;
  let auditoria: AuditoriaService;
  let admin: TestUser;
  let token: string;
  let hospitalA: string;

  beforeAll(async () => {
    ctx = await setupTestApp();
    repo = ctx.app.get(PacientesRepository);
    auditoria = ctx.app.get(AuditoriaService);
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await truncateAll(ctx.prisma);
    hospitalA = await createHospital(ctx.prisma, 'Hospital A');
    admin = await createTestUser(ctx.prisma, { hospitalId: hospitalA, perfil: 'Administrador' });
    token = signToken(admin);
  });
  afterEach(() => jest.restoreAllMocks());

  const http = () => request(ctx.app.getHttpServer());
  const dto = (cpf: string) => ({ nome: 'P', sexo: 'M', dataNascimento: '1990-05-20', cpf });
  const post = (cpf: string, tk = token) =>
    authorize(http().post(`${API}/pacientes`), tk).send(dto(cpf));

  it('I2 — cross-service tx identity: repo.create e registrarTx recebem a MESMA tx', async () => {
    const createSpy = jest.spyOn(repo, 'create');
    const auditSpy = jest.spyOn(auditoria, 'registrarTx');

    await post('52998224725').expect(201);

    const txCreate = createSpy.mock.calls[0][1]; // 2º arg = client
    const txAudit = auditSpy.mock.calls[0][0]; // 1º arg = tx
    expect(txCreate).toBeDefined();
    expect(txCreate).toBe(txAudit); // MESMA referência → mesma transação
  });

  it('I1 + I4 — 50 requests concorrentes → 50 tx DISTINTAS, 50 pacientes (sem leak)', async () => {
    const auditSpy = jest.spyOn(auditoria, 'registrarTx');
    const cpfs = Array.from({ length: 50 }, (_, i) => String(i + 1).padStart(11, '0'));

    const res = await Promise.all(cpfs.map((c) => post(c)));
    expect(res.every((r) => r.status === 201)).toBe(true);

    const criarCalls = auditSpy.mock.calls.filter((c) => (c[1] as { operacao: string }).operacao === 'CRIAR');
    const txs = criarCalls.map((c) => c[0]);
    expect(txs).toHaveLength(50);
    expect(new Set(txs).size).toBe(50); // cada request sua própria tx (I1/I4)
    expect(await ctx.prisma.paciente.count()).toBe(50);
    expect(await ctx.prisma.auditoria.count({ where: { operacao: 'CRIAR' } })).toBe(50);
  });

  // Executa o cenário de interleaving determinístico; retorna o trace + qtd final.
  async function interleavedRollback() {
    const trace = new Trace();
    const gAcreated = gate(); // força ordem: A:create acontece ANTES de B:create
    const gA = gate(); // pausa A antes do commit
    const txRefs: unknown[] = [];

    const pA = ctx.prisma.$transaction(async (tx) => {
      txRefs.push(tx);
      trace.mark('A:create');
      await tx.paciente.create({
        data: { nome: 'A', sexo: 'M', dataNascimento: new Date('1990-01-01'), cpf: 'AAA', hospitalId: hospitalA },
      });
      gAcreated.open(); // A criou → libera B
      await gA.wait(); // pausa A ANTES do commit
      trace.mark('A:commit');
    });

    const pB = ctx.prisma
      .$transaction(async (tx) => {
        await gAcreated.wait(); // só começa após A:create (ordem determinística)
        txRefs.push(tx);
        trace.mark('B:create');
        await tx.paciente.create({
          data: { nome: 'B', sexo: 'M', dataNascimento: new Date('1990-01-01'), cpf: 'BBB', hospitalId: hospitalA },
        });
        trace.mark('B:throw');
        throw new Error('B-rollback');
      })
      .catch(() => trace.mark('B:rolledback'));

    await pB; // B termina (rollback) enquanto A está pausada
    gA.open(); // libera A → commit
    await pA;

    return { trace: trace.get(), txRefs };
  }

  it('I3 + PBT-3 — interleaving: B rollback não contamina A (commit isolado)', async () => {
    const { txRefs } = await interleavedRollback();
    // A committed, B rolled back:
    expect(await ctx.prisma.paciente.count({ where: { cpf: 'AAA' } })).toBe(1);
    expect(await ctx.prisma.paciente.count({ where: { cpf: 'BBB' } })).toBe(0);
    // tx distintas (I4):
    expect(txRefs[0]).not.toBe(txRefs[1]);
  });

  it('PBT-4 — determinismo: 10 execuções → trace idêntico e DB consistente', async () => {
    const traces: string[] = [];
    for (let i = 0; i < 10; i++) {
      await truncateAll(ctx.prisma);
      hospitalA = await createHospital(ctx.prisma, 'H');
      const { trace } = await interleavedRollback();
      traces.push(JSON.stringify(trace));
      expect(await ctx.prisma.paciente.count({ where: { cpf: 'AAA' } })).toBe(1);
      expect(await ctx.prisma.paciente.count({ where: { cpf: 'BBB' } })).toBe(0);
    }
    expect(new Set(traces).size).toBe(1); // trace idêntico em todas as execuções
  });

  it('PBT-5 — race contamination: 2 tenants concorrentes não misturam hospitalId', async () => {
    const hospitalB = await createHospital(ctx.prisma, 'Hospital B');
    const userB = await createTestUser(ctx.prisma, { hospitalId: hospitalB, perfil: 'Administrador' });
    const tokenB = signToken(userB);

    await Promise.all([post('11111111111', token), post('22222222222', tokenB)]);

    const a = await ctx.prisma.paciente.findFirst({ where: { cpf: '11111111111' } });
    const b = await ctx.prisma.paciente.findFirst({ where: { cpf: '22222222222' } });
    expect(a?.hospitalId).toBe(hospitalA); // sem vazamento de tenant entre requests
    expect(b?.hospitalId).toBe(hospitalB);
  });
});
