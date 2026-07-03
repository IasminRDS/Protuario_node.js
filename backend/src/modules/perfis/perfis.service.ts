import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CreatePerfilDto } from './dto/create-perfil.dto';

/** Módulo de Perfis (cap. 43): define os grupos de permissões (RBAC). */
@Injectable()
export class PerfisService {
  constructor(private readonly prisma: PrismaService) {}

  listar() {
    return this.prisma.perfil.findMany({ orderBy: { nome: 'asc' } });
  }

  criar(dto: CreatePerfilDto) {
    return this.prisma.perfil.create({ data: dto });
  }
}
