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
import { AuditoriaService } from '../src/modules/auditoria/auditoria.service';

const API = '/api/v1';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function waitAudit(prisma: TestContext['prisma'], where: Record<string, unknown>, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const row = await prisma.auditoria.findFirst({ where, orderBy: { id: 'desc' } });
    if (row) return row;
    await new Promise((r) => setTimeout(r, 25));
  }
  return null;
}

/**
 * C6: a identidade do evento de auditoria (`event_id`) é gerada 100% no servidor,
 * é única e imprevisível, e NUNCA vem do cliente (traceId/header/body).
 */
describe('C6 — event_id server-side (E2E, Postgres real)', () => {
  let ctx: TestContext;
  let audit: AuditoriaService;
  beforeAll(async () => {
    ctx = await setupTestApp();
    audit = ctx.app.get(AuditoriaService);
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await truncateAll(ctx.prisma);
  });

  const http = () => request(ctx.app.getHttpServer());

  it('TESTE 1 — cliente NÃO controla o event_id (header/body malicioso ignorado)', async () => {
    const hA = await createHospital(ctx.prisma, 'Hospital A');
    const id = await createPaciente(ctx.prisma, { hospitalId: hA, nome: 'Maria', cpf: '52998224725' });
    const sa = await createTestUser(ctx.prisma, { hospitalId: null, perfil: 'SuperAdmin' });

    await authorize(http().get(`${API}/pacientes/${id}`), signToken(sa))
      .set('x-event-id', 'malicioso-cliente')
      .set('x-trace-id', 'trace-fixo-do-cliente')
      .expect(200);

    const row = await waitAudit(ctx.prisma, { modulo: 'SUPERADMIN', entityId: id });
    expect(row).not.toBeNull();
    expect(row!.eventId).toMatch(UUID_V4);          // uuid do servidor
    expect(row!.eventId).not.toBe('malicioso-cliente');
    expect(row!.objeto).toBe('trace-fixo-do-cliente'); // traceId (cliente controla ISSO, não a identidade)
  });

  it('TESTE 2 — unicidade sob concorrência (10 eventos → 10 event_id distintos)', async () => {
    const ids = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        audit.registrar({ modulo: 'TEST', operacao: `OP_${i}`, resultado: 'OK' }),
      ),
    );
    expect(ids.every((x) => x && UUID_V4.test(x))).toBe(true);
    expect(new Set(ids).size).toBe(10); // todos únicos
    const rows = await ctx.prisma.auditoria.findMany({ where: { modulo: 'TEST' } });
    expect(new Set(rows.map((r) => r.eventId)).size).toBe(10);
  });

  it('TESTE 3 — integridade: event_id presente, não-nulo e UUID válido', async () => {
    const eventId = await audit.registrar({ modulo: 'TEST', operacao: 'INTEGRIDADE', resultado: 'OK' });
    expect(eventId).toMatch(UUID_V4);
    const row = await ctx.prisma.auditoria.findFirst({ where: { operacao: 'INTEGRIDADE' } });
    expect(row?.eventId).toBeTruthy();
    expect(row?.eventId).toMatch(UUID_V4);
  });

  it('PROVA ANTES→DEPOIS: mesmo traceId do cliente colide no objeto, mas NÃO no event_id', async () => {
    const a = await audit.registrar({ modulo: 'TEST', operacao: 'A', objeto: 'MESMO-TRACE-CLIENTE' });
    const b = await audit.registrar({ modulo: 'TEST', operacao: 'B', objeto: 'MESMO-TRACE-CLIENTE' });
    const rows = await ctx.prisma.auditoria.findMany({ where: { objeto: 'MESMO-TRACE-CLIENTE' } });
    expect(rows).toHaveLength(2);
    // ANTES (identidade = traceId do cliente): colidiria → dedup manipulável.
    expect(rows[0].objeto).toBe(rows[1].objeto);
    // DEPOIS (identidade = event_id do servidor): distintos → não manipulável.
    expect(a).not.toBe(b);
    expect(rows[0].eventId).not.toBe(rows[1].eventId);
  });
});
