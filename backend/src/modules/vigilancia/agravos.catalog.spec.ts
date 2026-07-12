import { findAgravo, normalizeCid } from './agravos.catalog';

describe('agravos.catalog (SINAN)', () => {
  it('normaliza CID (maiúsculo, sem ponto/espaço)', () => {
    expect(normalizeCid('a90')).toBe('A90');
    expect(normalizeCid('A90.0')).toBe('A900');
    expect(normalizeCid(' u07.1 ')).toBe('U071');
  });

  it('casa CID exato de agravo notificável', () => {
    expect(findAgravo('A90')?.agravo).toBe('Dengue');
    expect(findAgravo('U07.1')?.agravo).toBe('COVID-19');
  });

  it('casa por prefixo (subcategoria do CID)', () => {
    // B50.9 (malária P. falciparum) casa o prefixo B50.
    expect(findAgravo('B50.9')?.agravo).toContain('Malária');
  });

  it('marca notificação imediata quando aplicável', () => {
    expect(findAgravo('A95')?.imediata).toBe(true); // febre amarela
    expect(findAgravo('A90')?.imediata).toBe(false); // dengue clássico
  });

  it('retorna null para CID não notificável ou vazio', () => {
    expect(findAgravo('Z00')).toBeNull();
    expect(findAgravo('')).toBeNull();
  });
});
