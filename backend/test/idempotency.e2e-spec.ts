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

const API = '/api/v1';

/**
 * §1.4 no endpoint real POST /pacientes. SEM Idempotency-Key, retries concorrentes
 * idênticos produzem experiência NÃO-idempotente (1x201 + Nx409 pela unique CPF).
 * COM a chave, todas as duplicadas (concorrentes e tardias) fazem REPLAY do 201.
 */
describe('Idempotência — POST /pacientes (E2E, Postgres real)', () => {
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
    const h = await createHospital(ctx.prisma, 'Hospital A');
    admin = await createTestUser(ctx.prisma, { hospitalId: h, perfil: 'Administrador' });
    token = signToken(admin);
  });

  const http = () => request(ctx.app.getHttpServer());
  const body = { nome: 'Maria', sexo: 'M', dataNascimento: '1990-05-20', cpf: '529.982.247-25' };
  const post = (key?: string) => {
    const r = authorize(http().post(`${API}/pacientes`), token);
    return key ? r.set('Idempotency-Key', key).send(body) : r.send(body);
  };

  it('PROVA DA FALHA: sem chave, 5 requests concorrentes → 1x201 + 4x409 (não-idempotente)', async () => {
    const res = await Promise.all(Array.from({ length: 5 }, () => post()));
    const criados = res.filter((r) => r.status === 201).length;
    const conflitos = res.filter((r) => r.status === 409).length;
    expect(criados).toBe(1);
    expect(conflitos).toBe(4);
    expect(await ctx.prisma.paciente.count()).toBe(1);
  });

  it('PROVA DA CORREÇÃO: com a MESMA chave, 5 concorrentes → 5x201 idênticos, 1 paciente', async () => {
    const res = await Promise.all(Array.from({ length: 5 }, () => post('idem-key-1')));
    expect(res.every((r) => r.status === 201)).toBe(true);
    const ids = new Set(res.map((r) => r.body.data.id));
    expect(ids.size).toBe(1); // replay do MESMO resultado
    expect(await ctx.prisma.paciente.count()).toBe(1); // execução única
  });

  it('duplicada TARDIA (mesma chave, após concluir) → replay do mesmo id', async () => {
    const first = await post('idem-key-2').expect(201);
    const replay = await post('idem-key-2').expect(201);
    expect(replay.body.data.id).toBe(first.body.data.id);
    expect(await ctx.prisma.paciente.count()).toBe(1);
  });

  it('mesma chave com PAYLOAD diferente → 422 (não vaza replay)', async () => {
    await post('idem-key-3').expect(201);
    await authorize(http().post(`${API}/pacientes`), token)
      .set('Idempotency-Key', 'idem-key-3')
      .send({ ...body, nome: 'Outro', cpf: '111.444.777-35' })
      .expect(422);
  });
});
