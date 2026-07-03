import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class PacientesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: bigint) {
    return this.prisma.paciente.findFirst({ where: { id, deletedAt: null } });
  }

  /** Busca duplicidade por CPF ou CNS (RN-007), inclusive registros já removidos. */
  findByDocumento(cpf: string | null, cns: string | null) {
    const or: Prisma.PacienteWhereInput[] = [];
    if (cpf) or.push({ cpf });
    if (cns) or.push({ cns });
    if (or.length === 0) return Promise.resolve(null);
    return this.prisma.paciente.findFirst({ where: { OR: or } });
  }

  countAtendimentos(pacienteId: bigint) {
    return this.prisma.atendimento.count({ where: { pacienteId } });
  }

  async list(params: {
    skip: number;
    take: number;
    where: Prisma.PacienteWhereInput;
    orderBy: Prisma.PacienteOrderByWithRelationInput;
  }) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.paciente.findMany({
        where: params.where,
        skip: params.skip,
        take: params.take,
        orderBy: params.orderBy,
      }),
      this.prisma.paciente.count({ where: params.where }),
    ]);
    return { items, total };
  }

  create(data: Prisma.PacienteCreateInput) {
    return this.prisma.paciente.create({ data });
  }

  update(id: bigint, data: Prisma.PacienteUpdateInput) {
    return this.prisma.paciente.update({ where: { id }, data });
  }
}
