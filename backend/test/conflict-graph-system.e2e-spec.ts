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
import { analyze, HistoryEvent } from './utils/conflict-graph';

const API = '/api/v1';

/**
 * Aplica o checker à HISTÓRIA REAL observada (audit rows persistidos) após um
 * cenário concorrente. Valida P1 (SOD/WW acíclico), P2 (COD total order),
 * P3 (EOD excluído), P4 (cross-agregado independente) sobre dados de produção.
 */
describe('Conflict-Graph aplicado ao sistema (E2E, Postgres real)', () => {
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

  const http = () => request(ctx.app.getHttpServer());
  const post = (cpf: string) =>
    authorize(http().post(`${API}/pacientes`), token).send({ nome: 'P', sexo: 'M', dataNascimento: '1990-05-20', cpf });

  it('P1..P4 valem sobre a história real (updates concorrentes + denial + 2º agregado)', async () => {
    const p1 = (await post('52998224725').expect(201)).body.data.id as string;
    // 3 updates CONCORRENTES no mesmo agregado
    await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        authorize(http().patch(`${API}/pacientes/${p1}`), token).send({ telefone: `1199999${i}000` }),
      ),
    );
    // Agregado independente (cria o registro; o id não é usado adiante)
    await post('11144477735').expect(201);
    // Evento EOD (denial) sobre o agregado p1
    await audit.registrarAutonomo({ modulo: 'ACCESS', operacao: 'PATCH', entity: 'paciente', entityId: p1, resultado: 'ERRO:409' });

    // Constrói a história a partir dos audit rows persistidos.
    const rows = await ctx.prisma.auditoria.findMany({
      where: { entity: 'paciente' },
      select: { eventId: true, entityId: true, resultado: true, aggregateSeq: true },
      orderBy: { id: 'asc' },
    });
    let order = 0;
    const history: HistoryEvent[] = [];
    for (const row of rows) {
      const aggregateId = `paciente:${row.entityId}`;
      const seq = Number(row.aggregateSeq);
      if (row.resultado === 'SUCESSO') {
        history.push({ kind: 'op', order: order++, txId: row.eventId, aggregateId, op: 'write', version: seq });
        history.push({ kind: 'cod', order: order++, txId: row.eventId, aggregateId, result: 'SUCCESS', aggregateSeq: seq });
      } else {
        history.push({ kind: 'cod', order: order++, txId: row.eventId, aggregateId, result: 'DENIAL', aggregateSeq: seq });
      }
    }

    const res = analyze(history);
    expect(res.sodGraph.acyclic).toBe(true); // P1
    expect(res.codGraph.totalOrder).toBe(true); // P2 (p1={1,2,3,4}, p2={1})
    expect(res.eodExcluded).toBe(true); // P3
    expect(res.crossAggregateEdges).toBe(0); // P4
    expect(res.violations).toEqual([]);

    // P5 (linearizabilidade local): a projeção por seq é a ordem committada.
    const seqsP1 = history
      .filter((e) => e.kind === 'cod' && e.result === 'SUCCESS' && e.aggregateId === `paciente:${p1}`)
      .map((e) => (e as { aggregateSeq: number }).aggregateSeq)
      .sort((a, b) => a - b);
    expect(seqsP1).toEqual([1, 2, 3, 4]);
  });
});
