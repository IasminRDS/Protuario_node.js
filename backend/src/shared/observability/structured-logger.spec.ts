import { logJson } from './structured-logger';
import { tenantStore } from '../tenant/tenant-context';

describe('logJson — correlação forense', () => {
  let out: string;
  beforeEach(() => {
    out = '';
    jest.spyOn(console, 'log').mockImplementation((l: string) => {
      out = l;
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('inclui traceId/userId/tenantId do contexto da requisição', () => {
    tenantStore.run(
      { hospitalId: 'hosp-1', userId: '42', bypassTenant: false, requestId: 'trace-abc' },
      () => logJson('info', 'Test', 'evento'),
    );
    const o = JSON.parse(out);
    expect(o).toMatchObject({
      traceId: 'trace-abc',
      userId: '42',
      tenantId: 'hosp-1',
      message: 'evento',
    });
  });

  it('fora de requisição não adiciona correlação (nem quebra)', () => {
    logJson('info', 'Boot', 'sem contexto');
    const o = JSON.parse(out);
    expect(o.traceId).toBeUndefined();
    expect(o.message).toBe('sem contexto');
  });

  it('campo explícito sobrescreve a correlação do contexto', () => {
    tenantStore.run(
      { hospitalId: 'hosp-1', userId: '42', bypassTenant: false, requestId: 'trace-abc' },
      () => logJson('info', 'Test', 'evento', { traceId: 'explicito' }),
    );
    expect(JSON.parse(out).traceId).toBe('explicito');
  });
});
