import { ConfigService } from '@nestjs/config';
import { SigningService } from './signing.service';

describe('SigningService', () => {
  let signing: SigningService;

  beforeEach(() => {
    // sem DOC_SIGNING_PRIVATE_KEY → par RSA efêmero
    signing = new SigningService({ get: () => undefined } as unknown as ConfigService);
    signing.onModuleInit();
  });

  it('assina e verifica o mesmo hash (round-trip)', () => {
    const hash = 'a'.repeat(64);
    const sig = signing.assinar(hash);
    expect(sig).toBeTruthy();
    expect(signing.verificar(hash, sig)).toBe(true);
  });

  it('detecta adulteração (hash diferente do assinado)', () => {
    const sig = signing.assinar('a'.repeat(64));
    expect(signing.verificar('b'.repeat(64), sig)).toBe(false);
  });

  it('rejeita assinatura inválida', () => {
    expect(signing.verificar('a'.repeat(64), 'Zm9v')).toBe(false);
  });

  it('expõe chave pública PEM', () => {
    expect(signing.publicKeyPem()).toContain('BEGIN PUBLIC KEY');
  });
});
