import { ConfigService } from '@nestjs/config';
import { EventBus } from '../../shared/events/event-bus';
import { ClaimedOutboxRow, OutboxService } from './outbox.service';
import { OutboxPublisherWorker } from './outbox-publisher.worker';

const claimedRow = (over: Partial<ClaimedOutboxRow> = {}): ClaimedOutboxRow => ({
  id: '018f-eventid',
  aggregate_id: 'cid-1',
  type: 'CidadaoCreated',
  partition_key: 'cid-1',
  attempts: 0,
  payload: {
    eventId: '018f-eventid',
    type: 'CidadaoCreated',
    aggregateId: 'cid-1',
    partitionKey: 'cid-1',
    occurredAt: new Date().toISOString(),
    schemaVersion: 1,
    payload: { cidadaoId: 'cid-1' },
  },
  ...over,
});

describe('OutboxPublisherWorker', () => {
  let outbox: jest.Mocked<OutboxService>;
  let bus: jest.Mocked<EventBus>;
  let worker: OutboxPublisherWorker;

  const config = {
    get: (_k: string, def?: unknown) => def,
  } as unknown as ConfigService;

  beforeEach(() => {
    outbox = {
      reapStale: jest.fn().mockResolvedValue(0),
      claimBatch: jest.fn(),
      markSent: jest.fn().mockResolvedValue(undefined),
      markRetryOrFailed: jest.fn().mockResolvedValue(undefined),
      purgeSent: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<OutboxService>;
    bus = { publish: jest.fn() } as unknown as jest.Mocked<EventBus>;
    worker = new OutboxPublisherWorker(outbox, bus, config);
  });

  it('reivindica (claim atômico), publica no tópico do MPI e marca SENT', async () => {
    outbox.claimBatch.mockResolvedValue([claimedRow()]);
    bus.publish.mockResolvedValue(undefined);

    await worker.tick();

    expect(outbox.reapStale).toHaveBeenCalled(); // crash-safety a cada ciclo
    expect(bus.publish).toHaveBeenCalledWith(
      'snpe.mpi',
      expect.objectContaining({ eventId: '018f-eventid', partitionKey: 'cid-1' }),
    );
    expect(outbox.markSent).toHaveBeenCalledWith('018f-eventid');
    expect(outbox.markRetryOrFailed).not.toHaveBeenCalled();
  });

  it('não perde evento: falha na publicação agenda retry (não marca SENT)', async () => {
    outbox.claimBatch.mockResolvedValue([claimedRow()]);
    bus.publish.mockRejectedValue(new Error('broker indisponível'));

    await worker.tick();

    expect(outbox.markSent).not.toHaveBeenCalled();
    expect(outbox.markRetryOrFailed).toHaveBeenCalledWith(
      '018f-eventid',
      0,
      10,
      'broker indisponível',
    );
  });
});
