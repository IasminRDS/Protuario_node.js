import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainEvent } from '../../../modules/events/base.event';
import { TOPIC_MPI } from '../../../modules/events/event-types';
import { logJson } from '../../observability/structured-logger';
import { EventDispatcher } from './event-dispatcher';

/**
 * Consumidor Kafka (carregado sob demanda, como o producer).
 * Roteia cada mensagem ao EventDispatcher.
 */
@Injectable()
export class KafkaEventConsumer implements OnModuleInit, OnModuleDestroy {
  private consumer: {
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    subscribe: (args: unknown) => Promise<void>;
    run: (args: unknown) => Promise<void>;
  } | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly dispatcher: EventDispatcher,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.get<boolean>('KAFKA_ENABLED')) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requireFn = eval('require') as (m: string) => any;

    type KafkaConsumerLike = {
      connect: () => Promise<void>;
      disconnect: () => Promise<void>;
      subscribe: (args: unknown) => Promise<void>;
      run: (args: unknown) => Promise<void>;
    };

    let Kafka: new (opts: unknown) => {
      consumer: (opts: unknown) => KafkaConsumerLike;
    };

    try {
      ({ Kafka } = requireFn('kafkajs'));
    } catch {
      throw new Error("KAFKA_ENABLED=true mas 'kafkajs' não está instalado.");
    }

    const kafka = new Kafka({
      clientId: this.config.get<string>('KAFKA_CLIENT_ID', 'snpe-mpi'),
      brokers: this.config
        .get<string>('KAFKA_BROKERS', 'localhost:9092')
        .split(',')
        .map((b) => b.trim()),
    });

    this.consumer = kafka.consumer({ groupId: 'snpe-consumers' });

    await this.consumer.connect();
    await this.consumer.subscribe({ topic: TOPIC_MPI, fromBeginning: true });

    await this.consumer.run({
      eachMessage: async ({ message }: any) => {
        const raw = message.value?.toString();
        if (!raw) return;

        const event = JSON.parse(raw) as DomainEvent;

        await this.dispatcher.dispatch(event);
      },
    });

    logJson('info', 'KafkaEventConsumer', 'consumer.started', {
      topic: TOPIC_MPI,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer?.disconnect();
  }
}