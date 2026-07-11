import { Injectable } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PERIOD_S = 30; // janela TOTP padrão
const DIGITS = 6;

/**
 * TOTP (RFC 6238) implementado sobre node:crypto — compatível com Google
 * Authenticator / Microsoft Authenticator / FreeOTP. Sem dependência externa:
 * HOTP (RFC 4226) com HMAC-SHA1 + contador de tempo de 30s.
 */
@Injectable()
export class TotpService {
  /** Segredo novo em base32 (160 bits, tamanho recomendado p/ SHA-1). */
  generateSecret(): string {
    return this.base32Encode(randomBytes(20));
  }

  /** URL otpauth:// para provisionamento (QR code no autenticador). */
  otpauthUrl(login: string, secret: string, issuer = 'SNPE Prontuario'): string {
    const label = encodeURIComponent(`${issuer}:${login}`);
    const params = new URLSearchParams({
      secret,
      issuer,
      algorithm: 'SHA1',
      digits: String(DIGITS),
      period: String(PERIOD_S),
    });
    return `otpauth://totp/${label}?${params.toString()}`;
  }

  /**
   * Verifica o código com janela de ±1 período (tolerância a clock drift).
   * Comparação em tempo constante.
   */
  verify(secret: string, token: string, window = 1): boolean {
    const clean = token.replace(/\s/g, '');
    if (!/^\d{6}$/.test(clean)) return false;

    let key: Buffer;
    try {
      key = this.base32Decode(secret);
    } catch {
      return false;
    }

    const counter = Math.floor(Date.now() / 1000 / PERIOD_S);
    const provided = Buffer.from(clean, 'utf8');

    for (let offset = -window; offset <= window; offset++) {
      const expected = Buffer.from(this.hotp(key, counter + offset), 'utf8');
      if (
        expected.length === provided.length &&
        timingSafeEqual(expected, provided)
      ) {
        return true;
      }
    }
    return false;
  }

  /** HOTP (RFC 4226): HMAC-SHA1(key, counter BE64) + truncamento dinâmico. */
  private hotp(key: Buffer, counter: number): string {
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(BigInt(counter));
    const hmac = createHmac('sha1', key).update(buf).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);
    return String(code % 10 ** DIGITS).padStart(DIGITS, '0');
  }

  private base32Encode(buf: Buffer): string {
    let bits = 0;
    let value = 0;
    let out = '';
    for (const byte of buf) {
      value = (value << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    return out;
  }

  private base32Decode(str: string): Buffer {
    const clean = str.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
    let bits = 0;
    let value = 0;
    const out: number[] = [];
    for (const ch of clean) {
      const idx = BASE32_ALPHABET.indexOf(ch);
      if (idx === -1) throw new Error('Segredo base32 inválido.');
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        out.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }
    return Buffer.from(out);
  }
}
