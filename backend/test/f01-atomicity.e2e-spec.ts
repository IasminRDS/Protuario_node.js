import { setupTestApp, TestContext } from './helpers/test-app';
import { createHospital, createTestUser, truncateAll, TestUser } from './helpers/factories';
import { PacientesService } from '../src/modules/pacientes/pacientes.service';
import { AuditoriaService } from '../src/modules/auditoria/auditoria.service';

/**
 * F0.1 — atomicidade mutação ↔ auditoria de sucesso (I1/I2). Prova adversarial
 * contra Postgres real (não mock): a auditoria de sucesso está na MESMA tx da
 * mutação; se ela falha, a mutação faz rollback. Estado (1,0) é inalcançável.
 */
describe('F0.1 — atomicidade mutação↔auditoria (E2E, Postgres real)', () => {
  let ctx: TestContext;
  let pacientes: PacientesService;
  let auditoria: AuditoriaService;
  let autor: TestUser;

  const dto = (cpf: string) => ({ nome: 'Maria', sexo: 'M', dataNascimento: '1990-05-20', cpf });
  const countPac = () => ctx.prisma.paciente.count();
  const countAuditCriar = () => ctx.prisma.auditoria.count({ where: { operacao: 'CRIAR' } });

  beforeAll(async () => {
    ctx = await setupTestApp();
    pacientes = ctx.app.get(PacientesService);
    auditoria = ctx.app.get(AuditoriaService);
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await truncateAll(ctx.prisma);
    const h = await createHospital(ctx.prisma, 'Hospital A');
    autor = await createTestUser(ctx.prisma, { hospitalId: h, perfil: 'Administrador' });
  });

  it('PROVA DA FALHA (modelo ANTES): 2 commits separados alcançam estado (1,0)', async () => {
    // Emula o fluxo antigo: create commita; auditoria (separada) nunca executa.
    await ctx.prisma.paciente.create({
      data: { nome: 'Fantasma', sexo: 'M', dataNascimento: new Date('1990-01-01'), cpf: '11111111111' },
    });
    // ...crash antes da auditoria...
    expect(await countPac()).toBe(1);
    expect(await countAuditCriar()).toBe(0); // (1,0): mutação sem trilha — I1/I2 violados
  });

  it('CASO A — sucesso: mutação e auditoria persistem juntas (1,1)', async () => {
    await pacientes.criar(dto('52998224725'), autor.id);
    expect(await countPac()).toBe(1);
    expect(await countAuditCriar()).toBe(1); // par (1,1)
  });

  it('CASO B — falha no audit → ROLLBACK total (0,0), estado (1,0) inalcançável', async () => {
    const spy = jest
      .spyOn(auditoria, 'registrarTx')
      .mockRejectedValueOnce(new Error('auditoria indisponível'));

    await expect(pacientes.criar(dto('52998224725'), autor.id)).rejects.toThrow(
      'auditoria indisponível',
    );

    expect(await countPac()).toBe(0);        // mutação revertida
    expect(await countAuditCriar()).toBe(0); // nenhuma trilha órfã
    spy.mockRestore();
  });

  it('INVARIANTE I1 sob N criações: count(paciente) == count(audit CRIAR)', async () => {
    const cpfs = ['52998224725', '11144477735', '39053344705', '20817678900', '15350946056'];
    for (const cpf of cpfs) {
      await pacientes.criar(dto(cpf), autor.id);
    }
    const p = await countPac();
    const a = await countAuditCriar();
    expect(p).toBe(cpfs.length);
    expect(a).toBe(p); // bijeção mutação↔auditoria de sucesso
  });
});
