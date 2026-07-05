import { setupTestApp, TestContext } from './helpers/test-app';
import { truncateAll } from './helpers/factories';

/**
 * Prova de imutabilidade WORM da trilha de auditoria (não-repúdio CNJ).
 * INSERT/SELECT permitidos; UPDATE/DELETE rejeitados pelo trigger no banco.
 */
describe('Auditoria WORM — imutabilidade enforçada no banco (E2E)', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await setupTestApp();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await truncateAll(ctx.prisma); // TRUNCATE não dispara triggers de linha
  });

  it('append (INSERT) e leitura (SELECT) permanecem permitidos', async () => {
    await ctx.prisma.auditoria.create({
      data: { modulo: 'TEST', operacao: 'APPEND', resultado: 'OK' },
    });
    const n = await ctx.prisma.auditoria.count({ where: { operacao: 'APPEND' } });
    expect(n).toBe(1);
  });

  it('UPDATE é bloqueado pelo trigger (append-only)', async () => {
    const row = await ctx.prisma.auditoria.create({
      data: { modulo: 'TEST', operacao: 'IMUTAVEL', resultado: 'OK' },
    });
    await expect(
      ctx.prisma.$executeRawUnsafe(
        'UPDATE auditoria SET resultado = $1 WHERE id = $2',
        'ADULTERADO',
        row.id,
      ),
    ).rejects.toThrow(/WORM|append-only|42501|insufficient/i);

    // o valor original permanece intacto
    const after = await ctx.prisma.auditoria.findUnique({ where: { id: row.id } });
    expect(after?.resultado).toBe('OK');
  });

  it('DELETE é bloqueado pelo trigger (não-repúdio)', async () => {
    const row = await ctx.prisma.auditoria.create({
      data: { modulo: 'TEST', operacao: 'PERMANENTE', resultado: 'OK' },
    });
    await expect(
      ctx.prisma.$executeRawUnsafe('DELETE FROM auditoria WHERE id = $1', row.id),
    ).rejects.toThrow(/WORM|append-only|42501|insufficient/i);

    const still = await ctx.prisma.auditoria.count({ where: { id: row.id } });
    expect(still).toBe(1);
  });
});
