import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isSuperAdmin } from '../../shared/rbac/permissions';
import { PasswordService } from '../../infra/auth/password.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto';
import {
  buildPaginatedResult,
  PaginatedResult,
} from '../../shared/dto/paginated-result';
import { DomainError } from '../../shared/errors/domain-error';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { toUsuarioView, UsuarioView } from './usuario.view';
import { UsuariosRepository } from './usuarios.repository';

@Injectable()
export class UsuariosService {
  constructor(
    private readonly repo: UsuariosRepository,
    private readonly passwords: PasswordService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(
    query: PaginationQueryDto,
    filtros: { nome?: string; ativo?: string },
  ): Promise<PaginatedResult<UsuarioView>> {
    const where: Prisma.UsuarioWhereInput = {
      deletedAt: null,
      ...(filtros.nome
        ? { nome: { contains: filtros.nome, mode: 'insensitive' } }
        : {}),
      ...(filtros.ativo !== undefined
        ? { ativo: filtros.ativo === 'true' }
        : {}),
    };

    const orderBy = {
      [query.sort ?? 'nome']: query.order,
    } as Prisma.UsuarioOrderByWithRelationInput;

    const { items, total } = await this.repo.list({
      skip: query.skip,
      take: query.pageSize,
      where,
      orderBy,
    });

    return buildPaginatedResult(
      items.map(toUsuarioView),
      total,
      query.page,
      query.pageSize,
    );
  }

  async buscarPorId(id: string): Promise<UsuarioView> {
    const usuario = await this.repo.findById(BigInt(id));
    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    return toUsuarioView(usuario);
  }

  async criar(dto: CreateUsuarioDto, autorId: string): Promise<UsuarioView> {
    // RN-001: login único.
    const existente = await this.repo.findByLogin(dto.login);
    if (existente) {
      throw new ConflictException('Login já cadastrado.');
    }

    // RN-002: perfil obrigatório e existente.
    const perfil = await this.repo.findPerfilById(BigInt(dto.perfilId));
    if (!perfil) {
      throw new BadRequestException('Perfil informado não existe.');
    }

    // Isolamento multi-tenant: todo usuário — exceto SUPER_ADMIN — precisa
    // estar vinculado a um hospital, senão ficaria bloqueado nas rotas clínicas
    // (TenantContextError). O SUPER_ADMIN é cross-tenant e não tem hospitalId.
    if (!isSuperAdmin(perfil.nome) && !dto.hospitalId) {
      throw new BadRequestException(
        'hospitalId é obrigatório para este perfil (somente SuperAdmin é cross-tenant).',
      );
    }

    const criado = await this.repo.create({
      nome: dto.nome,
      login: dto.login,
      senha: await this.passwords.hash(dto.senha),
      email: dto.email,
      ativo: dto.ativo ?? true,
      hospitalId: isSuperAdmin(perfil.nome) ? null : dto.hospitalId,
      createdBy: BigInt(autorId),
      perfil: { connect: { id: BigInt(dto.perfilId) } }, // RN-002: perfil obrigatório
    });

    await this.auditoria.registrar({
      usuarioId: autorId,
      modulo: 'USUARIOS',
      operacao: 'CRIAR',
      objeto: criado.id.toString(),
      resultado: 'SUCESSO',
    });

    return toUsuarioView(criado);
  }

  async atualizar(
    id: string,
    dto: UpdateUsuarioDto,
    autorId: string,
  ): Promise<UsuarioView> {
    await this.buscarPorId(id); // garante existência

    const data: Prisma.UsuarioUpdateInput = {
      ...(dto.nome !== undefined ? { nome: dto.nome } : {}),
      ...(dto.email !== undefined ? { email: dto.email } : {}),
      ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
      ...(dto.perfilId !== undefined
        ? { perfil: { connect: { id: BigInt(dto.perfilId) } } }
        : {}),
      updatedBy: BigInt(autorId),
    };

    if (dto.login !== undefined) {
      const outro = await this.repo.findByLogin(dto.login);
      if (outro && outro.id.toString() !== id) {
        throw new ConflictException('Login já cadastrado.');
      }
      data.login = dto.login;
    }

    const atualizado = await this.repo.update(BigInt(id), data);

    await this.auditoria.registrar({
      usuarioId: autorId,
      modulo: 'USUARIOS',
      operacao: 'ATUALIZAR',
      objeto: id,
      resultado: 'SUCESSO',
    });

    return toUsuarioView(atualizado);
  }

  /**
   * RN-005: usuários com histórico não são removidos fisicamente — soft delete.
   * Além disso, impede remover o último Administrador ativo (trava operacional).
   */
  async remover(id: string, autorId: string): Promise<void> {
    const usuario = await this.repo.findById(BigInt(id));
    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const ativosNoPerfil = await this.repo.countAtivosByPerfil(usuario.perfilId);
    if (ativosNoPerfil <= 1) {
      // Salvaguarda: não deixar um perfil crítico (ex.: Administrador) sem membros.
      throw new DomainError(
        'ULTIMO_USUARIO_PERFIL',
        'Não é possível remover o único usuário ativo deste perfil.',
      );
    }

    await this.repo.update(BigInt(id), {
      deletedAt: new Date(),
      deletedBy: BigInt(autorId),
      ativo: false,
      refreshTokenHash: null,
    });

    await this.auditoria.registrar({
      usuarioId: autorId,
      modulo: 'USUARIOS',
      operacao: 'EXCLUSAO_LOGICA',
      objeto: id,
      resultado: 'SUCESSO',
    });
  }
}
