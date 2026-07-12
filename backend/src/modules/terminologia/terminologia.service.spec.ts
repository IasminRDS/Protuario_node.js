import { TerminologiaService } from './terminologia.service';

describe('TerminologiaService', () => {
  const svc = new TerminologiaService();

  it('busca CID-10 por código (prefixo) e por descrição sem acento', () => {
    expect(svc.buscarCid10('A90').some((c) => c.codigo === 'A90')).toBe(true);
    expect(svc.buscarCid10('dengue').length).toBeGreaterThan(0);
    // "hipertensao" (sem acento) casa "Hipertensão"
    expect(svc.buscarCid10('hipertensao').some((c) => c.codigo === 'I10')).toBe(true);
  });

  it('decodifica CID exato e por prefixo mais específico', () => {
    expect(svc.descricaoCid10('A90')).toContain('Dengue');
    expect(svc.descricaoCid10('E11.9')).toBeTruthy(); // subcategoria → E11.9 ou E11
  });

  it('busca medicamentos (RENAME) por nome', () => {
    expect(svc.buscarMedicamentos('amoxicilina').length).toBeGreaterThan(0);
  });

  it('busca CBO e SIGTAP', () => {
    expect(svc.buscarCbo('enfermeiro').some((c) => c.descricao.includes('Enfermeiro'))).toBe(true);
    expect(svc.buscarSigtap('hemograma').length).toBeGreaterThan(0);
  });

  it('retorna vazio para query vazia', () => {
    expect(svc.buscarCid10('')).toEqual([]);
    expect(svc.buscarMedicamentos('   ')).toEqual([]);
  });
});
