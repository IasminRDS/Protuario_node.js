import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Conexão de banco DEDICADA e INDEPENDENTE para auditoria (F0.3).
 *
 * É um PrismaClient próprio — pool/conexão separados do PrismaService principal.
 * Consequências deliberadas:
 *  - NÃO participa da transação da requisição → um evento gravado aqui SOBREVIVE
 *    ao rollback da transação principal (PostgreSQL não tem autonomous tx;
 *    conexão separada é a forma correta).
 *  - NÃO tem o middleware de tenant ($use) — auditoria não é modelo tenant-scoped.
 *  - NUNCA deve ser usado com $transaction do fluxo principal.
 *
 * Resolve a URL do MESMO modo que o PrismaService principal (env nativo do
 * Prisma / `DATABASE_URL`), garantindo que aponta para o MESMO banco — não usar
 * ConfigService aqui (ele resolveria um `.env` que pode divergir do ambiente).
 */
@Injectable()
export class AuditPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AuditPrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Canal de auditoria autônomo conectado (conexão dedicada).');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
