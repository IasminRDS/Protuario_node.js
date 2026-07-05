import request from 'supertest';
import { setupTestApp, TestContext } from './helpers/test-app';
import {
  authorize,
  createHospital,
  createPaciente,
  createTestUser,
  signToken,
  truncateAll,
} from './helpers/factories';

const API = '/api/v1';

/**
 * Contraparte do isolamento: o SUPER_ADMIN (cross-tenant, sem hospitalId) DEVE
 * enxergar todos os hospitais — sem ser bloqueado por TenantContextError. Este
 * é o bypass seguro implementado no tenant-guard (ctx.bypassTenant).
 */
describe('Super admin cross-tenant (E2E, Postgres real)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestApp();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await truncateAll(ctx.prisma);
  });

  const http = () => request(ctx.app.getHttpServer());

  it('SUPER_ADMIN sem hospitalId enxerga pacientes de TODOS os hospitais', async () => {
    const hospitalA = await createHospital(ctx.prisma, 'Hospital A');
    const hospitalB = await createHospital(ctx.prisma, 'Hospital B');
    await createPaciente(ctx.prisma, { hospitalId: hospitalA, nome: 'A-Maria', cpf: '11111111111' });
    await createPaciente(ctx.prisma, { hospitalId: hospitalB, nome: 'B-Ana', cpf: '22222222222' });

    const superAdmin = await createTestUser(ctx.prisma, {
      hospitalId: null,
      perfil: 'SuperAdmin',
    });
    const token = signToken(superAdmin);

    const res = await authorize(http().get(`${API}/pacientes`), token).expect(200);
    const nomes = res.body.data.items.map((p: { nome: string }) => p.nome).sort();
    expect(nomes).toEqual(['A-Maria', 'B-Ana']); // vê os dois tenants
  });

  it('SUPER_ADMIN acessa por ID um paciente de qualquer hospital (200)', async () => {
    const hospitalB = await createHospital(ctx.prisma, 'Hospital B');
    const idB = await createPaciente(ctx.prisma, { hospitalId: hospitalB, nome: 'B-Secreto', cpf: '33333333333' });

    const superAdmin = await createTestUser(ctx.prisma, { hospitalId: null, perfil: 'SuperAdmin' });
    const token = signToken(superAdmin);

    await authorize(http().get(`${API}/pacientes/${idB}`), token).expect(200);
  });

  it('contraste: Administrador (não-super) SEM hospitalId continua 403', async () => {
    const hospitalA = await createHospital(ctx.prisma, 'Hospital A');
    await createPaciente(ctx.prisma, { hospitalId: hospitalA, nome: 'A-x', cpf: '44444444444' });

    const admin = await createTestUser(ctx.prisma, { hospitalId: null, perfil: 'Administrador' });
    const token = signToken(admin);

    await authorize(http().get(`${API}/pacientes`), token).expect(403);
  });
});
