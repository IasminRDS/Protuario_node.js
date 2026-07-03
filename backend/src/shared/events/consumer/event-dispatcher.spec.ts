import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { DomainEvent } from '../../../modules/events/base.event';
import { EventHandler } from './event-handler.interface';
import { EventHandlerRegistry } from './event-handler.registry';
import { EventDispatcher } from './event-dispatcher';

const evt = (seq: number, eventId = 'e1'): DomainEvent => ({
  eventId,
  type: 'X',
  occurredAt: new Date().toISOString(),
  aggregateId: 'agg-1',
  partitionKey: 'agg-1',
  schemaVersion: 1,
  aggregateSeq: seq,
  payload: {},
});

describe('EventDispatcher', () => {
  describe('CONVERGENT (ordenado por aggregateSeq)', () => {
    const build = (lastSeq: number) => {
      const upsert = jest.fn();
      const tx = {
        consumerOffset: {
          findUnique: jest.fn().mockResolvedValue({ lastSeq }),
          upsert,
        },
      };
      const prisma = {
        $transaction: jest.fn(async (cb: (t: unknown) => Promise<void>) => cb(tx)),
      } as unknown as PrismaService;
      const handle = jest.fn().mockResolvedValue(undefined);
      const handler: EventHandler = {
        consumerName: 'c',
        mode: 'CONVERGENT',
        supports: () => true,
        handle,
      };
      const registry = new EventHandlerRegistry();
      registry.register(handler);
      return { dispatcher: new EventDispatcher(prisma, registry), handle, upsert };
    };

    it('aplica quando seq avança e move o offset', async () => {
      const { dispatcher, handle, upsert } = build(1);
      await dispatcher.dispatch(evt(2));
      expect(handle).toHaveBeenCalled();
      expect(upsert).toHaveBeenCalled();
    });

    it('ignora evento antigo/replay (seq <= lastSeq) — convergente', async () => {
      const { dispatcher, handle, upsert } = build(5);
      await dispatcher.dispatch(evt(3));
      expect(handle).not.toHaveBeenCalled();
      expect(upsert).not.toHaveBeenCalled();
    });
  });

  describe('ONCE (dedup por eventId)', () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'test',
    });

    const build = (createImpl: jest.Mock) => {
      const tx = { processedEvent: { create: createImpl } };
      const prisma = {
        $transaction: jest.fn(async (cb: (t: unknown) => Promise<void>) => cb(tx)),
      } as unknown as PrismaService;
      const handle = jest.fn().mockResolvedValue(undefined);
      const handler: EventHandler = {
        consumerName: 'c',
        mode: 'ONCE',
        supports: () => true,
        handle,
      };
      const registry = new EventHandlerRegistry();
      registry.register(handler);
      return { dispatcher: new EventDispatcher(prisma, registry), handle };
    };

    it('aplica o efeito na primeira vez', async () => {
      const { dispatcher, handle } = build(jest.fn().mockResolvedValue({}));
      await dispatcher.dispatch(evt(1));
      expect(handle).toHaveBeenCalled();
    });

    it('ignora replay/duplicata (P2002) sem lançar', async () => {
      const create = jest.fn().mockRejectedValue(p2002);
      const { dispatcher, handle } = build(create);
      await expect(dispatcher.dispatch(evt(1))).resolves.toBeUndefined();
      expect(handle).not.toHaveBeenCalled();
    });
  });
});
