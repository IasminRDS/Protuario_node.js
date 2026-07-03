import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PacienteRules } from '../../core/domain/entities/paciente.rules';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { currentHospitalId } from '../../shared/tenant/tenant-context';
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto';
import {
  buildPaginatedResult,
  PaginatedResult,
} from '../../shared/dto/paginated-result';
import { CreatePacienteDto } from './dto/create-paciente.dto';
import { UpdatePacienteDto } from './dto/update-paciente.dto';
import { toPacienteView, PacienteView } from './paciente.view';
import { PacientesRepository } from './pacientes.repository';

@Injectable()
export class PacientesService {
  constructor(
    private readonly repo: PacientesRepository,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(
    query: PaginationQueryDto,
    filtros: { nome?: string; cpf?: string },
  ): Promise<PaginatedResult<PacienteView>> {
    const hospitalId = currentHospitalId();
    const where: Prisma.PacienteWhereInput = {
      deletedAt: null,
      // Isolamento por tenant: só pacientes do hospital do usuário.
      ...(hospitalId ? { hospitalId } : {}),
      ...(filtros.nome
        ? { nome: { contains: filtros.nome, mode: 'insensitive' } }
        : {}),
      ...(filtros.cpf
        ? { cpf: PacienteRules.normalizarDocumento(filtros.cpf) ?? filtros.cpf }
        : {}),
    };

    const orderBy = {
      [query.sort ?? 'nome']: query.order,
    } as Prisma.PacienteOrderByWithRelationInput;

    const { items, total } = await this.repo.list({
      skip: query.skip,
      take: query.pageSize,
      where,
      orderBy,
    });

    return buildPaginatedResult(
      items.map(toPacienteView),
      total,
      query.page,
      query.pageSize,
    );
  }

  async buscarPorId(id: string): Promise<PacienteView> {
    const paciente = await this.repo.findById(BigInt(id));
    if (!paciente) {
      throw new NotFoundException('Paciente não encontrado.');
    }
    return toPacienteView(paciente);
  }

  async criar(dto: CreatePacienteDto, autorId: string): Promise<PacienteView> {
    const cpf = PacienteRules.normalizarDocumento(dto.cpf);
    const cns = PacienteRules.normalizarDocumento(dto.cns);

    // Invariantes de domínio (RN-006).
    PacienteRules.garantirIdentificacao(cpf, cns);
    const nascimento = new Date(dto.dataNascimento);
    PacienteRules.garantirNascimentoValido(nascimento);

    // RN-007: impedir cadastro duplicado.
    const existente = await this.repo.findByDocumento(cpf, cns);
    if (existente) {
      throw new ConflictException(
        'Já existe paciente com este CPF ou CNS.',
      );
    }

    const criado = await this.repo.create({
      nome: dto.nome,
      cpf,
      cns,
      sexo: dto.sexo,
      dataNascimento: nascimento,
      telefone: dto.telefone,
      email: dto.email,
      endereco: dto.endereco,
      hospitalId: currentHospitalId(), // tenant do usuário
      createdBy: BigInt(autorId),
    });

    await this.auditoria.registrar({
      usuarioId: autorId,
      modulo: 'PACIENTES',
      operacao: 'CRIAR',
      objeto: criado.id.toString(),
      resultado: 'SUCESSO',
    });

    return toPacienteView(criado);
  }

  async atualizar(
    id: string,
    dto: UpdatePacienteDto,
    autorId: string,
  ): Promise<PacienteView> {
    await this.buscarPorId(id);

    const cpf =
      dto.cpf !== undefined
        ? PacienteRules.normalizarDocumento(dto.cpf)
        : undefined;
    const cns =
      dto.cns !== undefined
        ? PacienteRules.normalizarDocumento(dto.cns)
        : undefined;

    // RN-007: se documentos mudaram, checar duplicidade em outro paciente.
    if (cpf !== undefined || cns !== undefined) {
      const conflito = await this.repo.findByDocumento(cpf ?? null, cns ?? null);
      if (conflito && conflito.id.toString() !== id) {
        throw new ConflictException('Já existe paciente com este CPF ou CNS.');
      }
    }

    const data: Prisma.PacienteUpdateInput = {
      ...(dto.nome !== undefined ? { nome: dto.nome } : {}),
      ...(cpf !== undefined ? { cpf } : {}),
      ...(cns !== undefined ? { cns } : {}),
      ...(dto.sexo !== undefined ? { sexo: dto.sexo } : {}),
      ...(dto.dataNascimento !== undefined
        ? { dataNascimento: new Date(dto.dataNascimento) }
        : {}),
      ...(dto.telefone !== undefined ? { telefone: dto.telefone } : {}),
      ...(dto.email !== undefined ? { email: dto.email } : {}),
      ...(dto.endereco !== undefined ? { endereco: dto.endereco } : {}),
      updatedBy: BigInt(autorId),
    };

    const atualizado = await this.repo.update(BigInt(id), data);

    await this.auditoria.registrar({
      usuarioId: autorId,
      modulo: 'PACIENTES',
      operacao: 'ATUALIZAR',
      objeto: id,
      resultado: 'SUCESSO',
    });

    return toPacienteView(atualizado);
  }

  /**
   * RN-009: paciente com atendimentos NÃO pode ser excluído fisicamente.
   * Aplicamos exclusão lógica (soft delete) preservando o histórico clínico.
   */
  async remover(id: string, autorId: string): Promise<void> {
    const paciente = await this.repo.findById(BigInt(id));
    if (!paciente) {
      throw new NotFoundException('Paciente não encontrado.');
    }

    // RN-009: com ou sem histórico, nunca há exclusão física — sempre soft delete.
    // O histórico clínico (atendimentos/prontuário) permanece preservado.
    const atendimentos = await this.repo.countAtendimentos(paciente.id);
    await this.repo.update(paciente.id, {
      deletedAt: new Date(),
      deletedBy: BigInt(autorId),
    });

    await this.auditoria.registrar({
      usuarioId: autorId,
      modulo: 'PACIENTES',
      operacao: 'EXCLUSAO_LOGICA',
      objeto: id,
      resultado: atendimentos > 0 ? 'COM_HISTORICO' : 'SEM_HISTORICO',
    });
  }
}
