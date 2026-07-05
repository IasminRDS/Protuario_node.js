import { Injectable, NotFoundException } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface CreateHospitalInput {
  nome: string;
  cnes?: string;
  uf?: string;
}

export interface UpdateHospitalInput {
  nome?: string;
  cnes?: string;
  uf?: string;
  ativo?: boolean;
}

/**
 * Gestão de hospitais (tenants). Só o SUPER_ADMIN chega aqui (RBAC:
 * HOSPITAL_MANAGE). Hospital NÃO é modelo tenant-scoped — é a raiz do tenant,
 * portanto estas queries não passam pelo isolamento por hospitalId.
 */
@Injectable()
export class HospitalsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.hospital.findMany({ orderBy: { nome: 'asc' } });
  }

  async findById(id: string) {
    const hospital = await this.prisma.hospital.findUnique({ where: { id } });
    if (!hospital) {
      throw new NotFoundException('Hospital não encontrado.');
    }
    return hospital;
  }

  create(input: CreateHospitalInput) {
    return this.prisma.hospital.create({
      data: { id: uuidv7(), nome: input.nome, cnes: input.cnes, uf: input.uf },
    });
  }

  async update(id: string, input: UpdateHospitalInput) {
    await this.findById(id); // 404 explícito antes do update
    return this.prisma.hospital.update({
      where: { id },
      data: {
        ...(input.nome !== undefined ? { nome: input.nome } : {}),
        ...(input.cnes !== undefined ? { cnes: input.cnes } : {}),
        ...(input.uf !== undefined ? { uf: input.uf } : {}),
        ...(input.ativo !== undefined ? { ativo: input.ativo } : {}),
      },
    });
  }

  /**
   * Desativação lógica (ativo=false). Não removemos fisicamente: destruiria a
   * integridade referencial de pacientes/atendimentos vinculados ao tenant.
   */
  async deactivate(id: string) {
    await this.findById(id);
    return this.prisma.hospital.update({
      where: { id },
      data: { ativo: false },
    });
  }
}
