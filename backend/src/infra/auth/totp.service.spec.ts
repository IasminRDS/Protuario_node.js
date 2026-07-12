import { TotpService } from './totp.service';

describe('TotpService (RFC 6238)', () => {
  const totp = new TotpService();

  it('gera segredo base32 válido', () => {
    const s = totp.generateSecret();
    expect(s).toMatch(/^[A-Z2-7]+$/);
    expect(s.length).toBeGreaterThanOrEqual(16);
  });

  it('otpauthUrl contém issuer, secret e período', () => {
    const url = totp.otpauthUrl('dr.souza', 'JBSWY3DPEHPK3PXP');
    expect(url).toContain('otpauth://totp/');
    expect(url).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(url).toContain('period=30');
  });

  it('verifica código gerado para o próprio contador (round-trip)', () => {
    const secret = totp.generateSecret();
    // recomputa o código atual do mesmo modo que o serviço
    const counter = Math.floor(Date.now() / 1000 / 30);
    const code = totpCode(secret, counter);
    expect(totp.verify(secret, code)).toBe(true);
  });

  it('rejeita código inválido e formato errado', () => {
    const secret = totp.generateSecret();
    expect(totp.verify(secret, '000000')).toBe(false);
    expect(totp.verify(secret, 'abc')).toBe(false);
    expect(totp.verify(secret, '12345')).toBe(false);
  });
});

// Reimplementação mínima do HOTP p/ o teste (evita expor internals do serviço).
import { createHmac } from 'crypto';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32decode(s: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of s.toUpperCase().replace(/=+$/, '')) {
    value = (value << 5) | ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
function totpCode(secret: string, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', b32decode(secret)).update(buf).digest();
  const o = h[h.length - 1] & 0x0f;
  const code =
    (((h[o] & 0x7f) << 24) |
      ((h[o + 1] & 0xff) << 16) |
      ((h[o + 2] & 0xff) << 8) |
      (h[o + 3] & 0xff)) %
    1e6;
  return String(code).padStart(6, '0');
}
