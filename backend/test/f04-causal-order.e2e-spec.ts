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
import { AuditoriaService } from '../src/modules/auditoria/auditoria.service';

const API = '/api/v1';

/**
 * F0.4 (Peça 1) — tempo causal POR AGREGADO. Propriedade:
 *   ∀ agregado A: seq é total, monotônico e gapless entre eventos de A
 *   (∃ ordem serial reconstruível), e agregados distintos são independentes.
 */
describe('F0.4 — causal ordering por agregado (E2E, Postgres real)', () => {
  let ctx: TestContext;
  let admin: TestUser;
  let token: string;

  beforeAll(async () => {
    ctx = await setupTestApp();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await truncateAll(ctx.prisma);
    await ctx.prisma.$executeRawUnsafe('TRUNCATE TABLE audit_aggregate_sequence');
    const h = await createHospital(ctx.prisma, 'Hospital A');
    admin = await createTestUser(ctx.prisma, { hospitalId: h, perfil: 'Administrador' });
    token = signToken(admin);
  });

  const http = () => request(ctx.app.getHttpServer());
  const seqsOf = async (id: string): Promise<bigint[]> => {
    const rows = await ctx.prisma.auditoria.findMany({
      where: { entity: 'paciente', entityId: id },
      select: { operacao: true, aggregateSeq: true },
    });
    return rows
      .map((r) => r.aggregateSeq as bigint)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  };

  it('CRIAR é seq=1; N updates concorrentes → seqs {1..N+1} (total, monotônico, gapless)', async () => {
    const create = await authorize(http().post(`${API}/pacientes`), token)
      .send({ nome: 'Maria', sexo: 'M', dataNascimento: '1990-05-20', cpf: '52998224725' })
      .expect(201);
    const id = create.body.data.id as string;

    // 5 updates CONCORRENTES no MESMO agregado
    const N = 5;
    const res = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        authorize(http().patch(`${API}/pacientes/${id}`), token).send({ telefone: `1199999${i}000` }),
      ),
    );
    expect(res.every((r) => r.status === 200)).toBe(true);

    const seqs = await seqsOf(id);
    const esperado = Array.from({ length: N + 1 }, (_, i) => BigInt(i + 1)); // [1..6]
    expect(seqs).toEqual(esperado); // distinto, contíguo, começa em 1 → ordem total existe

    // CRIAR ocupa a primeira posição do agregado
    const criar = await ctx.prisma.auditoria.findFirst({
      where: { entity: 'paciente', entityId: id, operacao: 'CRIAR' },
    });
    expect(criar?.aggregateSeq).toBe(1n);
  });

  it('agregados distintos têm sequências INDEPENDENTES (cada um começa em 1)', async () => {
    const p1 = await authorize(http().post(`${API}/pacientes`), token)
      .send({ nome: 'A', sexo: 'M', dataNascimento: '1990-01-01', cpf: '11144477735' })
      .expect(201);
    const p2 = await authorize(http().post(`${API}/pacientes`), token)
      .send({ nome: 'B', sexo: 'F', dataNascimento: '1985-01-01', cpf: '39053344705' })
      .expect(201);

    const [s1] = await seqsOf(p1.body.data.id);
    const [s2] = await seqsOf(p2.body.data.id);
    expect(s1).toBe(1n);
    expect(s2).toBe(1n); // independência: o seq de p2 não continua o de p1
  });

  it('gaplessness sob rollback: seq consumido numa tx revertida é REUSADO (sem buraco)', async () => {
    const audit = ctx.app.get(AuditoriaService);
    const create = await authorize(http().post(`${API}/pacientes`), token)
      .send({ nome: 'Rollback', sexo: 'M', dataNascimento: '1990-01-01', cpf: '20817678900' })
      .expect(201);
    const id = create.body.data.id as string; // CRIAR já ocupou seq=1

    // Tx que incrementa o seq do agregado (obteria 2) e ROLLBACK.
    await expect(
      ctx.prisma.$transaction(async (tx) => {
        await audit.registrarTx(tx, {
          modulo: 'PACIENTES', operacao: 'ATUALIZAR', entity: 'paciente', entityId: id, resultado: 'SUCESSO',
        });
        throw new Error('boom'); // reverte o incremento
      }),
    ).rejects.toThrow('boom');

    // Tx committada seguinte para o MESMO agregado: deve REUSAR seq=2 (não 3).
    await ctx.prisma.$transaction(async (tx) => {
      await audit.registrarTx(tx, {
        modulo: 'PACIENTES', operacao: 'ATUALIZAR', entity: 'paciente', entityId: id, resultado: 'SUCESSO',
      });
    });

    const seqs = await seqsOf(id);
    expect(seqs).toEqual([1n, 2n]); // o incremento revertido NÃO deixou buraco (não é [1,3])
  });
});
