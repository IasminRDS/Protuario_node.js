import { randomUUID } from 'crypto';
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
 * Contenção de órfãos. Órfão = hospital_id NULO ou vínculo não-resolvível
 * (hospital inexistente). Congelados no banco; registros válidos operam normal.
 */
describe('Quarentena de órfãos — contenção no banco (E2E)', () => {
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

  it('registro COM vínculo válido é editável e não está em quarentena', async () => {
    const hA = await createHospital(ctx.prisma, 'Hospital A');
    const id = await createPaciente(ctx.prisma, { hospitalId: hA, nome: 'Válida', cpf: '52998224725' });
    await ctx.prisma.paciente.update({ where: { id: BigInt(id) }, data: { telefone: '11999998888' } });
    const row = await ctx.prisma.paciente.findUnique({ where: { id: BigInt(id) } });
    expect(row?.telefone).toBe('11999998888');
  });

  it('órfão (hospital_id nulo) NÃO pode ser alterado — erro REGISTRO_CLINICO_EM_QUARENTENA', async () => {
    const orphan = await ctx.prisma.paciente.create({
      data: { nome: 'Órfã', sexo: 'F', dataNascimento: new Date('1990-01-01'), hospitalId: null },
    });
    await expect(
      ctx.prisma.$executeRawUnsafe('UPDATE paciente SET telefone = $1 WHERE id = $2', '11000000000', orphan.id),
    ).rejects.toThrow(/REGISTRO_CLINICO_EM_QUARENTENA/);
  });

  it('vínculo NÃO-RESOLVÍVEL (hospital inexistente) também é bloqueado', async () => {
    const fantasma = randomUUID(); // uuid válido, mas sem hospital correspondente
    const p = await ctx.prisma.paciente.create({
      data: { nome: 'Dangling', sexo: 'M', dataNascimento: new Date('1980-01-01'), hospitalId: fantasma },
    });
    await expect(
      ctx.prisma.$executeRawUnsafe('UPDATE paciente SET telefone = $1 WHERE id = $2', '11222223333', p.id),
    ).rejects.toThrow(/REGISTRO_CLINICO_EM_QUARENTENA/);
  });

  it('órfão NÃO pode ser removido (DELETE bloqueado)', async () => {
    const orphan = await ctx.prisma.paciente.create({
      data: { nome: 'Órfã2', sexo: 'M', dataNascimento: new Date('1985-01-01'), hospitalId: null },
    });
    await expect(
      ctx.prisma.$executeRawUnsafe('DELETE FROM paciente WHERE id = $1', orphan.id),
    ).rejects.toThrow(/REGISTRO_CLINICO_EM_QUARENTENA/);
    expect(await ctx.prisma.paciente.count({ where: { id: orphan.id } })).toBe(1);
  });

  it('contrato de erro API: mutar órfão retorna 409 REGISTRO_CLINICO_EM_QUARENTENA', async () => {
    const orphan = await ctx.prisma.paciente.create({
      data: { nome: 'Órfã', sexo: 'F', dataNascimento: new Date('1990-01-01'), hospitalId: null },
    });
    const sa = await createTestUser(ctx.prisma, { hospitalId: null, perfil: 'SuperAdmin' });
    const token = signToken(sa);

    const res = await authorize(
      request(ctx.app.getHttpServer()).patch(`${API}/pacientes/${orphan.id}`),
      token,
    )
      .send({ telefone: '11999990000' })
      .expect(409);

    expect(res.body.error.code).toBe('REGISTRO_CLINICO_EM_QUARENTENA');
    expect(res.body.error.message).toMatch(/inconsist[êe]ncia de v[íi]nculo/i);
    // e o dado permanece intacto (não mutado)
    const row = await ctx.prisma.paciente.findUnique({ where: { id: orphan.id } });
    expect(row?.telefone).toBeNull();
  });

  it('contrato API: consistencyState VALIDO / QUARENTENA / INCONSISTENTE (source of truth)', async () => {
    const hA = await createHospital(ctx.prisma, 'Hospital A');
    const validId = await createPaciente(ctx.prisma, { hospitalId: hA, nome: 'Válida', cpf: '11111111111' });
    const orphan = await ctx.prisma.paciente.create({
      data: { nome: 'Órfã', sexo: 'F', dataNascimento: new Date('1990-01-01'), hospitalId: null },
    });
    const dangling = await ctx.prisma.paciente.create({
      data: { nome: 'Dangling', sexo: 'M', dataNascimento: new Date('1980-01-01'), hospitalId: randomUUID() },
    });
    const sa = await createTestUser(ctx.prisma, { hospitalId: null, perfil: 'SuperAdmin' });
    const token = signToken(sa);
    const get = (id: string | bigint) =>
      authorize(request(ctx.app.getHttpServer()).get(`${API}/pacientes/${id}`), token).expect(200);

    const rValid = await get(validId);
    expect(rValid.body.data.consistencyState).toBe('VALIDO');
    expect(rValid.body.data.emQuarentena).toBe(false);

    const rOrphan = await get(orphan.id);
    expect(rOrphan.body.data.consistencyState).toBe('QUARENTENA');
    expect(rOrphan.body.data.emQuarentena).toBe(true);

    const rDangling = await get(dangling.id);
    expect(rDangling.body.data.consistencyState).toBe('INCONSISTENTE');
    expect(rDangling.body.data.emQuarentena).toBe(true);
  });
});
