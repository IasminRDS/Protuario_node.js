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
import { AuditoriaService } from '../src/modules/auditoria/auditoria.service';
import { gate } from './utils/concurrency-scheduler';

const API = '/api/v1';

/**
 * D1-B — COD é SOD-only. Evento EOD (denial) NÃO adquire o lock da sequência
 * (não incrementa, não bloqueia) e recebe `aggregate_seq` como CORRELAÇÃO
 * read-only (última posição committada do agregado).
 */
describe('F0.4 / D1-B — EOD não-bloqueante + correlação read-only (E2E)', () => {
  let ctx: TestContext;
  let audit: AuditoriaService;
  let admin: TestUser;
  let token: string;

  beforeAll(async () => {
    ctx = await setupTestApp();
    audit = ctx.app.get(AuditoriaService);
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await truncateAll(ctx.prisma);
    await ctx.prisma.$executeRawUnsafe('TRUNCATE TABLE audit_aggregate_sequence');
    const h = await createHospital(ctx.prisma, 'Hospital A');
    admin = await createTestUser(ctx.prisma, { hospitalId: h, perfil: 'Administrador' });
    token = signToken(admin);
  });

  it('denial EOD é NÃO-BLOQUEANTE sob tx SOD aberta e referencia o seq COMMITTADO', async () => {
    const create = await authorize(request(ctx.app.getHttpServer()).post(`${API}/pacientes`), token)
      .send({ nome: 'Maria', sexo: 'M', dataNascimento: '1990-05-20', cpf: '52998224725' })
      .expect(201);
    const id = create.body.data.id as string; // CRIAR success → seq committado = 1

    const g = gate();
    // SOD: incrementa o seq do agregado (→ 2, NÃO committado) e pausa segurando o lock.
    const sod = ctx.prisma.$transaction(async (tx) => {
      await audit.registrarTx(tx, {
        modulo: 'PACIENTES', operacao: 'ATUALIZAR', entity: 'paciente', entityId: id, resultado: 'SUCESSO',
      });
      await g.wait(); // segura o lock de audit_aggregate_sequence
    });

    // EOD concorrente: se BLOQUEASSE no lock, este await travaria até g.open() (que só
    // ocorre depois) → o teste daria timeout. Passar aqui já PROVA não-bloqueio.
    const denialEventId = await audit.registrarAutonomo({
      modulo: 'ACCESS', operacao: 'PATCH', entity: 'paciente', entityId: id, resultado: 'ERRO:409',
    });
    expect(denialEventId).not.toBeNull(); // completou sem bloquear

    const denial = await ctx.prisma.auditoria.findFirst({
      where: { entity: 'paciente', entityId: id, resultado: { startsWith: 'ERRO' } },
    });
    expect(denial?.aggregateSeq).toBe(1n); // referência = último seq COMMITTADO (não o 2 não-committado)

    g.open(); // libera SOD → commit (success vira seq=2)
    await sod;

    // COD (só AUDIT_SUCCESS) permanece {1,2}: o denial NÃO consumiu seq (sem buraco, sem 3).
    const successSeqs = (
      await ctx.prisma.auditoria.findMany({
        where: { entity: 'paciente', entityId: id, resultado: 'SUCESSO' },
        select: { aggregateSeq: true },
      })
    )
      .map((r) => r.aggregateSeq as bigint)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    expect(successSeqs).toEqual([1n, 2n]);
  });
});
