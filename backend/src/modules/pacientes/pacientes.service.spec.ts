import { ConflictException, NotFoundException } from '@nestjs/common';
import { Paciente } from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { DomainError } from '../../shared/errors/domain-error';
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto';
import { CreatePacienteDto } from './dto/create-paciente.dto';
import { PacientesRepository } from './pacientes.repository';
import { PacientesService } from './pacientes.service';

const fakePaciente = (over: Partial<Paciente> = {}): Paciente =>
  ({
    id: 1n,
    nome: 'Maria',
    cpf: '12345678900',
    cns: null,
    sexo: 'F',
    dataNascimento: new Date('1990-01-01'),
    telefone: null,
    email: null,
    endereco: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    deletedBy: null,
    ...over,
  }) as Paciente;

describe('PacientesService', () => {
  let service: PacientesService;
  let repo: jest.Mocked<PacientesRepository>;
  let auditoria: jest.Mocked<AuditoriaService>;

  beforeEach(() => {
    repo = {
      findById: jest.fn(),
      findByDocumento: jest.fn(),
      countAtendimentos: jest.fn(),
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      existingHospitalIds: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<PacientesRepository>;

    auditoria = {
      registrar: jest.fn().mockResolvedValue(undefined),
      registrarTx: jest.fn().mockResolvedValue('evt-uuid'),
    } as unknown as jest.Mocked<AuditoriaService>;

    // Prisma mock: $transaction executa o callback com um tx fake (a atomicidade
    // real é validada em e2e contra Postgres; aqui só validamos o fluxo).
    const prisma = {
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn({})),
    } as unknown as import('../../infra/prisma/prisma.service').PrismaService;

    service = new PacientesService(repo, auditoria, prisma);
  });

  const dto: CreatePacienteDto = {
    nome: 'Maria',
    cpf: '123.456.789-00',
    sexo: 'F',
    dataNascimento: '1990-01-01',
  };

  it('cadastra paciente normalizando o CPF e auditando (RN-006/007)', async () => {
    repo.findByDocumento.mockResolvedValue(null);
    repo.create.mockResolvedValue(fakePaciente());

    const view = await service.criar(dto, '10');

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ cpf: '12345678900', createdBy: 10n }),
      expect.anything(), // tx client (F0.1)
    );
    expect(auditoria.registrarTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ modulo: 'PACIENTES', operacao: 'CRIAR' }),
    );
    expect(view.id).toBe('1');
    expect(view.cpf).toBe('12345678900');
  });

  it('rejeita cadastro sem CPF nem CNS (RN-006)', async () => {
    await expect(
      service.criar({ ...dto, cpf: undefined, cns: undefined }, '10'),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('rejeita duplicidade de documento (RN-007)', async () => {
    repo.findByDocumento.mockResolvedValue(fakePaciente({ id: 2n }));
    await expect(service.criar(dto, '10')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('buscarPorId lança NotFound quando inexistente', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(service.buscarPorId('99')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('remover aplica soft delete preservando histórico (RN-009)', async () => {
    repo.findById.mockResolvedValue(fakePaciente());
    repo.countAtendimentos.mockResolvedValue(3);
    repo.update.mockResolvedValue(fakePaciente({ deletedAt: new Date() }));

    await service.remover('1', '10');

    expect(repo.update).toHaveBeenCalledWith(
      1n,
      expect.objectContaining({ deletedBy: 10n }),
      expect.anything(), // tx client (F0.1)
    );
    // Nunca chama delete físico: só update com deletedAt.
    expect(auditoria.registrarTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ operacao: 'EXCLUSAO_LOGICA' }),
    );
  });

  it('listar retorna estrutura paginada', async () => {
    repo.list.mockResolvedValue({ items: [fakePaciente()], total: 1 });
    const query = Object.assign(new PaginationQueryDto(), {
      page: 1,
      pageSize: 20,
      order: 'asc',
    });

    const result = await service.listar(query, {});

    expect(result.meta.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('1');
  });
});
