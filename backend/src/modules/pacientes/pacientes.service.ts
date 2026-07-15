import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PacienteRules } from '../../core/domain/entities/paciente.rules';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { currentHospitalId, currentTx } from '../../shared/tenant/tenant-context';
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto';
import {
  buildPaginatedResult,
  PaginatedResult,
} from '../../shared/dto/paginated-result';
import { CreatePacienteDto } from './dto/create-paciente.dto';
import { UpdatePacienteDto } from './dto/update-paciente.dto';
import {
  toPacienteView,
  PacienteView,
  PacienteConsistencyState,
} from './paciente.view';
import { PacientesRepository } from './pacientes.repository';
import { BlindIndexService } from '../../infra/crypto/blind-index';

@Injectable()
export class PacientesService {
  constructor(
    private readonly repo: PacientesRepository,
    private readonly auditoria: AuditoriaService,
    private readonly prisma: PrismaService,
    private readonly blind: BlindIndexService,
  ) {}

  /**
   * F0.1: executa `fn` numa ÚNICA transação. Se já existe uma tx de request
   * (currentTx — fase F0.2), reusa-a (evita nested tx); senão abre a própria.
   * Mutação + auditoria de sucesso rodam aqui juntas (atomicidade — I1).
   */
  private runInTx<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    const tx = currentTx();
    return tx ? fn(tx) : this.prisma.$transaction(fn);
  }

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
      // Busca por CPF é por IGUALDADE via blind index (cpf é ciphertext).
      ...(filtros.cpf
        ? { cpfBi: this.blind.index(filtros.cpf, hospitalId) ?? '__no_match__' }
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

    // Resolve o estado de consistência em lote (1 query só p/ toda a página).
    const validos = new Set(
      await this.repo.existingHospitalIds(
        items
          .map((p) => p.hospitalId)
          .filter((h): h is string => h != null),
      ),
    );
    const stateOf = (h: string | null): PacienteConsistencyState =>
      h == null ? 'QUARENTENA' : validos.has(h) ? 'VALIDO' : 'INCONSISTENTE';

    return buildPaginatedResult(
      items.map((p) => toPacienteView(p, stateOf(p.hospitalId))),
      total,
      query.page,
      query.pageSize,
    );
  }

  /**
   * Estado de consistência (§2.2): QUARENTENA (sem vínculo), INCONSISTENTE
   * (vínculo não-resolvível) ou VALIDO. Derivado do backend — nunca inferido na UI.
   */
  private async consistencyStateFor(
    hospitalId: string | null,
  ): Promise<PacienteConsistencyState> {
    if (hospitalId == null) return 'QUARENTENA';
    const validos = await this.repo.existingHospitalIds([hospitalId]);
    return validos.length > 0 ? 'VALIDO' : 'INCONSISTENTE';
  }

  async buscarPorId(id: string): Promise<PacienteView> {
    const paciente = await this.repo.findById(BigInt(id));
    if (!paciente) {
      throw new NotFoundException('Paciente não encontrado.');
    }
    return toPacienteView(
      paciente,
      await this.consistencyStateFor(paciente.hospitalId),
    );
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

    // F0.1: create + auditoria de sucesso na MESMA transação (atômico).
    const criado = await this.runInTx(async (tx) => {
      const c = await this.repo.create(
        {
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
        },
        tx,
      );
      await this.auditoria.registrarTx(tx, {
        usuarioId: autorId,
        modulo: 'PACIENTES',
        operacao: 'CRIAR',
        entity: 'paciente',
        entityId: c.id.toString(),
        objeto: c.id.toString(),
        resultado: 'SUCESSO',
      });
      return c;
    });

    return toPacienteView(
      criado,
      await this.consistencyStateFor(criado.hospitalId),
    );
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

    const atualizado = await this.runInTx(async (tx) => {
      const u = await this.repo.update(BigInt(id), data, tx);
      await this.auditoria.registrarTx(tx, {
        usuarioId: autorId,
        modulo: 'PACIENTES',
        operacao: 'ATUALIZAR',
        entity: 'paciente',
        entityId: id,
        objeto: id,
        resultado: 'SUCESSO',
      });
      return u;
    });

    return toPacienteView(
      atualizado,
      await this.consistencyStateFor(atualizado.hospitalId),
    );
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
    await this.runInTx(async (tx) => {
      await this.repo.update(
        paciente.id,
        { deletedAt: new Date(), deletedBy: BigInt(autorId) },
        tx,
      );
      await this.auditoria.registrarTx(tx, {
        usuarioId: autorId,
        modulo: 'PACIENTES',
        operacao: 'EXCLUSAO_LOGICA',
        entity: 'paciente',
        entityId: id,
        objeto: id,
        resultado: atendimentos > 0 ? 'COM_HISTORICO' : 'SEM_HISTORICO',
      });
    });
  }
}
