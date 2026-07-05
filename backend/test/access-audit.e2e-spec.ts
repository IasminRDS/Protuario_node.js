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

// A auditoria é gravada de forma assíncrona (tap pós-resposta). Poll curto para
// evitar flakiness sem mascarar ausência real de trilha.
async function waitForAudit(
  prisma: TestContext['prisma'],
  where: Record<string, unknown>,
  tries = 20,
): Promise<number> {
  for (let i = 0; i < tries; i++) {
    const n = await prisma.auditoria.count({ where });
    if (n > 0) return n;
    await new Promise((r) => setTimeout(r, 25));
  }
  return 0;
}

describe('Auditoria de não-repúdio — acesso a PHI + super-admin (E2E)', () => {
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

  it('leitura de paciente por :id gera trilha ACCESS (entity+entityId+ip)', async () => {
    const hA = await createHospital(ctx.prisma, 'Hospital A');
    const admin = await createTestUser(ctx.prisma, { hospitalId: hA, perfil: 'Administrador' });
    const idA = await createPaciente(ctx.prisma, { hospitalId: hA, nome: 'Maria', cpf: '52998224725' });

    await authorize(http().get(`${API}/pacientes/${idA}`), signToken(admin)).expect(200);

    const n = await waitForAudit(ctx.prisma, { modulo: 'ACCESS', entity: 'pacientes', entityId: idA });
    expect(n).toBeGreaterThan(0);
    const row = await ctx.prisma.auditoria.findFirst({
      where: { modulo: 'ACCESS', entityId: idA },
      orderBy: { id: 'desc' },
    });
    expect(row?.hospitalId).toBe(hA); // escopo de tenant capturado
    expect(row?.operacao).toContain('GET');
  });

  it('listagem genérica NÃO gera trilha ACCESS (sem ruído)', async () => {
    const hA = await createHospital(ctx.prisma, 'Hospital A');
    const admin = await createTestUser(ctx.prisma, { hospitalId: hA, perfil: 'Administrador' });
    await authorize(http().get(`${API}/pacientes`), signToken(admin)).expect(200);

    // pequena espera para garantir que nada foi gravado
    await new Promise((r) => setTimeout(r, 150));
    const n = await ctx.prisma.auditoria.count({ where: { modulo: 'ACCESS' } });
    expect(n).toBe(0);
  });

  it('ação de super-admin cross-tenant é 100% auditada (modulo SUPERADMIN)', async () => {
    const hA = await createHospital(ctx.prisma, 'Hospital A');
    const idA = await createPaciente(ctx.prisma, { hospitalId: hA, nome: 'Secreto', cpf: '11111111111' });
    const sa = await createTestUser(ctx.prisma, { hospitalId: null, perfil: 'SuperAdmin' });

    await authorize(http().get(`${API}/pacientes/${idA}`), signToken(sa)).expect(200);

    const n = await waitForAudit(ctx.prisma, { modulo: 'SUPERADMIN', entityId: idA });
    expect(n).toBeGreaterThan(0);
  });
});
