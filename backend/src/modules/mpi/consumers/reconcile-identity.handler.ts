import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainEvent } from '../../events/base.event';
import { CidadaoCreatedPayload } from '../../events/cidadao-created.event';
import { cidadaoMergedEvent } from '../../events/cidadao-merged.event';
import { EventType } from '../../events/event-types';
import { TransactionalOutbox } from '../../outbox/transactional-outbox';
import {
  ConsumerMode,
  EventHandler,
} from '../../../shared/events/consumer/event-handler.interface';
import { EventHandlerRegistry } from '../../../shared/events/consumer/event-handler.registry';
import { logJson } from '../../../shared/observability/structured-logger';

/**
 * Reconciliação determinística de identidade (fecha o split concorrente raro:
 * mesma pessoa criada simultaneamente COM CPF e SEM CPF, que não compartilham
 * chave única). Ao processar CidadaoCreated de um registro COM identificador
 * forte, procura um duplicado demográfico "somente-demo" (sem CPF/CNS) e o
 * unifica ao registro forte — determinístico, sem probabilidade e sem fundir
 * identificadores fortes conflitantes. Mode ONCE => idempotente sob replay.
 */
@Injectable()
export class ReconcileIdentityHandler implements EventHandler, OnModuleInit {
  readonly consumerName = 'mpi.reconcile';
  readonly mode: ConsumerMode = 'ONCE';

  constructor(private readonly registry: EventHandlerRegistry) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  supports(type: string): boolean {
    return type === EventType.CIDADAO_CREATED;
  }

  async handle(
    tx: Prisma.TransactionClient,
    event: DomainEvent,
  ): Promise<void> {
    const payload = event.payload as CidadaoCreatedPayload;
    const survivorId = payload.cidadaoId;

    // Só reconcilia a partir de um registro COM identificador forte.
    if (!payload.cpf && !payload.cns) return;

    const duplicates = await tx.cidadao.findMany({
      where: {
        id: { not: survivorId },
        nome: { equals: payload.nome, mode: 'insensitive' },
        dataNascimento: new Date(payload.dataNascimento),
        status: 'ATIVO',
        mergedInto: null,
        cpf: null,
        cns: null, // apenas duplicados "somente-demo" (sem id forte conflitante)
      },
    });

    if (duplicates.length !== 1) return; // 0 = nada a fazer; >1 = ambíguo (stewardship)

    const loserId = duplicates[0].id;

    // 1) Marca o perdedor como unificado.
    await tx.cidadao.update({
      where: { id: loserId },
      data: { status: 'UNIFICADO', mergedInto: survivorId },
    });

    // 2) Redireciona as chaves de identidade do perdedor para o sobrevivente
    //    (chaves têm valores disjuntos: demo vs cpf/cns -> sem colisão de PK).
    await tx.cidadaoIdentityKey.updateMany({
      where: { cidadaoId: loserId },
      data: { cidadaoId: survivorId },
    });

    // 3) Publica o merge (mesma transação -> Outbox).
    await new TransactionalOutbox(tx).enqueue(
      cidadaoMergedEvent({ survivorId, mergedId: loserId }, event.traceId),
    );

    logJson('warn', 'ReconcileIdentity', 'cidadao.merged', {
      traceId: event.traceId,
      survivorId,
      mergedId: loserId,
    });
  }
}
