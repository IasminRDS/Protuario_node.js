import { Prisma } from '@prisma/client';
import {
  applyTenantScope,
  scopeParams,
  TenantContextError,
} from './tenant-guard';

const p = (over: Partial<Prisma.MiddlewareParams>): Prisma.MiddlewareParams =>
  ({
    model: 'Paciente',
    action: 'findMany',
    args: {},
    dataPath: [],
    runInTransaction: false,
    ...over,
  }) as Prisma.MiddlewareParams;

const HOSP_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const HOSP_B = 'bbbbbbbb-0000-0000-0000-000000000002';

describe('tenant-guard (isolamento multi-tenant)', () => {
  describe('applyTenantScope', () => {
    it('injeta hospitalId no where de findMany', () => {
      const out = applyTenantScope(p({ action: 'findMany' }), HOSP_A);
      expect(out.args.where).toEqual({ hospitalId: HOSP_A });
    });

    it('injeta hospitalId no data de create', () => {
      const out = applyTenantScope(
        p({ action: 'create', args: { data: { nome: 'X' } } }),
        HOSP_A,
      );
      expect(out.args.data).toEqual({ nome: 'X', hospitalId: HOSP_A });
    });

    it('reescreve findUnique -> findFirst com hospitalId', () => {
      const out = applyTenantScope(
        p({ action: 'findUnique', args: { where: { id: 1n } } }),
        HOSP_A,
      );
      expect(out.action).toBe('findFirst');
      expect(out.args.where).toEqual({ id: 1n, hospitalId: HOSP_A });
    });

    it('injeta no where de update/delete', () => {
      const upd = applyTenantScope(
        p({ action: 'update', args: { where: { id: 1n }, data: {} } }),
        HOSP_A,
      );
      expect(upd.args.where.hospitalId).toBe(HOSP_A);
    });
  });

  describe('scopeParams (política de contexto)', () => {
    it('NÃO escopa modelo não-tenant (Usuario)', () => {
      const out = scopeParams(p({ model: 'Usuario', action: 'findMany' }), {
        hospitalId: HOSP_A,
        userId: '1',
      });
      expect(out.args.where).toBeUndefined();
    });

    it('sem contexto (sistema) NÃO escopa e NÃO lança', () => {
      const out = scopeParams(p({ action: 'findMany' }), undefined);
      expect(out.args.where).toBeUndefined();
    });

    it('BLOQUEIA modelo tenant quando hospitalId ausente no contexto', () => {
      expect(() =>
        scopeParams(p({ action: 'findMany' }), { hospitalId: null, userId: '1' }),
      ).toThrow(TenantContextError);
    });

    it('ISOLAMENTO: hospital A e B produzem filtros distintos (A nunca vê B)', () => {
      const a = scopeParams(p({ action: 'findMany' }), {
        hospitalId: HOSP_A,
        userId: '1',
      });
      const b = scopeParams(p({ action: 'findMany' }), {
        hospitalId: HOSP_B,
        userId: '2',
      });
      expect(a.args.where).toEqual({ hospitalId: HOSP_A });
      expect(b.args.where).toEqual({ hospitalId: HOSP_B });
      expect(a.args.where.hospitalId).not.toBe(b.args.where.hospitalId);
    });

    it('BYPASS falha: mesmo passando where forjado de outro hospital, o guard sobrescreve', () => {
      // Tentativa de "ver" o hospital B estando logado no A.
      const out = scopeParams(
        p({ action: 'findMany', args: { where: { hospitalId: HOSP_B } } }),
        { hospitalId: HOSP_A, userId: '1' },
      );
      // O contexto (A) vence — bypass neutralizado.
      expect(out.args.where.hospitalId).toBe(HOSP_A);
    });
  });
});
