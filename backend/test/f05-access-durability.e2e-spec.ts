import request from 'supertest';
import { setupTestApp, TestContext } from './helpers/test-app';
import {
  authorize,
  createHospital,
  createPaciente,
  createTestUser,
  signToken,
  truncateAll,
  TestUser,
} from './helpers/factories';
import { AuditoriaService } from '../src/modules/auditoria/auditoria.service';

const API = '/api/v1';

/**
 * F0.5 — AUDIT_ACCESS_SUCCESS durável (I-G8). Sem fire-and-forget: o audit de
 * acesso é AWAITED antes da resposta (SOD em mutação; this.prisma em read).
 */
describe('F0.5 — access durability (E2E, Postgres real)', () => {
  let ctx: TestContext;
  let admin: TestUser;
  let token: string;
  let hospitalA: string;

  const accessCount = (extra: Record<string, unknown> = {}) =>
    ctx.prisma.auditoria.count({ where: { modulo: 'ACCESS', resultado: 'OK', ...extra } });

  beforeAll(async () => {
    ctx = await setupTestApp();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await truncateAll(ctx.prisma);
    await ctx.prisma.$executeRawUnsafe('TRUNCATE TABLE audit_aggregate_sequence');
    hospitalA = await createHospital(ctx.prisma, 'Hospital A');
    admin = await createTestUser(ctx.prisma, { hospitalId: hospitalA, perfil: 'Administrador' });
    token = signToken(admin);
  });

  const http = () => request(ctx.app.getHttpServer());

  it('TESTE 2 — bijeção: N leituras sensíveis → N AUDIT_ACCESS_SUCCESS', async () => {
    const id = await createPaciente(ctx.prisma, { hospitalId: hospitalA, nome: 'Maria', cpf: '52998224725' });
    const N = 5;
    for (let i = 0; i < N; i++) {
      await authorize(http().get(`${API}/pacientes/${id}`), token).expect(200);
    }
    expect(await accessCount({ entityId: id })).toBe(N);
  });

  it('DURABILIDADE SÍNCRONA: após a resposta, o AUDIT_ACCESS já existe (sem poll)', async () => {
    const id = await createPaciente(ctx.prisma, { hospitalId: hospitalA, nome: 'Ana', cpf: '11144477735' });
    await authorize(http().get(`${API}/pacientes/${id}`), token).expect(200);
    // Sem waitFor: se fosse fire-and-forget, poderia ser 0 aqui.
    expect(await accessCount({ entityId: id })).toBe(1);
  });

  it('TESTE 1 — SOD: se a mutação faz rollback, NÃO há AUDIT_ACCESS_SUCCESS "OK" (mas há denial)', async () => {
    const audit = ctx.app.get(AuditoriaService);
    jest.spyOn(audit, 'registrarTx').mockRejectedValueOnce(new Error('audit down'));

    await authorize(http().post(`${API}/pacientes`), token)
      .send({ nome: 'X', sexo: 'M', dataNascimento: '1990-05-20', cpf: '39053344705' })
      .expect((r) => expect(r.status).toBeGreaterThanOrEqual(400)); // mutação falhou

    expect(await ctx.prisma.paciente.count()).toBe(0); // mutação revertida
    expect(await accessCount()).toBe(0); // acesso "OK" NÃO persistiu (SOD)
    // denial (EOD autônomo) sobrevive:
    const denial = await ctx.prisma.auditoria.count({
      where: { modulo: 'ACCESS', resultado: { startsWith: 'ERRO' } },
    });
    expect(denial).toBeGreaterThanOrEqual(1);
    jest.restoreAllMocks();
  });

  it('TESTE 3 — AUDIT_ACCESS_SUCCESS ∉ COD: não vira membro da sequência causal', async () => {
    const create = await authorize(http().post(`${API}/pacientes`), token)
      .send({ nome: 'Y', sexo: 'F', dataNascimento: '1985-01-01', cpf: '20817678900' })
      .expect(201);
    const id = create.body.data.id as string; // CRIAR → COD seq=1

    await authorize(http().get(`${API}/pacientes/${id}`), token).expect(200); // ACCESS 'OK'

    // COD = eventos de SUCESSO do domínio (entity='paciente') → só {1} (CRIAR).
    const codSeqs = (
      await ctx.prisma.auditoria.findMany({
        where: { entity: 'paciente', resultado: 'SUCESSO' },
        select: { aggregateSeq: true },
      })
    ).map((r) => Number(r.aggregateSeq));
    expect(codSeqs.sort()).toEqual([1]); // o GET NÃO adicionou membro ao COD

    // O access row (entity='pacientes', resultado='OK') existe.
    const access = await ctx.prisma.auditoria.findFirst({
      where: { modulo: 'ACCESS', resultado: 'OK', entityId: id },
    });
    expect(access).not.toBeNull();
    expect(access?.entity).toBe('pacientes'); // recurso (plural), não agregado de domínio
    // D3 (em aberto): chave 'pacientes:id' ≠ 'paciente:id' → correlação null hoje.
    // Normalizar D3 faria este seq referenciar o COD do domínio.
    expect(access?.aggregateSeq).toBeNull();
  });
});
