import request from 'supertest';
import { setupTestApp, TestContext } from './helpers/test-app';
import {
  authorize,
  createCirurgia,
  createExame,
  createHospital,
  createInternacao,
  createPaciente,
  createTestUser,
  createTipoExame,
  createVacinaAplicada,
  signToken,
  truncateAll,
  TestUser,
} from './helpers/factories';

const API = '/api/v1';

/**
 * Regressão do vazamento de PHI cross-tenant (fix c8feab0). Os modelos
 * Internacao/ExameSolicitado/VacinaAplicada/Cirurgia ficam FORA de TENANT_MODELS
 * e sem policy RLS; o isolamento deles depende do guard de posse do paciente
 * (assertPacienteVisivel) nos endpoints que os leem. Estes testes provam que:
 *   - Hospital A NÃO lê esses dados de um paciente do Hospital B (404);
 *   - o dono (Hospital B) lê normalmente (200 + timeline populada).
 * Se alguém remover o guard, ou adicionar um novo endpoint que leia esses
 * modelos sem checar posse, um destes testes quebra.
 */
describe('Tenant defense-in-depth — modelos fora de RLS (E2E)', () => {
  let ctx: TestContext;
  let hospitalA: string;
  let hospitalB: string;
  let adminA: TestUser;
  let adminB: TestUser;
  let tokenA: string;
  let tokenB: string;
  let pacienteB: string;
  let exameB: string;
  let vacinaB: string;

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

    // Paciente do Hospital B com prontuário clínico completo nos 4 modelos.
    pacienteB = await createPaciente(ctx.prisma, {
      hospitalId: hospitalB,
      nome: 'B-Paciente',
      cpf: '52998224725',
    });
    const tipoExame = await createTipoExame(ctx.prisma);
    await createInternacao(ctx.prisma, { pacienteId: pacienteB, hospitalId: hospitalB });
    exameB = await createExame(ctx.prisma, {
      pacienteId: pacienteB,
      tipoExameId: tipoExame,
      hospitalId: hospitalB,
    });
    vacinaB = await createVacinaAplicada(ctx.prisma, { pacienteId: pacienteB });
    await createCirurgia(ctx.prisma, { pacienteId: pacienteB, hospitalId: hospitalB });
  });

  const http = () => request(ctx.app.getHttpServer());

  it('timeline: Hospital A recebe 404 no prontuário de paciente do Hospital B', async () => {
    await authorize(http().get(`${API}/prontuarios/${pacienteB}`), tokenA).expect(404);
  });

  it('acessos: Hospital A recebe 404 na trilha de acessos de paciente do Hospital B', async () => {
    await authorize(http().get(`${API}/prontuarios/${pacienteB}/acessos`), tokenA).expect(404);
  });

  it('RNDS preview (exame): Hospital A recebe 404 no resultado de exame do Hospital B', async () => {
    await authorize(
      http().get(`${API}/rnds/preview/RESULTADO_EXAME/${exameB}`),
      tokenA,
    ).expect(404);
  });

  it('RNDS preview (vacina): Hospital A recebe 404 na imunização do Hospital B', async () => {
    await authorize(http().get(`${API}/rnds/preview/RIA/${vacinaB}`), tokenA).expect(404);
  });

  it('dono (Hospital B) lê a timeline com internação, exame, vacina e cirurgia', async () => {
    const res = await authorize(http().get(`${API}/prontuarios/${pacienteB}`), tokenB).expect(200);
    const tipos = (res.body.data.timeline as { tipo: string }[]).map((t) => t.tipo);
    expect(tipos).toEqual(
      expect.arrayContaining(['INTERNACAO', 'EXAME', 'VACINA', 'CIRURGIA']),
    );
  });

  it('dono (Hospital B) lê o preview FHIR do próprio exame', async () => {
    const res = await authorize(
      http().get(`${API}/rnds/preview/RESULTADO_EXAME/${exameB}`),
      tokenB,
    ).expect(200);
    expect(res.body.data.resourceType).toBe('DiagnosticReport');
  });
});
