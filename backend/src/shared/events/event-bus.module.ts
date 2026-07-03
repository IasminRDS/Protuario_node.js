import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventDispatcher } from './consumer/event-dispatcher';
import { EventHandlerRegistry } from './consumer/event-handler.registry';
import { KafkaEventConsumer } from './consumer/kafka-event-consumer';
import { EVENT_BUS } from './event-bus';
import { IdempotencyService } from './idempotency.service';
import { KafkaEventBus } from './kafka-event-bus';
import { LoggingEventBus } from './logging-event-bus';

/**
 * Backbone de eventos (produção + consumo).
 *  - EVENT_BUS: KafkaEventBus (real) ou LoggingEventBus (mock) por config.
 *  - Consumo: EventHandlerRegistry + EventDispatcher (ordered/exactly-once) +
 *    KafkaEventConsumer (ativo só com KAFKA_ENABLED).
 * Global para que domínios registrem handlers e injetem o dispatcher/registry.
 */
@Global()
@Module({
  providers: [
    LoggingEventBus,
    KafkaEventBus,
    IdempotencyService,
    EventHandlerRegistry,
    EventDispatcher,
    KafkaEventConsumer,
    {
      provide: EVENT_BUS,
      inject: [ConfigService, LoggingEventBus, KafkaEventBus],
      useFactory: (
        config: ConfigService,
        logging: LoggingEventBus,
        kafka: KafkaEventBus,
      ) => (config.get<boolean>('KAFKA_ENABLED') ? kafka : logging),
    },
  ],
  exports: [EVENT_BUS, IdempotencyService, EventHandlerRegistry, EventDispatcher],
})
export class EventBusModule {}
