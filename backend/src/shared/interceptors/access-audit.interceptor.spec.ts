import { shouldAudit } from './access-audit.interceptor';

describe('shouldAudit (decisão de auditoria de não-repúdio)', () => {
  it('super-admin é SEMPRE auditado (god-mode cross-tenant)', () => {
    expect(shouldAudit({ method: 'GET', resource: 'perfis', hasId: false, isSuperAdmin: true })).toBe(true);
    expect(shouldAudit({ method: 'GET', resource: undefined, hasId: false, isSuperAdmin: true })).toBe(true);
  });

  it('mutação em recurso PHI é auditada', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(shouldAudit({ method, resource: 'pacientes', hasId: true, isSuperAdmin: false })).toBe(true);
    }
  });

  it('leitura de registro PHI individual (:id) é auditada', () => {
    expect(shouldAudit({ method: 'GET', resource: 'pacientes', hasId: true, isSuperAdmin: false })).toBe(true);
    expect(shouldAudit({ method: 'GET', resource: 'prontuario', hasId: true, isSuperAdmin: false })).toBe(true);
    expect(shouldAudit({ method: 'GET', resource: 'fhir', hasId: true, isSuperAdmin: false })).toBe(true);
  });

  it('listagem PHI genérica NÃO gera ruído (sem titular específico)', () => {
    expect(shouldAudit({ method: 'GET', resource: 'pacientes', hasId: false, isSuperAdmin: false })).toBe(false);
  });

  it('recurso não-PHI (não-super) não é auditado por este interceptor', () => {
    expect(shouldAudit({ method: 'GET', resource: 'perfis', hasId: true, isSuperAdmin: false })).toBe(false);
    expect(shouldAudit({ method: 'POST', resource: 'usuarios', hasId: false, isSuperAdmin: false })).toBe(false);
  });
});
