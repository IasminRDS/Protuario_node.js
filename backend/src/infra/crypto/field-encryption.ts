import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Criptografia de CAMPO em repouso (defesa em profundidade sobre o TDE de disco).
 *
 * PHI narrativo (notas SOAP, alergias, resultados textuais) é cifrado ANTES de
 * chegar ao PostgreSQL — logo fica cifrado no banco, nos snapshots E no backup
 * lógico (pg_dump). AES-256-GCM garante confidencialidade + integridade (auth
 * tag). O formato é auto-descritivo (prefixo `enc:v1:`), então a decifra
 * independe do nome do campo ou do modelo, e linhas legadas em texto puro
 * continuam legíveis (migração incremental: toda ESCRITA passa a cifrar).
 *
 * Formato: enc:v1:<iv_b64>:<authTag_b64>:<ciphertext_b64>
 *
 * Chave: FIELD_ENCRYPTION_KEY (32 bytes; 64 hex ou base64). OBRIGATÓRIA em
 * produção — sem ela, o boot é recusado (PHI não pode ir em claro ao banco).
 */
const CIPHER_RE = /^enc:v(\d+):/;
const isCiphertext = (s: string): boolean => CIPHER_RE.test(s);

function parseKey(raw: string, label: string): Buffer {
  const key = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(`${label} invalida: use 32 bytes (64 hex ou base64).`);
  }
  return key;
}

/**
 * Campos de TEXTO LIVRE sensível (PHI), por modelo Prisma. NÃO inclua campos
 * usados em WHERE/orderBy/@unique (cifra quebraria busca/índice/ordenção).
 */
export const PHI_ENCRYPTED_FIELDS: Readonly<Record<string, readonly string[]>> = {
  // cpf/cns cifrados em repouso; a busca/unicidade é feita pelo blind index
  // (cpfBi/cnsBi). NÃO consultar cpf/cns diretamente em WHERE (ciphertext é
  // não-determinístico) — use os campos *Bi.
  Paciente: ['alergias', 'observacoes', 'cpf', 'cns'],
  Prontuario: [
    'evolucao',
    'diagnostico',
    'subjetivo',
    'objetivo',
    'avaliacao',
    'plano',
    'prescricaoTexto',
    'encaminhamentoTexto',
  ],
  ExameSolicitado: ['resultadoTexto', 'indicacaoClinica', 'observacoes'],
  Internacao: ['hipoteseDiag', 'motivo', 'sumarioAlta', 'observacoes'],
};

export class FieldEncryptionService {
  private readonly keyRing = new Map<number, Buffer>(); // versao -> chave
  private readonly activeVersion: number; // versao usada nas ESCRITAS
  readonly enabled: boolean;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    // v1 = FIELD_ENCRYPTION_KEY; v2.. = FIELD_ENCRYPTION_KEY_V2, _V3, ...
    const v1 = env.FIELD_ENCRYPTION_KEY?.trim();
    if (v1) this.keyRing.set(1, parseKey(v1, 'FIELD_ENCRYPTION_KEY'));
    for (let v = 2; v <= 16; v++) {
      const raw = env[`FIELD_ENCRYPTION_KEY_V${v}`]?.trim();
      if (raw) this.keyRing.set(v, parseKey(raw, `FIELD_ENCRYPTION_KEY_V${v}`));
    }

