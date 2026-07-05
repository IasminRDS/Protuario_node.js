import { BadRequestException } from '@nestjs/common';
import { ParseBigIntIdPipe } from './parse-bigint-id.pipe';

describe('ParseBigIntIdPipe', () => {
  const pipe = new ParseBigIntIdPipe();

  it('aceita inteiro positivo e devolve string canônica', () => {
    expect(pipe.transform('1')).toBe('1');
    expect(pipe.transform('00042')).toBe('42'); // normaliza zeros à esquerda
    expect(pipe.transform('9007199254740993')).toBe('9007199254740993'); // > Number.MAX_SAFE_INTEGER
  });

  it.each(['abc', '1 OR 1=1', '1.5', '-3', '0', '', '  ', '1e3', 'NaN', '0x1F'])(
    'rejeita entrada inválida "%s" com 400',
    (input) => {
      expect(() => pipe.transform(input)).toThrow(BadRequestException);
    },
  );
});
