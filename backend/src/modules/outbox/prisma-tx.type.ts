import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Cliente Prisma que pode ser a instância base OU o cliente transacional
 * fornecido dentro de $transaction. Ambos expõem os mesmos delegates de modelo.
 */
export type PrismaLike = PrismaClient | Prisma.TransactionClient;
