import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { setupTestApp, TestContext } from './helpers/test-app';
import {
  authorize,
  createHospital,
  createTestUser,
  signToken,
  truncateAll,
} from './helpers/factories';

const API = '/api/v1';

/**
 * Blind index de CPF/CNS: o CPF fica CIFRADO em repouso e a busca/unicidade
 * usa um HMAC (cpf_bi). Prova que:
 *  - o cpf no banco é ciphertext e o cpf_bi é HMAC (64 hex) — cliente bare;
 *  - a busca por CPF (filtro da lista) ainda funciona;
 *  - o dedup RN-007 barra CPF duplicado no MESMO hospital;
 *  - o MESMO CPF é aceito em hospitais diferentes (bi ligado ao tenant).
 */
describe('Blind index de CPF (E2E, Postgres real)', () => {
  let ctx: TestContext;
  let bare: PrismaClient;
  let hospitalA: string;
  let hospitalB: string;
  let tokenA: string;
  let tokenB: string;
  const CPF = '529.982.247-25';
  const KEY_BACKUP = process.env.FIELD_ENCRYPTION_KEY;

  beforeAll(async () => {
    process.env.FIELD_ENCRYPTION_KEY = 'a'.repeat(64); // cifra o cpf
    ctx = await setupTestApp();
    bare = new PrismaClient({ datasources: { db: { url: ctx.container.getConnectionUri() } } });
    await bare.$connect();
  });

  afterAll(async () => {
    await bare.$disconnect();
    await ctx.close();
    if (KEY_BACKUP === undefined) delete process.env.FIELD_ENCRYPTION_KEY;
    else process.env.FIELD_ENCRYPTION_KEY = KEY_BACKUP;
  });

  beforeEach(async () => {
    await truncateAll(ctx.prisma);
    hospitalA = await createHospital(ctx.prisma, 'Hospital A');
    hospitalB = await createHospital(ctx.prisma, 'Hospital B');
    tokenA = signToken(await createTestUser(ctx.prisma, { hospitalId: hospitalA }));
    tokenB = signToken(await createTestUser(ctx.prisma, { hospitalId: hospitalB }));
  });

  const http = () => request(ctx.app.getHttpServer());
  const criar = (token: string, cpf: string) =>
    authorize(http().post(`${API}/pacientes`), token).send({
      nome: 'Paciente CPF',
      dataNascimento: '1990-05-20',
      sexo: 'M',
      cpf,
    });

  it('grava cpf CIFRADO e cpf_bi como HMAC (64 hex) no banco', async () => {
    const res = await criar(tokenA, CPF).expect(201);
    const id = BigInt(res.body.data.id);
    const raw = await bare.$queryRawUnsafe<Array<{ cpf: string; cpf_bi: string }>>(
      'SELECT cpf, cpf_bi FROM paciente WHERE id = $1',
      id,
    );
    expect(raw[0].cpf.startsWith('enc:v')).toBe(true); // cifrado
    expect(raw[0].cpf).not.toContain('52998224725');
    expect(/^[0-9a-f]{64}$/.test(raw[0].cpf_bi)).toBe(true); // HMAC hex
  });

  it('busca por CPF (filtro da lista) ainda funciona', async () => {
    await criar(tokenA, CPF).expect(201);
    const r = await authorize(http().get(`${API}/pacientes?cpf=${encodeURIComponent(CPF)}`), tokenA).expect(200);
    expect(r.body.data.items).toHaveLength(1);
    expect(r.body.data.items[0].cpf).toBe('52998224725'); // decifrado na leitura
  });

  it('dedup RN-007: CPF duplicado no MESMO hospital → 409', async () => {
    await criar(tokenA, CPF).expect(201);
    await criar(tokenA, CPF).expect(409);
  });

  it('MESMO CPF é aceito em hospitais diferentes (bi ligado ao tenant)', async () => {
    await criar(tokenA, CPF).expect(201);
    await criar(tokenB, CPF).expect(201); // tenant B → bi diferente → sem colisão
  });
});
