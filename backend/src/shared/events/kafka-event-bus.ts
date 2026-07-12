import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainEvent } from '../../modules/events/base.event';
import { logJson } from '../observability/structured-logger';
import { EventBus } from './event-bus';

@Injectable()
export class KafkaEventBus implements EventBus, OnModuleInit, OnModuleDestroy {
  private producer: {
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    send: (args: unknown) => Promise<unknown>;
  } | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.get<boolean>('KAFKA_ENABLED')) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requireFn = eval('require') as (m: string) => any;

    type KafkaProducerLike = {
      connect: () => Promise<void>;
      disconnect: () => Promise<void>;
      send: (args: unknown) => Promise<unknown>;
    };

    let Kafka: new (opts: unknown) => {
      producer: (opts?: unknown) => KafkaProducerLike;
    };

    try {
      ({ Kafka } = requireFn('kafkajs'));
    } catch {
      throw new Error(
        "KAFKA_ENABLED=true mas 'kafkajs' não está instalado. Rode `npm i kafkajs`.",
      );
    }

    const kafka = new Kafka({
      clientId: this.config.get<string>('KAFKA_CLIENT_ID', 'snpe-mpi'),
      brokers: this.config
        .get<string>('KAFKA_BROKERS', 'localhost:9092')
        .split(',')
        .map((b) => b.trim()),
    });

    this.producer = kafka.producer({
      idempotent: true,
      maxInFlightRequests: 1,
      allowAutoTopicCreation: true, // 1º evento cria o tópico (dev/homolog)
      retry: { retries: 10 },
    });

    // Resiliência: uma indisponibilidade do Kafka NÃO pode derrubar o boot da
    // API. Se a conexão inicial falhar, loga e segue — o Outbox reprocessa os
    // eventos quando o broker voltar (entrega ao menos uma vez, sem perda).
    try {
      await this.producer.connect();
      logJson('info', 'KafkaEventBus', 'producer.connected');
    } catch (err) {
      logJson('error', 'KafkaEventBus', 'producer.connect.failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.producer?.disconnect();
  }

  async publish(topic: string, event: DomainEvent): Promise<void> {
    if (!this.producer) {
      throw new Error('Kafka producer não inicializado.');
    }

    await this.producer.send({
      topic,
      acks: -1,
      messages: [
        {
          key: event.partitionKey,
          value: JSON.stringify(event),
          headers: {
            eventId: event.eventId,
            type: event.type,
            traceId: event.traceId ?? '',
          },
        },
      ],
    });

    logJson('info', 'KafkaEventBus', 'event.published', {
      traceId: event.traceId,
      topic,
      key: event.partitionKey,
      eventId: event.eventId,
      type: event.type,
    });
  }
}