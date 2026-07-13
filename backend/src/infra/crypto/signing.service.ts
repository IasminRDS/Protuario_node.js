import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  KeyObject,
  sign as cryptoSign,
  verify as cryptoVerify,
} from 'crypto';

/**
 * Assinatura digital de documentos clínicos.
 *
 * Em produção com ICP-Brasil, a chave privada vem de um certificado A1/A3 do
 * estabelecimento/profissional (env `DOC_SIGNING_PRIVATE_KEY` em PEM). Sem ela
 * (dev), gera um par RSA efêmero no boot — a mecânica de assinatura/verificação
 * é idêntica; só a âncora de confiança (cadeia ICP) muda. O algoritmo é
 * RSA-SHA256 (mesma família das assinaturas ICP-Brasil).
 */
@Injectable()
export class SigningService implements OnModuleInit {
  private readonly logger = new Logger(SigningService.name);
  private privateKey!: KeyObject;
  private publicKey!: KeyObject;
  readonly algoritmo = 'RSA-SHA256';

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const pem = this.config.get<string>('DOC_SIGNING_PRIVATE_KEY');
    if (pem && pem.includes('BEGIN')) {
      this.privateKey = createPrivateKey({ key: pem, format: 'pem' });
      this.publicKey = createPublicKey(this.privateKey); // deriva a pública da privada
      this.logger.log('Chave de assinatura carregada de DOC_SIGNING_PRIVATE_KEY.');
    } else {
      if (this.config.get<string>('NODE_ENV') === 'production') {
        // Par efêmero muda a cada boot → toda assinatura emitida antes do
        // restart passa a ser reportada como "adulterada". Inaceitável em prod.
        throw new Error(
          'DOC_SIGNING_PRIVATE_KEY é obrigatório em produção (certificado ICP-Brasil). ' +
            'Sem ele, as assinaturas usam par RSA efêmero e ficam inválidas após qualquer restart.',
        );
      }
      const { privateKey, publicKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
      });
      this.privateKey = privateKey;
      this.publicKey = publicKey;
      this.logger.warn(
        'DOC_SIGNING_PRIVATE_KEY ausente — usando par RSA efêmero (dev). ' +
          'Em produção, configure um certificado ICP-Brasil.',
      );
    }
  }

  /** Assina um hash hex (SHA-256 do PDF) e devolve a assinatura em base64. */
  assinar(hashHex: string): string {
    return cryptoSign('sha256', Buffer.from(hashHex, 'utf8'), this.privateKey).toString(
      'base64',
    );
  }

  /** Verifica a assinatura (base64) sobre o hash hex informado. */
  verificar(hashHex: string, assinaturaB64: string): boolean {
    try {
      return cryptoVerify(
        'sha256',
        Buffer.from(hashHex, 'utf8'),
        this.publicKey,
        Buffer.from(assinaturaB64, 'base64'),
      );
    } catch {
      return false;
    }
  }

  /** Chave pública em PEM (para verificação externa). */
  publicKeyPem(): string {
    return this.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  }
}
