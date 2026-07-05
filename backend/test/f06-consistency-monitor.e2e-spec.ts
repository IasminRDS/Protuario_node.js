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
import { ConsistencyMonitorService } from '../src/modules/consistency/consistency-monitor.service';

const API = '/api/v1';

describe('F0.6-B — ConsistencyMonitor (E2E, Postgres real)', () => {
  let ctx: TestContext;
  let monitor: ConsistencyMonitorService;
  let admin: TestUser;
  let token: string;
  let hospitalA: string;

  beforeAll(async () => {
    ctx = await setupTestApp();
    monitor = ctx.app.get(ConsistencyMonitorService);
  });
  afterAll(async () => {
    await ctx.close();
  });
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  beforeEach(async () => {
    await truncateAll(ctx.prisma);
    await ctx.prisma.$executeRawUnsafe('TRUNCATE TABLE audit_aggregate_sequence');
    // Reset das estatísticas físicas → checkWorm(físico) determinístico por teste.
    await ctx.prisma.$executeRawUnsafe('SELECT pg_stat_reset()');
    hospitalA = await createHospital(ctx.prisma, 'Hospital A');
    admin = await createTestUser(ctx.prisma, { hospitalId: hospitalA, perfil: 'Administrador' });
    token = signToken(admin);
  });
  afterEach(async () => {
    // Segurança: garantir WORM reabilitado (TESTE C).
    await ctx.prisma.$executeRawUnsafe('ALTER TABLE auditoria ENABLE TRIGGER auditoria_no_update');
    await ctx.prisma.$executeRawUnsafe('ALTER TABLE auditoria ENABLE TRIGGER auditoria_no_delete');
  });

  const insertPaciente = async (): Promise<string> => {
    const rows = await ctx.prisma.$queryRawUnsafe<Array<{ id: bigint }>>(
      `INSERT INTO paciente(nome, sexo, data_nascimento, hospital_id, created_at, updated_at)
       VALUES ('Raw','M','1990-01-01', $1::uuid, now(), now()) RETURNING id`,
      hospitalA,
    );
    return rows[0].id.toString();
  };
  const insertCriarAudit = (entityId: string) =>
    ctx.prisma.$executeRawUnsafe(
      `INSERT INTO auditoria(event_id,modulo,operacao,resultado,entity,entity_id,data_evento)
       VALUES (gen_random_uuid(),'PACIENTES','CRIAR','SUCESSO','paciente',$1,now())`,
      entityId,
    );

  it('TESTE A — bijeção quebra (paciente sem CRIAR) é detectada; recupera', async () => {
    const id = await insertPaciente(); // paciente sem audit
    let r = await monitor.checkBijection();
    expect(r.ok).toBe(false);
    expect(r.severity).toBe('critical');

    // endpoint reflete a violação
    const health = await authorize(request(ctx.app.getHttpServer()).get(`${API}/internal/consistency/health`), token).expect(200);
    expect(health.body.data.ok).toBe(false);

    await insertCriarAudit(id); // recuperação
    r = await monitor.checkBijection();
    expect(r.ok).toBe(true);
  });

  it('TESTE B — COD com gap {1,2,4} é detectado; recupera com {3}', async () => {
    for (const seq of [1, 2, 4]) {
      await ctx.prisma.$executeRawUnsafe(
        `INSERT INTO auditoria(event_id,modulo,operacao,resultado,entity,entity_id,aggregate_seq,data_evento)
         VALUES (gen_random_uuid(),'PACIENTES','ATUALIZAR','SUCESSO','paciente','999',$1,now())`,
        seq,
      );
    }
    let r = await monitor.checkCOD();
    expect(r.ok).toBe(false);
    expect((r.details.sample as Array<{ entityId: string }>)[0].entityId).toBe('999');

    await ctx.prisma.$executeRawUnsafe(
      `INSERT INTO auditoria(event_id,modulo,operacao,resultado,entity,entity_id,aggregate_seq,data_evento)
       VALUES (gen_random_uuid(),'PACIENTES','ATUALIZAR','SUCESSO','paciente','999',3,now())`,
    );
    r = await monitor.checkCOD();
    expect(r.ok).toBe(true); // {1,2,3,4} contíguo
  });

  it('TESTE C — WORM desabilitado é detectado; recupera ao reabilitar', async () => {
    await ctx.prisma.$executeRawUnsafe('ALTER TABLE auditoria DISABLE TRIGGER auditoria_no_update');
    let r = await monitor.checkWorm();
    expect(r.ok).toBe(false);
    expect(r.severity).toBe('critical');

    await ctx.prisma.$executeRawUnsafe('ALTER TABLE auditoria ENABLE TRIGGER auditoria_no_update');
    r = await monitor.checkWorm();
    expect(r.ok).toBe(true);
  });

  it('TESTE D — órfão (AUDIT_SUCCESS sem paciente) é detectado; recupera', async () => {
    await ctx.prisma.$executeRawUnsafe(
      `INSERT INTO auditoria(event_id,modulo,operacao,resultado,entity,entity_id,aggregate_seq,data_evento)
       VALUES (gen_random_uuid(),'PACIENTES','CRIAR','SUCESSO','paciente','888',1,now())`,
    );
    let r = await monitor.checkOrphans();
    expect(r.ok).toBe(false);
    expect(r.details.count).toBe(1);

    // recuperação: cria o paciente correspondente (id explícito)
    await ctx.prisma.$executeRawUnsafe(
      `INSERT INTO paciente(id, nome, sexo, data_nascimento, hospital_id, created_at, updated_at)
       VALUES (888,'Reconciliado','M','1990-01-01',$1::uuid, now(), now())`,
      hospitalA,
    );
    r = await monitor.checkOrphans();
    expect(r.ok).toBe(true);
  });

  it('I-G4 — DUPLICATA (mesmo entity_id+seq 2x) é detectada independentemente', async () => {
    for (let i = 0; i < 2; i++) {
      await ctx.prisma.$executeRawUnsafe(
        `INSERT INTO auditoria(event_id,modulo,operacao,resultado,entity,entity_id,aggregate_seq,data_evento)
         VALUES (gen_random_uuid(),'PACIENTES','CRIAR','SUCESSO','paciente','555',1,now())`,
      );
    }
    const r = await monitor.checkCOD();
    expect(r.ok).toBe(false);
    expect(r.details.duplicates).toBe(1);
  });

  it('I-G6 físico — adulteração detectada MESMO após reabilitar o trigger', async () => {
    await ctx.prisma.$executeRawUnsafe(
      `INSERT INTO auditoria(event_id,modulo,operacao,resultado,data_evento)
       VALUES (gen_random_uuid(),'TEST','X','OK',now())`,
    );
    // Adultera: desabilita WORM, UPDATE, e REABILITA (trigger volta a 'enabled').
    await ctx.prisma.$executeRawUnsafe('ALTER TABLE auditoria DISABLE TRIGGER auditoria_no_update');
    await ctx.prisma.$executeRawUnsafe(`UPDATE auditoria SET resultado='TAMPERED' WHERE modulo='TEST'`);
    await ctx.prisma.$executeRawUnsafe('ALTER TABLE auditoria ENABLE TRIGGER auditoria_no_update');

    // O check de trigger sozinho passaria (reabilitado); o FÍSICO acusa a mutação.
    let r = await monitor.checkWorm();
    for (let i = 0; i < 50 && r.ok; i++) {
      await sleep(30); // estatística física pode ter pequeno lag
      r = await monitor.checkWorm();
    }
    expect(r.ok).toBe(false);
    expect((r.details.physical as { n_tup_upd: number }).n_tup_upd).toBeGreaterThanOrEqual(1);
  });

  it('F0.6-C — /metrics (público) expõe consistency_ok em formato Prometheus', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`${API}/internal/consistency/metrics`)
      .expect(200);
    expect(res.text).toContain('consistency_ok{invariant="I-G2A"}');
    expect(res.text).toContain('consistency_last_check_timestamp');
  });

  it('TESTE E — janela recente falha mesmo com global OK (I-G8 heurístico)', async () => {
    // audit CRIAR ANTIGO (fora da janela) sem paciente → equilibra o global.
    await ctx.prisma.$executeRawUnsafe(
      `INSERT INTO auditoria(event_id,modulo,operacao,resultado,entity,entity_id,data_evento)
       VALUES (gen_random_uuid(),'PACIENTES','CRIAR','SUCESSO','paciente','old', now() - interval '1 hour')`,
    );
    // paciente RECENTE sem audit → descompasso só na janela.
    await insertPaciente();

    const global = await monitor.checkBijection(); // m=1 (paciente), a=1 (audit antigo) → OK
    const windowR = await monitor.checkBijectionWindow(); // recente: m=1, a=0 → FALHA
    expect(global.ok).toBe(true);
    expect(windowR.ok).toBe(false);
    expect(windowR.severity).toBe('critical');
  });
});
