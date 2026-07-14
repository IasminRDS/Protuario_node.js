import { randomUUID } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { Test } from 'supertest';
import { PrismaService } from '../../src/infra/prisma/prisma.service';

export interface TestUser {
  id: string;
  login: string;
  perfil: string;
  hospitalId: string | null;
}

/** Cria um hospital (tenant). */
export async function createHospital(
  prisma: PrismaService,
  nome = 'Hospital Teste',
): Promise<string> {
  const h = await prisma.hospital.create({
    data: { id: randomUUID(), nome },
  });
  return h.id;
}

/**
 * Cria um usuário vinculado a um hospital (ou sem hospital, para testar 403).
 * O perfil define as permissões (permissionsForPerfil). Administrador = admin:full,
 * então o isolamento testado é puramente por tenant (não por permissão).
 */
export async function createTestUser(
  prisma: PrismaService,
  opts: { hospitalId: string | null; perfil?: string },
): Promise<TestUser> {
  const perfilNome = opts.perfil ?? 'Administrador';
  const perfil = await prisma.perfil.upsert({
    where: { nome: perfilNome },
    update: {},
    create: { nome: perfilNome },
  });
  const login = `user_${randomUUID().slice(0, 8)}`;
  const user = await prisma.usuario.create({
    data: {
      nome: login,
      login,
      senha: 'test-hash', // login é por token; senha não é verificada aqui
      perfilId: perfil.id,
      hospitalId: opts.hospitalId,
      ativo: true,
    },
  });
  return {
    id: user.id.toString(),
    login,
    perfil: perfilNome,
    hospitalId: opts.hospitalId,
  };
}

/** Assina um access token válido (o JwtStrategy re-lê hospitalId do banco). */
export function signToken(user: TestUser): string {
  return jwt.sign(
    { sub: user.id, login: user.login, perfil: user.perfil },
    process.env.JWT_ACCESS_SECRET as string,
    { expiresIn: '15m' },
  );
}

/**
 * "Tenant via header" = Authorization Bearer do usuário daquele hospital.
 * (Não existe header de tenant cru: seria forjável = vazamento entre hospitais.)
 */
export function authorize(req: Test, token: string): Test {
  return req.set('Authorization', `Bearer ${token}`);
}

/** Cria um paciente diretamente no banco (setup roda fora de contexto HTTP). */
export async function createPaciente(
  prisma: PrismaService,
  opts: { hospitalId: string; nome: string; cpf?: string },
): Promise<string> {
  const p = await prisma.paciente.create({
    data: {
      nome: opts.nome,
      sexo: 'M',
      dataNascimento: new Date('1990-01-01'),
      cpf: opts.cpf ?? null,
      hospitalId: opts.hospitalId,
    },
  });
  return p.id.toString();
}

/** Cria um tipo de exame (catálogo). */
export async function createTipoExame(
  prisma: PrismaService,
  opts: { codigo?: string; nome?: string } = {},
): Promise<string> {
  const t = await prisma.tipoExame.create({
    data: {
      codigo: opts.codigo ?? `EX_${randomUUID().slice(0, 6)}`,
      nome: opts.nome ?? 'Hemograma completo',
    },
  });
  return t.id.toString();
}

/**
 * Cria diretamente no banco os modelos clínicos que ficam FORA de TENANT_MODELS
 * (Internacao/ExameSolicitado/VacinaAplicada/Cirurgia). Usados para provar que
 * o acesso cross-tenant a eles é barrado pelo guard de posse do paciente.
 */
export async function createInternacao(
  prisma: PrismaService,
  opts: { pacienteId: string; hospitalId?: string; cidPrincipal?: string },
): Promise<string> {
  const i = await prisma.internacao.create({
    data: {
      pacienteId: BigInt(opts.pacienteId),
      leito: '101-A',
      hospitalId: opts.hospitalId ?? null,
      cidPrincipal: opts.cidPrincipal ?? 'J18',
      status: 'ATIVA',
    },
  });
  return i.id.toString();
}

export async function createExame(
  prisma: PrismaService,
  opts: { pacienteId: string; tipoExameId: string; hospitalId?: string },
): Promise<string> {
  const e = await prisma.exameSolicitado.create({
    data: {
      pacienteId: BigInt(opts.pacienteId),
      tipoExameId: BigInt(opts.tipoExameId),
      hospitalId: opts.hospitalId ?? null,
      status: 'resultado_disponivel',
      interpretacao: 'alterado',
      resultadoValor: '15.2',
      resultadoUnidade: 'g/dL',
      dataResultado: new Date(),
    },
  });
  return e.id.toString();
}

export async function createVacinaAplicada(
  prisma: PrismaService,
  opts: { pacienteId: string },
): Promise<string> {
  const v = await prisma.vacinaAplicada.create({
    data: {
      pacienteId: BigInt(opts.pacienteId),
      nomeVacina: 'Influenza',
      dose: '1ª dose',
    },
  });
  return v.id.toString();
}

export async function createCirurgia(
  prisma: PrismaService,
  opts: { pacienteId: string; hospitalId?: string },
): Promise<string> {
  const c = await prisma.cirurgia.create({
    data: {
      pacienteId: BigInt(opts.pacienteId),
      hospitalId: opts.hospitalId ?? null,
      descricao: 'Apendicectomia',
      status: 'concluida',
      dataInicio: new Date(),
    },
  });
  return c.id.toString();
}

/** Limpa TODAS as tabelas entre testes (determinístico, sem persistência). */
export async function truncateAll(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE
       "prontuario","prescricao","triagem","atendimento","paciente","auditoria",
       "internacao","exame_solicitado","tipo_exame","vacina_aplicada","vacina",
       "cirurgia","resource_lock","usuario","perfil","unidade","hospital",
       "cidadao","cidadao_identity_key","outbox_event","processed_event",
       "aggregate_sequence","consumer_offset"
     RESTART IDENTITY CASCADE`,
  );
}
