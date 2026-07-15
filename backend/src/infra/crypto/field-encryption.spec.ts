import { FieldEncryptionService } from './field-encryption';

const K1 = 'a'.repeat(64);
const K2 = 'b'.repeat(64);

describe('FieldEncryptionService — rotação de chave (key-ring)', () => {
  it('cifra com a MAIOR versão presente e decifra versões antigas', () => {
    // Só v1: escreve em v1.
    const v1only = new FieldEncryptionService({ FIELD_ENCRYPTION_KEY: K1 } as never);
    const argsV1: { data: { alergias: string } } = { data: { alergias: 'Penicilina' } };
    v1only.encryptWriteArgs('Paciente', argsV1);
    expect(argsV1.data.alergias.startsWith('enc:v1:')).toBe(true);

    // Rotação: v1 + v2 → novas escritas em v2, MAS v1 antigo ainda decifra.
    const rotated = new FieldEncryptionService({
      FIELD_ENCRYPTION_KEY: K1,
      FIELD_ENCRYPTION_KEY_V2: K2,
    } as never);
    // decifra o valor legado v1
    expect(rotated.decryptResult({ alergias: argsV1.data.alergias })).toEqual({
      alergias: 'Penicilina',
    });
    // nova escrita sai em v2
    const argsV2: { data: { alergias: string } } = { data: { alergias: 'Dipirona' } };
    rotated.encryptWriteArgs('Paciente', argsV2);
    expect(argsV2.data.alergias.startsWith('enc:v2:')).toBe(true);
    expect(rotated.decryptResult({ alergias: argsV2.data.alergias })).toEqual({
      alergias: 'Dipirona',
    });
  });

  it('sem chave para a versão do ciphertext → THROW (não devolve lixo)', () => {
    const onlyV2 = new FieldEncryptionService({ FIELD_ENCRYPTION_KEY_V2: K2 } as never);
    const v1Cipher = new FieldEncryptionService({ FIELD_ENCRYPTION_KEY: K1 } as never);
    const args: { data: { alergias: string } } = { data: { alergias: 'x' } };
    v1Cipher.encryptWriteArgs('Paciente', args); // enc:v1:...
    // onlyV2 não tem a chave v1 → recusa (fail-closed).
    expect(() => onlyV2.decryptResult({ a: args.data.alergias })).toThrow(/Sem chave|decifrar/i);
  });

  it('desabilitado sem chave (fora de produção) — passthrough', () => {
    const off = new FieldEncryptionService({ NODE_ENV: 'test' } as never);
    expect(off.enabled).toBe(false);
    const args: { data: { alergias: string } } = { data: { alergias: 'claro' } };
    off.encryptWriteArgs('Paciente', args);
    expect(args.data.alergias).toBe('claro');
  });
});
