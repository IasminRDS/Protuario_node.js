import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Camada de acesso ao banco (abstração sobre PostgreSQL).
 * As regras de negócio nunca acessam o PrismaClient diretamente — sempre via
 * Repositories (cap. 141: Controller -> Service -> Repository -> Prisma).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
