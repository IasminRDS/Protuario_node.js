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

const API = '/api/v1';
const dbg = (label: string, meta: Record<string, unknown>) =>
  // Log de debug (item 9): hospital + intenção da query.
  // eslint-disable-next-line no-console
  console.log(`[e2e] ${label}`, JSON.stringify(meta));

describe('Multi-tenant isolation (E2E, Postgres real)', () => {
  let ctx: TestContext;
  let hospitalA: string;
  let hospitalB: string;
  let adminA: TestUser;
  let adminB: TestUser;
  let tokenA: string;
  let tokenB: string;

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
    adminA = await createTestUser(ctx.prisma, { hospitalId: hospitalA });
    adminB = await createTestUser(ctx.prisma, { hospitalId: hospitalB });
    tokenA = signToken(adminA);
    tokenB = signToken(adminB);
  });

  const http = () => request(ctx.app.getHttpServer());

  // 1. Isolamento básico
  it('1. hospital A não enxerga pacientes do hospital B', async () => {
    await createPaciente(ctx.prisma, { hospitalId: hospitalA, nome: 'A-Maria', cpf: '11111111111' });
    await createPaciente(ctx.prisma, { hospitalId: hospitalA, nome: 'A-Joao', cpf: '22222222222' });
    await createPaciente(ctx.prisma, { hospitalId: hospitalB, nome: 'B-Ana', cpf: '33333333333' });

    const rA = await authorize(http().get(`${API}/pacientes`), tokenA).expect(200);
    const rB = await authorize(http().get(`${API}/pacientes`), tokenB).expect(200);
    dbg('list', { hospitalA, totalA: rA.body.data.meta.total, totalB: rB.body.data.meta.total });

    expect(rA.body.data.items).toHaveLength(2);
    expect(rA.body.data.items.every((p: { nome: string }) => p.nome.startsWith('A-'))).toBe(true);
    expect(rB.body.data.items).toHaveLength(1);
    expect(rB.body.data.items[0].nome).toBe('B-Ana');
  });

  // 2. Bypass malicioso: acessar por ID um paciente de outro hospital
  it('2. GET /pacientes/:id de outro hospital retorna 404 (não vaza)', async () => {
    const idB = await createPaciente(ctx.prisma, { hospitalId: hospitalB, nome: 'B-Secreto', cpf: '44444444444' });
    dbg('bypass', { asHospital: hospitalA, tryingId: idB });
    await authorize(http().get(`${API}/pacientes/${idB}`), tokenA).expect(404);
    // e o dono acessa normalmente
    await authorize(http().get(`${API}/pacientes/${idB}`), tokenB).expect(200);
  });

  // 3. Update isolado
  it('3. PATCH /pacientes/:id de outro hospital retorna 404', async () => {
    const idB = await createPaciente(ctx.prisma, { hospitalId: hospitalB, nome: 'B-Alvo', cpf: '55555555555' });
    await authorize(http().patch(`${API}/pacientes/${idB}`), tokenA)
      .send({ telefone: '11999999999' })
      .expect(404);
    // não foi alterado
    const row = await ctx.prisma.paciente.findUnique({ where: { id: BigInt(idB) } });
    expect(row?.telefone).toBeNull();
  });

  // 4. Delete isolado
  it('4. DELETE /pacientes/:id de outro hospital retorna 404 (não apaga)', async () => {
    const idB = await createPaciente(ctx.prisma, { hospitalId: hospitalB, nome: 'B-NaoApagar', cpf: '66666666666' });
    await authorize(http().delete(`${API}/pacientes/${idB}`), tokenA).expect(404);
    const row = await ctx.prisma.paciente.findUnique({ where: { id: BigInt(idB) } });
    expect(row?.deletedAt).toBeNull();
  });

  // 5. Create já com escopo correto
  it('5. POST /pacientes grava com hospitalId do usuário autenticado', async () => {
    const res = await authorize(http().post(`${API}/pacientes`), tokenA)
      .send({ nome: 'A-Novo', dataNascimento: '1990-05-20', sexo: 'M', cpf: '529.982.247-25' })
      .expect(201);
    const id = res.body.data.id;
    const row = await ctx.prisma.paciente.findUnique({ where: { id: BigInt(id) } });
    dbg('create', { hospitalA, savedHospital: row?.hospitalId });
    expect(row?.hospitalId).toBe(hospitalA);
  });

  // 6. count/aggregate respeitam tenant
  it('6. meta.total (count) é escopado por hospital', async () => {
    await createPaciente(ctx.prisma, { hospitalId: hospitalA, nome: 'A-1', cpf: '77777777777' });
    await createPaciente(ctx.prisma, { hospitalId: hospitalA, nome: 'A-2', cpf: '88888888888' });
    await createPaciente(ctx.prisma, { hospitalId: hospitalB, nome: 'B-1', cpf: '99999999999' });
    const rA = await authorize(http().get(`${API}/pacientes`), tokenA).expect(200);
    expect(rA.body.data.meta.total).toBe(2);
  });

  // 7. Ausência de hospitalId → 403
  it('7. usuário SEM hospitalId recebe 403 em rota clínica', async () => {
    const noTenant = await createTestUser(ctx.prisma, { hospitalId: null });
    const token = signToken(noTenant);
    await createPaciente(ctx.prisma, { hospitalId: hospitalA, nome: 'A-x', cpf: '10101010101' });
    dbg('no-tenant', { hospitalId: null });
    await authorize(http().get(`${API}/pacientes`), token).expect(403);
  });

  // 8. hospitalId desconhecido → isolamento (vazio), não vaza
  it('8. usuário de hospital sem dados vê lista vazia (isolamento, não 403)', async () => {
    const solitary = await createTestUser(ctx.prisma, {
      hospitalId: await createHospital(ctx.prisma, 'Hospital Vazio'),
    });
    const token = signToken(solitary);
    await createPaciente(ctx.prisma, { hospitalId: hospitalA, nome: 'A-y', cpf: '12121212121' });
    const r = await authorize(http().get(`${API}/pacientes`), token).expect(200);
    expect(r.body.data.items).toHaveLength(0);
  });

  // 9. CONCORRÊNCIA: A e B em paralelo, sem vazamento de contexto (ALS)
  it('9. requisições paralelas de A e B não vazam contexto entre si', async () => {
    for (let i = 0; i < 3; i++) {
      await createPaciente(ctx.prisma, { hospitalId: hospitalA, nome: `A-${i}`, cpf: `2000000000${i}` });
    }
    for (let i = 0; i < 2; i++) {
      await createPaciente(ctx.prisma, { hospitalId: hospitalB, nome: `B-${i}`, cpf: `3000000000${i}` });
    }

    const reqA = () => authorize(http().get(`${API}/pacientes`), tokenA);
    const reqB = () => authorize(http().get(`${API}/pacientes`), tokenB);

    // 12 requisições intercaladas em paralelo (estressa o AsyncLocalStorage).
    const results = await Promise.all([
      reqA(), reqB(), reqA(), reqB(), reqA(), reqB(),
      reqB(), reqA(), reqB(), reqA(), reqB(), reqA(),
    ]);

    results.forEach((res) => {
      const items = res.body.data.items as { nome: string }[];
      expect(items.length).toBeGreaterThan(0);
      const allA = items.every((p) => p.nome.startsWith('A-'));
      const allB = items.every((p) => p.nome.startsWith('B-'));
      // Cada resposta é HOMOGÊNEA (só de um hospital) — nunca mistura contextos.
      expect(allA || allB).toBe(true);
      if (allA) expect(items).toHaveLength(3);
      if (allB) expect(items).toHaveLength(2);
    });
  });

  // 10. FHIR respeita o isolamento
  it('10. GET /fhir/Patient/:id isola por hospital (raw resource)', async () => {
    const idA = await createPaciente(ctx.prisma, { hospitalId: hospitalA, nome: 'A-Fhir', cpf: '13131313131' });
    const idB = await createPaciente(ctx.prisma, { hospitalId: hospitalB, nome: 'B-Fhir', cpf: '14141414141' });

    const ok = await authorize(http().get(`${API}/fhir/Patient/${idA}`), tokenA).expect(200);
    expect(ok.body.resourceType).toBe('Patient'); // resposta CRUA (sem envelope)
    expect(ok.body.id).toBe(idA);

    // paciente de B não é acessível para A
    await authorize(http().get(`${API}/fhir/Patient/${idB}`), tokenA).expect(404);
  });
});
