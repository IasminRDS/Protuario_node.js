import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { IdempotencyService } from './idempotency.service';

describe('IdempotencyService', () => {
  const p2002 = new Prisma.PrismaClientKnownRequestError('dup', {
    code: 'P2002',
    clientVersion: 'test',
  });

  it('processa uma vez e executa o handler (retorna true)', async () => {
    const create = jest.fn();
    const prisma = {
      $transaction: jest.fn(async (cb: (tx: unknown) => Promise<void>) =>
        cb({ processedEvent: { create } }),
      ),
    } as unknown as PrismaService;
    const service = new IdempotencyService(prisma);
    const handler = jest.fn().mockResolvedValue(undefined);

    const processed = await service.runOnce('consumerA', 'evt-1', handler);

    expect(processed).toBe(true);
    expect(create).toHaveBeenCalled();
    expect(handler).toHaveBeenCalled();
  });

  it('ignora duplicata (P2002 -> retorna false, sem efeito)', async () => {
    const prisma = {
      $transaction: jest.fn().mockRejectedValue(p2002),
    } as unknown as PrismaService;
    const service = new IdempotencyService(prisma);
    const handler = jest.fn();

    const processed = await service.runOnce('consumerA', 'evt-1', handler);

    expect(processed).toBe(false);
  });

  it('propaga erros que não são de duplicidade', async () => {
    const prisma = {
      $transaction: jest.fn().mockRejectedValue(new Error('db down')),
    } as unknown as PrismaService;
    const service = new IdempotencyService(prisma);

    await expect(
      service.runOnce('c', 'e', jest.fn()),
    ).rejects.toThrow('db down');
  });
});
