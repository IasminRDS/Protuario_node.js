import { randomUUID } from 'crypto';
import { setupTestApp, TestContext } from './helpers/test-app';
import { createHospital, truncateAll } from './helpers/factories';
import { AuditoriaService } from '../src/modules/auditoria/auditoria.service';
import { AuditPrismaService } from '../src/modules/auditoria/audit-prisma.service';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * F0.3: auditoria por conexão AUTÔNOMA sobrevive ao rollback da transação
 * principal. Prova adversarial contra perda de evento de negação/erro.
 */
describe('F0.3 — canal de auditoria autônomo (E2E, Postgres real)', () => {
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

  it('PROVA DA FALHA: auditoria DENTRO da tx é REMOVIDA pelo rollback', async () => {
    await expect(
      ctx.prisma.$transaction(async (tx) => {
        await tx.auditoria.create({
          data: { eventId: randomUUID(), modulo: 'TEST', operacao: 'INTX', resultado: 'ERRO' },
        });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await ctx.prisma.auditoria.count({ where: { operacao: 'INTX' } })).toBe(0);
  });

  it('TESTE 1 — autônoma SOBREVIVE ao rollback: dado principal some, auditoria fica', async () => {
    const hA = await createHospital(ctx.prisma, 'Hospital A');
    let msg = '';
    try {
      await ctx.prisma.$transaction(async (tx) => {
        await tx.paciente.create({
          data: { nome: 'Rollback', sexo: 'M', dataNascimento: new Date('1990-01-01'), hospitalId: hA },
        });
        throw new Error('falha-clinica');
      });
    } catch (e) {
      msg = (e as Error).message;
      await audit.registrarAutonomo({ modulo: 'CLINICO', operacao: 'ERRO', reason: msg });
    }

    expect(await ctx.prisma.paciente.count()).toBe(0); // principal revertido
    const row = await ctx.prisma.auditoria.findFirst({ where: { modulo: 'CLINICO', operacao: 'ERRO' } });
    expect(row).not.toBeNull(); // auditoria PERMANECE
    expect(row!.reason).toBe('falha-clinica');
    expect(row!.eventId).toMatch(UUID_V4);
  });

  it('TESTE 2 — concorrência: 5 falhas simultâneas → 5 auditorias, nenhuma perdida', async () => {
    const ids = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        audit.registrarAutonomo({ modulo: 'CONC', operacao: `ERRO_${i}`, resultado: 'ERRO' }),
      ),
    );
    expect(ids.every((x) => x && UUID_V4.test(x))).toBe(true);
    expect(new Set(ids).size).toBe(5);
    expect(await ctx.prisma.auditoria.count({ where: { modulo: 'CONC' } })).toBe(5);
  });

  it('TESTE 3 — falha na auditoria autônoma NÃO derruba o fluxo (loga e retorna null)', async () => {
    const ap = ctx.app.get(AuditPrismaService);
    const spy = jest
      .spyOn(ap.auditoria, 'create')
      .mockRejectedValueOnce(new Error('conexão de auditoria indisponível'));

    await expect(
      audit.registrarAutonomo({ modulo: 'TEST', operacao: 'FALHA_AUDIT' }),
    ).resolves.toBeNull(); // não lança

    spy.mockRestore();
    // canal volta a funcionar normalmente
    const ok = await audit.registrarAutonomo({ modulo: 'TEST', operacao: 'OK_DEPOIS' });
    expect(ok).toMatch(UUID_V4);
  });

  it('TESTE 4 — ordem causal: eventId distinto por evento, mensagem consistente', async () => {
    const a = await audit.registrarAutonomo({ modulo: 'TEST', operacao: 'E1', reason: 'motivo-1' });
    const b = await audit.registrarAutonomo({ modulo: 'TEST', operacao: 'E2', reason: 'motivo-2' });
    expect(a).not.toBe(b);
    const r1 = await ctx.prisma.auditoria.findFirst({ where: { operacao: 'E1' } });
    const r2 = await ctx.prisma.auditoria.findFirst({ where: { operacao: 'E2' } });
    expect(r1!.reason).toBe('motivo-1');
    expect(r2!.reason).toBe('motivo-2');
    expect(r1!.eventId).not.toBe(r2!.eventId);
  });
});
