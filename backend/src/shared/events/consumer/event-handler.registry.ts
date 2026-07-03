import { Injectable } from '@nestjs/common';
import { logJson } from '../../observability/structured-logger';
import { EventHandler } from './event-handler.interface';

/**
 * Registro central de handlers de evento. Módulos de domínio registram seus
 * handlers aqui (evita acoplamento por multi-provider entre módulos). O
 * dispatcher consulta o registry por tipo de evento.
 */
@Injectable()
export class EventHandlerRegistry {
  private readonly handlers: EventHandler[] = [];

  register(handler: EventHandler): void {
    this.handlers.push(handler);
    logJson('info', 'EventHandlerRegistry', 'handler.registered', {
      consumer: handler.consumerName,
      mode: handler.mode,
    });
  }

  handlersFor(type: string): EventHandler[] {
    return this.handlers.filter((h) => h.supports(type));
  }
}