    if (this.keyRing.size === 0) {
      if (env.NODE_ENV === 'production') {
        throw new Error(
          '[SEGURANCA] FIELD_ENCRYPTION_KEY e obrigatoria em producao — ' +
            'PHI nao pode ser gravado em texto puro no banco.',
        );
      }
      this.activeVersion = 0;
      this.enabled = false;
      return;
    }
    this.activeVersion = Math.max(...this.keyRing.keys());
    this.enabled = true;
  }

  // AAD (dados adicionais autenticados) = NOME do campo. Vincula o ciphertext ao
  // campo: um insider com escrita no banco não consegue RELOCAR o ciphertext de
  // um campo para outro (ex.: alergias→observacoes) sem a auth tag falhar. O
  // nome do campo está disponível na escrita (allowlist) E na leitura (chave do
  // objeto no walk), então não exige mapa de modelo/relação.
  private encrypt(plain: string, aad?: string): string {
    const key = this.keyRing.get(this.activeVersion);
    if (!key) return plain;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    if (aad) cipher.setAAD(Buffer.from(aad, 'utf8'));
    const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `enc:v${this.activeVersion}:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
  }

  private decryptOnce(value: string, aad: string | undefined): string {
    const m = CIPHER_RE.exec(value)!;
    const key = this.keyRing.get(Number(m[1]))!;
    const [ivB64, tagB64, ctB64] = value.slice(m[0].length).split(':');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
    if (aad) decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return (
      decipher.update(Buffer.from(ctB64, 'base64')).toString('utf8') +
      decipher.final('utf8')
    );
  }

  /** Decifra se for um valor cifrado; caso contrario devolve como esta. */
  private decrypt(value: string, aad?: string): string {
    const m = CIPHER_RE.exec(value);
    if (!this.enabled || !m) return value;
    if (!this.keyRing.has(Number(m[1]))) {
      throw new Error(`[SEGURANCA] Sem chave para decifrar campo PHI (versao v${m[1]}).`);
    }
    try {
      return this.decryptOnce(value, aad);
    } catch {
      // Fallback legado: dados cifrados ANTES do AAD não têm AAD ligado. Se a
      // decifra com AAD falhar, tenta sem — cobre a transição sem re-cifrar tudo.
      if (aad) {
        try {
          return this.decryptOnce(value, undefined);
        } catch {
          /* cai no throw abaixo */
        }
      }
      // Falha de integridade/chave: NAO devolve lixo nem texto puro adivinhado.
      throw new Error('[SEGURANCA] Falha ao decifrar campo PHI (chave/integridade).');
    }
  }

  /**
   * Cifra, IN-PLACE, os campos PHI de um payload de escrita para `model`.
   * Cobre create/update (`data`) e upsert (`create`/`update`), incluindo o
   * array de createMany.
   */
  encryptWriteArgs(model: string | undefined, args: { data?: unknown; create?: unknown; update?: unknown } | undefined): void {
    if (!this.enabled || !model || !args) return;
    const fields = PHI_ENCRYPTED_FIELDS[model];
    if (!fields) return;
    const apply = (obj: unknown): void => {
      if (Array.isArray(obj)) return obj.forEach(apply);
      if (!obj || typeof obj !== 'object') return;
      const rec = obj as Record<string, unknown>;
      for (const f of fields) {
        const v = rec[f];
        // SEMPRE cifra na escrita (NUNCA confia no prefixo do input): senão um
        // cliente enviando "enc:v1:..." burlaria a cifra e/ou quebraria a leitura.
        // AAD = nome do campo (f) → vincula o ciphertext ao campo.
        if (typeof v === 'string' && v.length > 0) {
          rec[f] = this.encrypt(v, f);
        } else if (
          // Sintaxe de update do Prisma: { campo: { set: "valor" } }.
          v &&
          typeof v === 'object' &&
          typeof (v as { set?: unknown }).set === 'string' &&
          ((v as { set: string }).set).length > 0
        ) {
          (v as { set: string }).set = this.encrypt((v as { set: string }).set, f);
        }
      }
    };
    apply(args.data);
    apply(args.create);
    apply(args.update);
  }

  /**
   * Decifra QUALQUER string cifrada (prefixo `enc:v1:`) num resultado de leitura,
   * recursivamente — cobre objetos, arrays e relações (`include`) sem precisar
   * conhecer o modelo aninhado.
   */
  decryptResult<T>(value: T): T {
    if (!this.enabled) return value;
    // `aad` = nome do campo (chave do objeto) sob o qual o valor está — mesmo
    // AAD usado na escrita. Arrays herdam o AAD do campo pai (ex.: string[]).
    const walk = (v: unknown, aad?: string): unknown => {
      if (typeof v === 'string') return isCiphertext(v) ? this.decrypt(v, aad) : v;
      if (Array.isArray(v)) return v.map((x) => walk(x, aad));
      if (v && typeof v === 'object') {
        // Preserva tipos especiais do Prisma (Date, BigInt, Decimal, Buffer).
        if (
          v instanceof Date ||
          Buffer.isBuffer(v) ||
          typeof (v as { toNumber?: unknown }).toNumber === 'function'
        ) {
          return v;
        }
        const rec = v as Record<string, unknown>;
        for (const k of Object.keys(rec)) rec[k] = walk(rec[k], k);
        return rec;
      }
      return v;
    };
    return walk(value, undefined) as T;
  }
}
