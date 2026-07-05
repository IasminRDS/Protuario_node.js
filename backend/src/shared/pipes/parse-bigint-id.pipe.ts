import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/**
 * Valida que um parâmetro de rota `:id` é um inteiro positivo (BigInt-safe) e o
 * devolve como string canônica.
 *
 * Motivação: os services faziam `BigInt(id)` diretamente sobre o valor da rota.
 * Entradas não numéricas (ex.: `/pacientes/abc`) lançavam `SyntaxError`, que o
 * filtro global traduzia em HTTP 500. Com este pipe, entradas inválidas viram
 * 400 (erro do cliente) ANTES de tocar a camada de domínio.
 */
@Injectable()
export class ParseBigIntIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string' || !/^\d+$/.test(value)) {
      throw new BadRequestException(
        'ID inválido: deve ser um inteiro positivo.',
      );
    }

    let parsed: bigint;
    try {
      parsed = BigInt(value);
    } catch {
      throw new BadRequestException(
        'ID inválido: deve ser um inteiro positivo.',
      );
    }

    if (parsed <= 0n) {
      throw new BadRequestException(
        'ID inválido: deve ser um inteiro positivo.',
      );
    }

    return parsed.toString();
  }
}
