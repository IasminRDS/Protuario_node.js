import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface CreateHospitalInput {
  nome: string;
  cnes?: string;
  uf?: string;
}

@Injectable()
export class HospitalsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.hospital.findMany({ orderBy: { nome: 'asc' } });
  }

  create(input: CreateHospitalInput) {
    return this.prisma.hospital.create({
      data: { id: uuidv7(), nome: input.nome, cnes: input.cnes, uf: input.uf },
    });
  }
}
