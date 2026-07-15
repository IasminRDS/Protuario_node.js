import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { BlindIndexService } from '../../infra/crypto/blind-index';
import { currentTx, currentHospitalId } from '../../shared/tenant/tenant-context';

@Injectable()
export class PacientesRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blind: BlindIndexService,
  ) {}

  /**
   * Cliente de banco da requisição (F0.2): reusa a transação do request quando
   * existe (`currentTx`), senão o Prisma principal. Garante que TODA operação da
   * requisição use a MESMA conexão/transação — read-your-writes + 1 conexão por
   * request (evita 2ª conexão paralela e a consequente exaustão de pool).
   */
  private db(): Prisma.TransactionClient | PrismaService {
    return currentTx() ?? this.prisma;
  }

  findById(id: bigint) {
    return this.db().paciente.findFirst({ where: { id, deletedAt: null } });
  }

  /**
   * Busca duplicidade por CPF ou CNS (RN-007) via BLIND INDEX (cpf/cns em si são
   * ciphertext não-determinístico). Escopado ao hospital corrente. Inclui
   * registros já removidos.
   */
  findByDocumento(cpf: string | null, cns: string | null) {
    const tenant = currentHospitalId();
    const cpfBi = this.blind.index(cpf, tenant);
    const cnsBi = this.blind.index(cns, tenant);
    const or: Prisma.PacienteWhereInput[] = [];
    if (cpfBi) or.push({ cpfBi });
    if (cnsBi) or.push({ cnsBi });
    if (or.length === 0) return Promise.resolve(null);
    return this.db().paciente.findFirst({ where: { OR: or } });
  }

  countAtendimentos(pacienteId: bigint) {
    return this.db().atendimento.count({ where: { pacienteId } });
  }

  /**
   * Retorna, dentre os ids informados, aqueles que correspondem a um hospital
   * EXISTENTE. Usado para determinar quarentena (vínculo não-resolvível).
   */
  async existingHospitalIds(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const rows = await this.db().hospital.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async list(params: {
    skip: number;
    take: number;
    where: Prisma.PacienteWhereInput;
    orderBy: Prisma.PacienteOrderByWithRelationInput;
  }) {
    const db = this.db();
    const [items, total] = await Promise.all([
      db.paciente.findMany({
        where: params.where,
        skip: params.skip,
        take: params.take,
        orderBy: params.orderBy,
      }),
      db.paciente.count({ where: params.where }),
    ]);
    return { items, total };
  }

  create(
    data: Prisma.PacienteCreateInput,
    client: Prisma.TransactionClient = this.db() as Prisma.TransactionClient,
  ) {
    return client.paciente.create({ data });
  }

  update(
    id: bigint,
    data: Prisma.PacienteUpdateInput,
    client: Prisma.TransactionClient = this.db() as Prisma.TransactionClient,
  ) {
    return client.paciente.update({ where: { id }, data });
  }
}
