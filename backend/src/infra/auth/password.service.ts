import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Hash e verificação de senhas com Argon2 (cap. 117: nunca texto puro).
 */
@Injectable()
export class PasswordService {
  hash(plain: string): Promise<string> {
    return argon2.hash(plain);
  }

  verify(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain).catch(() => false);
  }
}
