import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

/**
 * Seed inicial:
 *  - Perfis padrão citados no documento (cap. 69/114): Administrador, Medico,
 *    Enfermeiro, Farmaceutico, Recepcao, Gestor.
 *  - Usuário administrador inicial (senha em hash Argon2 — nunca texto puro).
 */
const PERFIS = [
  { nome: 'SuperAdmin', descricao: 'Operador da plataforma (cross-tenant, ignora hospital)' },
  { nome: 'Administrador', descricao: 'Administração completa dentro do hospital (tenant)' },
  { nome: 'Medico', descricao: 'Atendimento clínico, prescrições e exames' },
  { nome: 'Enfermeiro', descricao: 'Triagem e vacinação' },
  { nome: 'Farmaceutico', descricao: 'Estoque e medicamentos' },
  { nome: 'Recepcao', descricao: 'Cadastro de pacientes e agenda' },
  { nome: 'Gestor', descricao: 'Relatórios e auditoria (leitura)' },
];

async function main() {
  console.log('> Semeando perfis...');
  for (const perfil of PERFIS) {
    await prisma.perfil.upsert({
      where: { nome: perfil.nome },
      update: { descricao: perfil.descricao },
      create: perfil,
    });
  }

  // Bootstrap = SUPER_ADMIN: cross-tenant, sem hospitalId, imune ao isolamento.
  const admin = await prisma.perfil.findUniqueOrThrow({
    where: { nome: 'SuperAdmin' },
  });

  const login = process.env.SEED_ADMIN_LOGIN ?? 'admin';
  const senhaPlana = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123';
  const nome = process.env.SEED_ADMIN_NOME ?? 'Administrador do Sistema';

  const existente = await prisma.usuario.findUnique({ where: { login } });
  if (!existente) {
    console.log(`> Criando usuário administrador "${login}"...`);
    await prisma.usuario.create({
      data: {
        nome,
        login,
        senha: await argon2.hash(senhaPlana),
        perfilId: admin.id,
        ativo: true,
      },
    });
  } else {
    console.log(`> Usuário "${login}" já existe — mantido.`);
  }

  console.log('> Seed concluído.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
