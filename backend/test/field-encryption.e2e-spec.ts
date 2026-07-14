import { PrismaClient } from '@prisma/client';
import { setupTestApp, TestContext } from './helpers/test-app';
import {
  createHospital,
  createPaciente,
  createTestUser,
  truncateAll,
} from './helpers/factories';

/**
 * Criptografia de campo em repouso (AES-256-GCM). Prova que:
 *  - PHI narrativo (alergias, notas SOAP) fica CIFRADO no banco (defesa mesmo
 *    sem TDE; o backup lógico também sai cifrado);
 *  - a leitura pela aplicação devolve o texto claro (transparente).
 *
 * O valor "em repouso" é lido por um PrismaClient BARE (sem o middleware que
 * decifra) apontando para o MESMO container — senão a leitura já viria decifrada.
 * A chave é setada ANTES do setupTestApp (o FieldEncryptionService é instanciado
 * na construção do PrismaService).
 */
describe('Criptografia de campo em repouso (E2E, Postgres real)', () => {
  let ctx: TestContext;
  let bare: PrismaClient; // sem middleware → enxerga o valor cru no banco
  let hospital: string;
  const KEY_BACKUP = process.env.FIELD_ENCRYPTION_KEY;

  beforeAll(async () => {
    process.env.FIELD_ENCRYPTION_KEY = 'a'.repeat(64); // 32 bytes hex (dev/test)
    ctx = await setupTestApp();
    bare = new PrismaClient({
      datasources: { db: { url: ctx.container.getConnectionUri() } },
    });
    await bare.$connect();
  });

  afterAll(async () => {
    await bare.$disconnect();
    await ctx.close();
    if (KEY_BACKUP === undefined) delete process.env.FIELD_ENCRYPTION_KEY;
    else process.env.FIELD_ENCRYPTION_KEY = KEY_BACKUP;
  });

  beforeEach(async () => {
    await truncateAll(ctx.prisma);
    hospital = await createHospital(ctx.prisma, 'Hospital A');
  });

  const atRest = async (table: string, col: string, id: bigint): Promise<string> => {
    const rows = await bare.$queryRawUnsafe<Array<Record<string, string>>>(
      `SELECT ${col} AS v FROM ${table} WHERE id = $1`,
      id,
    );
    return rows[0].v;
  };

  it('alergias: cifrada no banco, em claro pela aplicação', async () => {
    const ALERGIA = 'Penicilina, Dipirona, contraste iodado';
    const id = await createPaciente(ctx.prisma, {
      hospitalId: hospital,
      nome: 'Paciente Cifrado',
      cpf: '52998224725',
    });
    await ctx.prisma.paciente.update({
      where: { id: BigInt(id) },
      data: { alergias: ALERGIA },
    });

    const rest = await atRest('paciente', 'alergias', BigInt(id));
    expect(rest.startsWith('enc:v1:')).toBe(true);
    expect(rest).not.toContain('Penicilina');

    const lido = await ctx.prisma.paciente.findFirst({
      where: { id: BigInt(id) },
      select: { alergias: true },
    });
    expect(lido?.alergias).toBe(ALERGIA);
  });

  it('input com prefixo FALSO (enc:v1:) é cifrado mesmo assim (anti-bypass)', async () => {
    const FAKE = 'enc:v1:tentativa-de-burlar-a-cifra';
    const id = await createPaciente(ctx.prisma, {
      hospitalId: hospital,
      nome: 'Atacante',
      cpf: '39053344705',
    });
    await ctx.prisma.paciente.update({
      where: { id: BigInt(id) },
      data: { alergias: FAKE },
    });

    const rest = await atRest('paciente', 'alergias', BigInt(id));
    // NÃO pode ser gravado literalmente (senão o input burlaria a cifra):
    expect(rest).not.toBe(FAKE);
    expect(rest.startsWith('enc:v1:')).toBe(true);
    // E a leitura devolve exatamente o que foi enviado (sem crash de integridade).
    const lido = await ctx.prisma.paciente.findFirst({
      where: { id: BigInt(id) },
      select: { alergias: true },
    });
    expect(lido?.alergias).toBe(FAKE);
  });

  it('notas SOAP do prontuário: cifradas no banco, em claro pela aplicação', async () => {
    const pacienteId = await createPaciente(ctx.prisma, {
      hospitalId: hospital,
      nome: 'Paciente SOAP',
      cpf: '11144477735',
    });
    const medico = await createTestUser(ctx.prisma, { hospitalId: hospital, perfil: 'Medico' });
    const atendimento = await ctx.prisma.atendimento.create({
      data: {
        pacienteId: BigInt(pacienteId),
        medicoId: BigInt(medico.id),
        tipo: 'CONSULTA',
        hospitalId: hospital,
      },
    });
    const AVALIACAO = 'Hipótese: pneumonia comunitária. Suspeita de sepse.';
    const pront = await ctx.prisma.prontuario.create({
      data: {
        atendimentoId: atendimento.id,
        pacienteId: BigInt(pacienteId),
        avaliacao: AVALIACAO,
        hospitalId: hospital,
      },
    });

    const rest = await atRest('prontuario', 'avaliacao', pront.id);
    expect(rest.startsWith('enc:v1:')).toBe(true);
    expect(rest).not.toContain('sepse');

    const lido = await ctx.prisma.prontuario.findFirst({
      where: { id: pront.id },
      select: { avaliacao: true },
    });
    expect(lido?.avaliacao).toBe(AVALIACAO);
  });
});
