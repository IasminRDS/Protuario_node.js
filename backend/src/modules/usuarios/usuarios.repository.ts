import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * Repositório de Usuário: encapsula o acesso ao banco. As regras de negócio
 * ficam no Service; aqui só há consultas/persistência (cap. 141).
 */
@Injectable()
export class UsuariosRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: bigint) {
    return this.prisma.usuario.findFirst({
      where: { id, deletedAt: null },
    });
  }

  findByLogin(login: string) {
    return this.prisma.usuario.findFirst({ where: { login } });
  }

  findPerfilById(perfilId: bigint) {
    return this.prisma.perfil.findUnique({ where: { id: perfilId } });
  }

  countAtivosByPerfil(perfilId: bigint) {
    return this.prisma.usuario.count({
      where: { perfilId, deletedAt: null },
    });
  }

  async list(params: {
    skip: number;
    take: number;
    where: Prisma.UsuarioWhereInput;
    orderBy: Prisma.UsuarioOrderByWithRelationInput;
  }) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.usuario.findMany({
        where: params.where,
        skip: params.skip,
        take: params.take,
        orderBy: params.orderBy,
      }),
      this.prisma.usuario.count({ where: params.where }),
    ]);
    return { items, total };
  }

  create(data: Prisma.UsuarioCreateInput) {
    return this.prisma.usuario.create({ data });
  }

  update(id: bigint, data: Prisma.UsuarioUpdateInput) {
    return this.prisma.usuario.update({ where: { id }, data });
  }
}
