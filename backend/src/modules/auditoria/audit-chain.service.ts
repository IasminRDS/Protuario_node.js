import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const GENESIS = '0'.repeat(64);

interface AuditRow {
  id: bigint;
  event_id: string;
  usuario_id: bigint | null;
  modulo: string;
  operacao: string;
  objeto: string | null;
  resultado: string | null;
  entity: string | null;
  entity_id: string | null;
  hospital_id: string | null;
  data_evento: Date;
  prev_hash: string | null;
  hash: string | null;
}

/**
 * ADR-06 — cadeia de hash da auditoria (não-repúdio criptográfico).
 *
 * Cada evento recebe `hash = SHA-256(prevHash || conteúdo canônico)`; alterar
 * ou remover qualquer registro quebra a cadeia a partir dele. Como a tabela é
 * WORM (trigger `auditoria_no_update`), o SELO é uma operação de MANUTENÇÃO
 * feita pela role DONA (MAINTENANCE_DATABASE_URL) — mesmo padrão das migrations
 * que ajustam auditoria: DISABLE TRIGGER → gravar prev_hash/hash → ENABLE. O
 * caminho quente de auditoria (inserts) não é tocado.
 */
@Injectable()
export class AuditChainService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditChainService.name);
  private client!: PrismaClient;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url =
      this.config.get<string>('MAINTENANCE_DATABASE_URL') ??
      this.config.getOrThrow<string>('DATABASE_URL');
    this.client = new PrismaClient({ datasources: { db: { url } } });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.$disconnect();
  }

  /** Conteúdo canônico e estável do evento (exclui prev_hash/hash). */
  private canonical(r: AuditRow): string {
    return JSON.stringify({
      id: r.id.toString(),
      eventId: r.event_id,
      usuarioId: r.usuario_id?.toString() ?? null,
      modulo: r.modulo,
      operacao: r.operacao,
      objeto: r.objeto,
      resultado: r.resultado,
      entity: r.entity,
      entityId: r.entity_id,
      hospitalId: r.hospital_id,
      dataEvento: r.data_evento.toISOString(),
    });
  }

  private hashOf(prev: string, r: AuditRow): string {
    return createHash('sha256').update(prev).update(this.canonical(r)).digest('hex');
  }

  /** Sela os eventos ainda sem hash, encadeando-os em ordem de id. */
  async selar(): Promise<{ selados: number; total: number }> {
    return this.client.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('ALTER TABLE auditoria DISABLE TRIGGER auditoria_no_update');
      try {
        const [{ hash: ultimoHash } = { hash: null }] = await tx.$queryRawUnsafe<
          { hash: string | null }[]
        >('SELECT hash FROM auditoria WHERE hash IS NOT NULL ORDER BY id DESC LIMIT 1');
        let prev = ultimoHash ?? GENESIS;

        const pendentes = await tx.$queryRawUnsafe<AuditRow[]>(
          `SELECT id, event_id, usuario_id, modulo, operacao, objeto, resultado,
                  entity, entity_id, hospital_id, data_evento, prev_hash, hash
           FROM auditoria WHERE hash IS NULL ORDER BY id ASC`,
        );

        for (const r of pendentes) {
          const hash = this.hashOf(prev, r);
          await tx.$executeRawUnsafe(
            'UPDATE auditoria SET prev_hash = $1, hash = $2 WHERE id = $3',
            prev,
            hash,
            r.id,
          );
          prev = hash;
        }

        const total = await tx.$queryRawUnsafe<{ n: bigint }[]>(
          'SELECT count(*)::bigint AS n FROM auditoria',
        );
        return { selados: pendentes.length, total: Number(total[0].n) };
      } finally {
        await tx.$executeRawUnsafe('ALTER TABLE auditoria ENABLE TRIGGER auditoria_no_update');
      }
    });
  }

  /**
   * Verifica a integridade da cadeia: recomputa cada hash a partir do prev_hash
   * e do conteúdo. Retorna o primeiro ponto de quebra, se houver.
   */
  async verificar(): Promise<{
    integra: boolean;
    verificados: number;
    naoSelados: number;
    quebradoNoId: string | null;
  }> {
    const rows = await this.client.$queryRawUnsafe<AuditRow[]>(
      `SELECT id, event_id, usuario_id, modulo, operacao, objeto, resultado,
              entity, entity_id, hospital_id, data_evento, prev_hash, hash
       FROM auditoria WHERE hash IS NOT NULL ORDER BY id ASC`,
    );
    const naoSelados = await this.client.$queryRawUnsafe<{ n: bigint }[]>(
      'SELECT count(*)::bigint AS n FROM auditoria WHERE hash IS NULL',
    );

    let prev = GENESIS;
    for (const r of rows) {
      const esperado = this.hashOf(prev, r);
      if (r.prev_hash !== prev || r.hash !== esperado) {
        return {
          integra: false,
          verificados: rows.length,
          naoSelados: Number(naoSelados[0].n),
          quebradoNoId: r.id.toString(),
        };
      }
      prev = r.hash!;
    }
    return {
      integra: true,
      verificados: rows.length,
      naoSelados: Number(naoSelados[0].n),
      quebradoNoId: null,
    };
  }
}
