import { Injectable, Optional } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Blind index — permite BUSCA e UNICIDADE por igualdade sobre um campo que fica
 * CIFRADO em repouso (ex.: CPF/CNS). Guarda-se, ao lado do valor cifrado, um
 * HMAC-SHA256 determinístico do valor normalizado; as consultas usam o HMAC, não
 * o texto puro. O CPF em claro sai do banco/snapshot/backup.
 *
 * - **Keyed** (HMAC), não hash puro: sem a chave, não dá para reverter por
 *   dicionário/rainbow (o espaço de CPFs é pequeno — 10^11).
 * - **Ligado ao tenant** (`hospitalId:valor`): o MESMO CPF em hospitais
 *   diferentes gera índices diferentes → sem correlação cross-tenant.
 * - **Só IGUALDADE**: não suporta busca parcial (LIKE). É o caso do CPF/CNS.
 *
 * Chave: BLIND_INDEX_KEY (32 bytes; 64 hex ou base64), SEPARADA da chave de
 * cifra. Obrigatória em produção. Fora de produção, cai numa chave fixa de dev
 * (determinística → buscas/unicidade funcionam nos testes).
 */
const DEV_KEY = Buffer.alloc(32, 7); // determinística p/ dev/test

/** Campos com blind index, por modelo: [campoOrigem, campoIndice]. */
export const BLIND_INDEX_FIELDS: Readonly<Record<string, ReadonlyArray<readonly [string, string]>>> = {
  Paciente: [
    ['cpf', 'cpfBi'],
    ['cns', 'cnsBi'],
  ],
};

@Injectable()
export class BlindIndexService {
  private readonly key: Buffer;

  constructor(@Optional() envArg?: NodeJS.ProcessEnv) {
    const env = envArg ?? process.env;
    const raw = env.BLIND_INDEX_KEY?.trim();
    if (!raw) {
      if (env.NODE_ENV === 'production') {
        throw new Error(
          '[SEGURANCA] BLIND_INDEX_KEY e obrigatoria em producao — sem ela o CPF ' +
            'nao pode ser cifrado em repouso mantendo busca/unicidade.',
        );
      }
      this.key = DEV_KEY;
      return;
    }
    const key = /^[0-9a-fA-F]{64}$/.test(raw)
      ? Buffer.from(raw, 'hex')
      : Buffer.from(raw, 'base64');
    if (key.length !== 32) {
      throw new Error('BLIND_INDEX_KEY invalida: use 32 bytes (64 hex ou base64).');
    }
    this.key = key;
  }

  /** Normaliza (só dígitos) — CPF/CNS. Vazio → null (não indexa). */
  private normalize(value: string | null | undefined): string | null {
    if (!value) return null;
    const digits = value.replace(/\D/g, '');
    return digits.length > 0 ? digits : null;
  }

  /**
   * Índice cego de `value` ligado ao `tenantId`. Retorna 64 hex, ou null se o
   * valor for vazio (permite múltiplos pacientes sem documento por hospital).
   */
  index(value: string | null | undefined, tenantId: string | null | undefined): string | null {
    const norm = this.normalize(value);
    if (norm === null || !tenantId) return null;
    return createHmac('sha256', this.key).update(`${tenantId}:${norm}`).digest('hex');
  }

  /** Comparação em tempo constante (evita timing oracle). */
  equals(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  }

  /**
   * Preenche, IN-PLACE, os campos de blind index de um payload de ESCRITA para
   * `model`, a partir do valor em claro (antes da cifra). `tenantId` liga o
   * índice ao hospital. Cobre create/update (`data`) e upsert (`create`/`update`).
   */
  applyWriteArgs(
    model: string | undefined,
    args: { data?: unknown; create?: unknown; update?: unknown } | undefined,
    tenantId: string | null | undefined,
  ): void {
    if (!model || !args) return;
    const pairs = BLIND_INDEX_FIELDS[model];
    if (!pairs) return;
    const apply = (obj: unknown): void => {
      if (Array.isArray(obj)) return obj.forEach(apply);
      if (!obj || typeof obj !== 'object') return;
      const rec = obj as Record<string, unknown>;
      const tenant = tenantId ?? (typeof rec.hospitalId === 'string' ? rec.hospitalId : null);
      for (const [src, biField] of pairs) {
        if (!(src in rec)) continue; // campo não tocado nesta escrita
        const v = rec[src];
        if (typeof v === 'string') {
          rec[biField] = this.index(v, tenant);
        } else if (v === null) {
          rec[biField] = null;
        } else if (v && typeof v === 'object' && 'set' in (v as object)) {
          const setVal = (v as { set: unknown }).set;
          rec[biField] = { set: typeof setVal === 'string' ? this.index(setVal, tenant) : null };
        }
      }
    };
    apply(args.data);
    apply(args.create);
    apply(args.update);
  }
}
