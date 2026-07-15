import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { BlindIndexService } from '../src/infra/crypto/blind-index';

const blind = new BlindIndexService();

const prisma = new PrismaClient();

/**
 * Seed estratégica e IDEMPOTENTE (pode rodar N vezes com `upsert`/find-or-create):
 *  - Perfis RBAC + SuperAdmin de bootstrap (cross-tenant).
 *  - Hospital/Unidade de demonstração (tenant) — dá contexto multi-tenant.
 *  - Usuários clínicos (Médico/Enfermeiro/Administrador) já com perfil.
 *  - Estrutura hospitalar: setores, leitos (status "livre") e salas cirúrgicas.
 *  - Catálogos: tipos de exame e medicamentos.
 *  - Pacientes fictícios (CPF com dígito verificador válido) para testar fluxos.
 *
 * Objetivo: transformar "backend correto" em "sistema testável de ponta a ponta"
 * (PS → fila → atendimento → exame → prescrição → internação → evolução → alta).
 */

// Tenant fixo (determinístico) para todo o dado clínico de demonstração.
const DEMO_HOSPITAL_ID = '00000000-0000-4000-8000-000000000001';
const DEMO_UNIDADE_ID = '00000000-0000-4000-8000-000000000002';

const PERFIS = [
  { nome: 'SuperAdmin', descricao: 'Operador da plataforma (cross-tenant, ignora hospital)' },
  { nome: 'Administrador', descricao: 'Administração completa dentro do hospital (tenant)' },
  { nome: 'Medico', descricao: 'Atendimento clínico, prescrições e exames' },
  { nome: 'Enfermeiro', descricao: 'Triagem, PS e administração de medicação' },
  { nome: 'Farmaceutico', descricao: 'Estoque e medicamentos' },
  { nome: 'Recepcao', descricao: 'Cadastro de pacientes e agenda' },
  { nome: 'Gestor', descricao: 'Relatórios e auditoria (leitura)' },
];

// --- Utilitários -----------------------------------------------------------

