import {
  ForbiddenException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { currentTenant } from '../../shared/tenant/tenant-context';
import {
  scopeParams,
  TenantContextError,
  TENANT_MODELS,
} from '../../shared/tenant/tenant-guard';
import { RLS_ENABLED, setTenantGuc, setSuperadminGuc } from '../../shared/tenant/rls';
import { FieldEncryptionService } from '../crypto/field-encryption';

/**
 * Ações de LEITURA (após scopeParams, que já reescreve findUnique→findFirst).
 * Só estas precisam de "pin" de conexão para o RLS: GETs não abrem tx no
 * TenantTxInterceptor, então a leitura roda numa conexão avulsa do pool — sem
 * o GUC `app.hospital_id` a policy retornaria vazio. Mutações já rodam na tx
 * do interceptor (que seta o GUC).
 */
const READ_ACTIONS: ReadonlySet<string> = new Set<string>([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

// Escritas em modelo tenant também precisam do GUC: as policies RLS têm
// WITH CHECK (INSERT/UPDATE) e USING (UPDATE/DELETE). Sem o GUC na conexão, o
// Postgres recusa a gravação ("violates row-level security policy").
const WRITE_ACTIONS: ReadonlySet<string> = new Set<string>([
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
]);

/** Delegate camelCase a partir do nome do modelo (Paciente → paciente). */
function delegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

/**
 * Camada de acesso ao banco. Aplica ISOLAMENTO MULTI-TENANT automático via
 * middleware $use: toda query em modelo clínico (Paciente, Atendimento, ...)
 * recebe `hospitalId` do contexto (AsyncLocalStorage) — em reads, writes,
 * updates e deletes. Sem contexto de tenant válido, a operação é bloqueada.
 * Nenhum serviço precisa filtrar por hospital manualmente.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  // Criptografia de campo em repouso. Instanciado na construção → em produção
  // sem FIELD_ENCRYPTION_KEY o boot falha aqui (fail-closed, PHI não vai em claro).
  private readonly fieldCrypto = new FieldEncryptionService();

  async onModuleInit(): Promise<void> {
    this.$use(async (params, next) => {
      const ctx = currentTenant();
      let scoped: typeof params;
      try {
        scoped = scopeParams(params, ctx);
      } catch (err) {
        if (err instanceof TenantContextError) {
          throw new ForbiddenException(err.message);
        }
        throw err;
      }

      // Criptografia em repouso: cifra os campos PHI ANTES de ir ao banco.
      this.fieldCrypto.encryptWriteArgs(
        scoped.model,
        scoped.args as { data?: unknown; create?: unknown; update?: unknown },
      );

      // RLS — pin de tenant: envolve a operação num modelo tenant numa tx curta
      // com SET LOCAL app.hospital_id, garantindo GUC + query na MESMA conexão
      // (vale p/ LEITURA e ESCRITA — a policy checa USING/WITH CHECK).
      // Guarda ÚNICA: `!params.runInTransaction` — sinal nativo do Prisma de que
      // a operação NÃO está numa tx (se já estiver, o GUC foi setado por quem a
      // abriu: a tx-per-request do interceptor ou um $transaction de service).
      // NÃO usar estado compartilhado (ctx.txClient) como guarda: (a) reads/
      // writes DIRETOS via `this.prisma.X` durante um POST teriam ctx.txClient
      // setado mas NÃO usam aquela tx → ficariam sem GUC; (b) queries
      // concorrentes se atropelam e o ALS não sobrevive ao agendador do Prisma.
      const model = scoped.model ?? '';
      const action = scoped.action as string;
      const isTenantModel = TENANT_MODELS.has(model);
      const isRead = READ_ACTIONS.has(action);

      // Executa a operação pelo caminho adequado (pin de RLS ou direto) e devolve
      // o resultado bruto — a decifra é aplicada UMA vez, depois, sobre ele.
      const exec = async (): Promise<unknown> => {
        // SuperAdmin: LEITURA cross-tenant sob GUC `app.superadmin` (USING libera
        // todos os tenants; escrita segue barrada pelo WITH CHECK). Só READ.
        if (
          RLS_ENABLED &&
          ctx &&
          !params.runInTransaction &&
          ctx.bypassTenant &&
          isTenantModel &&
          isRead
        ) {
          return this.$transaction(async (tx) => {
            await setSuperadminGuc(tx);
            const delegate = (
              tx as unknown as Record<
                string,
                Record<string, (a: unknown) => Promise<unknown>>
              >
            )[delegateName(model)];
            return delegate[action](scoped.args);
          });
        }

        // Tenant comum: pin por hospital_id (leitura E escrita).
        if (
          RLS_ENABLED &&
          ctx &&
          !params.runInTransaction &&
          ctx.hospitalId &&
          isTenantModel &&
          (isRead || WRITE_ACTIONS.has(action))
        ) {
          const hospitalId = ctx.hospitalId;
          return this.$transaction(async (tx) => {
            await setTenantGuc(tx, hospitalId);
            const delegate = (
              tx as unknown as Record<
                string,
                Record<string, (a: unknown) => Promise<unknown>>
              >
            )[delegateName(model)];
            return delegate[action](scoped.args);
          });
        }

        return next(scoped);
      };

      // Criptografia em repouso: decifra os campos PHI DEPOIS de ler do banco.
      return this.fieldCrypto.decryptResult(await exec());
    });

    await this.$connect();
    await this.assertRlsEnforceableInProduction();
  }

  /**
   * Zero-trust no boot: em produção, o RLS só isola de fato se o app conectar
   * como uma role SEM superpoder e SEM BYPASSRLS. Se a role efetiva puder
   * ignorar RLS (superuser, dona com BYPASSRLS, etc.), o isolamento no banco é
   * uma ilusão — então RECUSAMOS subir (fail-closed) em vez de rodar inseguro.
   * Fora de produção, apenas registra um aviso (dev/seed roda como dona).
   */
  private async assertRlsEnforceableInProduction(): Promise<void> {
    const rows = await this.$queryRaw<
      Array<{ rolsuper: boolean; rolbypassrls: boolean; current_user: string }>
    >`SELECT r.rolsuper, r.rolbypassrls, current_user
        FROM pg_roles r WHERE r.rolname = current_user`;
    const role = rows[0];
    const canBypass = !role || role.rolsuper || role.rolbypassrls;
    if (!canBypass) return;

    const msg =
      `A conexão do app usa a role "${role?.current_user ?? '?'}" que pode ` +
      `IGNORAR o RLS (superuser/BYPASSRLS). O isolamento multi-tenant no banco ` +
      `não seria enforçado. Use a role NÃO-dona prontuario_app em DATABASE_URL.`;

    if (process.env.NODE_ENV === 'production' && process.env.RLS_ENABLED === 'true') {
      throw new Error(`[SEGURANÇA] Boot recusado: ${msg}`);
    }
    // eslint-disable-next-line no-console
    console.warn(`[SEGURANÇA] ${msg} (permitido fora de produção)`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