/** Gera um CPF (11 dígitos) com dígitos verificadores válidos a partir de 9 dígitos base. */
function gerarCpf(base9: string): string {
  const nums = base9.split('').map(Number);
  const dv = (arr: number[]): number => {
    const start = arr.length + 1;
    const soma = arr.reduce((acc, n, i) => acc + n * (start - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = dv(nums);
  const d2 = dv([...nums, d1]);
  return `${base9}${d1}${d2}`;
}

async function main() {
  // 1) Perfis -------------------------------------------------------------
  console.log('> Semeando perfis...');
  for (const perfil of PERFIS) {
    await prisma.perfil.upsert({
      where: { nome: perfil.nome },
      update: { descricao: perfil.descricao },
      create: perfil,
    });
  }
  const perfilPorNome = async (nome: string) =>
    prisma.perfil.findUniqueOrThrow({ where: { nome } });

  // 2) SuperAdmin de bootstrap (cross-tenant, sem hospitalId) --------------
  const superAdmin = await perfilPorNome('SuperAdmin');
  const login = process.env.SEED_ADMIN_LOGIN ?? 'admin';
  const senhaPlana = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123';
  const nome = process.env.SEED_ADMIN_NOME ?? 'Administrador do Sistema';
  if (!(await prisma.usuario.findUnique({ where: { login } }))) {
    console.log(`> Criando SuperAdmin "${login}"...`);
    await prisma.usuario.create({
      data: { nome, login, senha: await argon2.hash(senhaPlana), perfilId: superAdmin.id, ativo: true },
    });
  }

  // 3) Hospital / Unidade de demonstração (tenant) -------------------------
  console.log('> Semeando hospital/unidade de demonstração...');
  await prisma.hospital.upsert({
    where: { id: DEMO_HOSPITAL_ID },
    update: { nome: 'Hospital Geral de Demonstração', ativo: true },
    create: {
      id: DEMO_HOSPITAL_ID,
      nome: 'Hospital Geral de Demonstração',
      cnes: '0000001',
      uf: 'BA',
      ativo: true,
    },
  });
  await prisma.unidade.upsert({
    where: { id: DEMO_UNIDADE_ID },
    update: { nome: 'Unidade Central' },
    create: {
      id: DEMO_UNIDADE_ID,
      hospitalId: DEMO_HOSPITAL_ID,
      nome: 'Unidade Central',
      tipo: 'HOSPITAL',
      cnes: '0000001-01',
      cidade: 'Salvador',
      uf: 'BA',
    },
  });

  // 4) Usuários clínicos (com RBAC) ---------------------------------------
  console.log('> Semeando usuários clínicos...');
  const usuarios = [
    { login: 'dr.souza', nome: 'Dra. Ana Souza', perfil: 'Medico', senha: 'Medico@123', crm: 'CRM-BA-45210', especialidade: 'Clínica Médica' },
    { login: 'enf.lima', nome: 'Enf. Carlos Lima', perfil: 'Enfermeiro', senha: 'Enfermeiro@123' },
    { login: 'gestor', nome: 'Gestor do Hospital', perfil: 'Administrador', senha: 'Gestor@123' },
  ];
  for (const u of usuarios) {
    const perfil = await perfilPorNome(u.perfil);
    let usuario = await prisma.usuario.findUnique({ where: { login: u.login } });
    if (!usuario) {
      usuario = await prisma.usuario.create({
        data: {
          nome: u.nome,
          login: u.login,
          senha: await argon2.hash(u.senha),
          perfilId: perfil.id,
          hospitalId: DEMO_HOSPITAL_ID,
          ativo: true,
        },
      });
    } else {
      // Mantém a senha; só reconcilia perfil/tenant (idempotente).
      usuario = await prisma.usuario.update({
        where: { id: usuario.id },
        data: { perfilId: perfil.id, hospitalId: DEMO_HOSPITAL_ID, ativo: true },
      });
    }
    if (u.crm) {
      await prisma.medico.upsert({
        where: { userId: usuario.id },
        update: { crm: u.crm, especialidade: u.especialidade, hospitalId: DEMO_HOSPITAL_ID },
        create: { userId: usuario.id, crm: u.crm, especialidade: u.especialidade, hospitalId: DEMO_HOSPITAL_ID },
      });
    }
  }

  // 5) Estrutura hospitalar: setores + leitos ------------------------------
  console.log('> Semeando setores e leitos...');
  const SETORES: Array<{ nome: string; sigla: string; tipo: string; leitos: string[] }> = [
    { nome: 'Emergência', sigla: 'EMERG', tipo: 'ps', leitos: ['EM-01', 'EM-02', 'EM-03', 'EM-04'] },
    { nome: 'UTI', sigla: 'UTI', tipo: 'uti', leitos: ['UTI-01', 'UTI-02', 'UTI-03'] },
    { nome: 'Clínica Médica', sigla: 'CM', tipo: 'enfermaria', leitos: ['201', '202', '203', '204', '205'] },
    { nome: 'Centro Cirúrgico', sigla: 'CC', tipo: 'cirurgia', leitos: [] },
  ];
  for (const s of SETORES) {
    let setor = await prisma.setor.findFirst({
      where: { nome: s.nome, hospitalId: DEMO_HOSPITAL_ID },
    });
    if (!setor) {
      setor = await prisma.setor.create({
        data: { nome: s.nome, sigla: s.sigla, tipo: s.tipo, hospitalId: DEMO_HOSPITAL_ID },
      });
    }
    for (const numero of s.leitos) {
      const existe = await prisma.leito.findFirst({
        where: { numero, setorId: setor.id },
      });
      if (!existe) {
        await prisma.leito.create({
          data: {
            setorId: setor.id,
            numero,
            tipo: s.tipo === 'uti' ? 'uti' : 'comum',
            status: 'livre',
            hospitalId: DEMO_HOSPITAL_ID,
          },
        });
      }
    }
  }

  // 6) Salas cirúrgicas ----------------------------------------------------
  console.log('> Semeando salas cirúrgicas...');
  for (const sala of [
    { nome: 'Sala 1', tipo: 'geral' },
    { nome: 'Sala 2', tipo: 'ortopedia' },
  ]) {
    if (!(await prisma.salaCirurgica.findFirst({ where: { nome: sala.nome } }))) {
      await prisma.salaCirurgica.create({ data: sala });
    }
  }

  // 7) Catálogo de tipos de exame -----------------------------------------
  console.log('> Semeando catálogo de exames...');
  const TIPOS_EXAME = [
    { codigo: 'HMG', nome: 'Hemograma completo', categoria: 'laboratorial', instrucoes: 'Jejum de 4h recomendado.' },
    { codigo: 'GLI', nome: 'Glicemia de jejum', categoria: 'laboratorial', instrucoes: 'Jejum de 8h.' },
    { codigo: 'RX', nome: 'Raio-X de tórax', categoria: 'imagem', instrucoes: 'Retirar objetos metálicos.' },
    { codigo: 'TC', nome: 'Tomografia computadorizada', categoria: 'imagem', instrucoes: 'Verificar função renal se com contraste.' },
    { codigo: 'URO', nome: 'Urina tipo I (EAS)', categoria: 'laboratorial', instrucoes: 'Coletar 1º jato da manhã.' },
  ];
  for (const t of TIPOS_EXAME) {
    await prisma.tipoExame.upsert({
      where: { codigo: t.codigo },
      update: { nome: t.nome, categoria: t.categoria, instrucoes: t.instrucoes, ativo: true },
      create: t,
    });
  }

  // 8) Catálogo de medicamentos -------------------------------------------
  console.log('> Semeando catálogo de medicamentos...');
  const MEDICAMENTOS = [
    { nomeGenerico: 'Dipirona sódica', nomeComercial: 'Novalgina', classe: 'Analgésico/Antitérmico', apresentacao: '500 mg/mL solução injetável', viaAdmin: 'EV/IM', listaRename: 'A' },
    { nomeGenerico: 'Paracetamol', nomeComercial: 'Tylenol', classe: 'Analgésico/Antitérmico', apresentacao: '500 mg comprimido', viaAdmin: 'VO', listaRename: 'A' },
    { nomeGenerico: 'Ceftriaxona', nomeComercial: 'Rocefin', classe: 'Antibiótico (cefalosporina)', apresentacao: '1 g pó para solução injetável', viaAdmin: 'EV/IM', listaRename: 'B' },
    { nomeGenerico: 'Cloreto de sódio 0,9%', nomeComercial: 'Soro Fisiológico', classe: 'Solução parenteral', apresentacao: '500 mL bolsa', viaAdmin: 'EV', listaRename: 'A' },
  ];
  for (const m of MEDICAMENTOS) {
    if (!(await prisma.medicamento.findFirst({ where: { nomeGenerico: m.nomeGenerico } }))) {
      await prisma.medicamento.create({ data: m });
    }
  }

  // 9) Pacientes fictícios -------------------------------------------------
  console.log('> Semeando pacientes fictícios...');
  const NOMES = [
    ['Maria Aparecida Santos', 'F'], ['José Carlos Oliveira', 'M'],
    ['Ana Paula Ferreira', 'F'], ['João Pedro Almeida', 'M'],
    ['Francisca Souza Costa', 'F'], ['Antônio Marcos Ribeiro', 'M'],
    ['Luiza Helena Martins', 'F'], ['Carlos Eduardo Rocha', 'M'],
    ['Fernanda Lima Barbosa', 'F'], ['Paulo Roberto Gomes', 'M'],
    ['Juliana Alves Pereira', 'F'], ['Rafael Augusto Dias', 'M'],
    ['Beatriz Nunes Cardoso', 'F'], ['Marcelo Henrique Teixeira', 'M'],
    ['Patrícia Regina Moreira', 'F'],
  ] as const;
  let criados = 0;
  for (let i = 0; i < NOMES.length; i++) {
    const [nomePaciente, sexo] = NOMES[i];
    const cpf = gerarCpf(`1000000${String(i + 10).padStart(2, '0')}`);
    const ano = 1955 + ((i * 3) % 50);
    const mes = String((i % 12) + 1).padStart(2, '0');
    const dia = String((i % 27) + 1).padStart(2, '0');
    const cpfBi = blind.index(cpf, DEMO_HOSPITAL_ID) as string;
    const created = await prisma.paciente.upsert({
      where: { hospitalId_cpfBi: { hospitalId: DEMO_HOSPITAL_ID, cpfBi } },
      update: {},
      create: {
        nome: nomePaciente,
        cpf,
        cpfBi,
        sexo,
        dataNascimento: new Date(`${ano}-${mes}-${dia}`),
        telefone: `71 9${String(80000000 + i).padStart(8, '0')}`,
        municipio: 'Salvador',
        uf: 'BA',
        hospitalId: DEMO_HOSPITAL_ID,
        status: 'REGISTERED',
      },
    });
    if (created) criados++;
  }
  console.log(`> ${criados} pacientes garantidos.`);

  // Resumo ----------------------------------------------------------------
  const [nSetores, nLeitos, nTipos, nMeds, nPacientes] = await Promise.all([
    prisma.setor.count(),
    prisma.leito.count(),
    prisma.tipoExame.count(),
    prisma.medicamento.count(),
    prisma.paciente.count(),
  ]);
  console.log('> Seed concluído.');
  console.log(
    `  Setores=${nSetores} Leitos=${nLeitos} TiposExame=${nTipos} Medicamentos=${nMeds} Pacientes=${nPacientes}`,
  );
  console.log('  Logins: admin/Admin@123 (SuperAdmin), dr.souza/Medico@123, enf.lima/Enfermeiro@123, gestor/Gestor@123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
