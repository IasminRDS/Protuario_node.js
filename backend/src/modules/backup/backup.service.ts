import { spawn } from 'child_process';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuditExportService } from '../audit/audit.service';
import { currentHospitalId } from '../../shared/tenant/tenant-context';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';

export type BackupFormat = 'sql' | 'dump';

// Configuráveis por ambiente (nunca por entrada do usuário → sem injeção).
const PG_DUMP = process.env.PG_DUMP_PATH || 'pg_dump';
const TIMEOUT_MS = Number(process.env.BACKUP_TIMEOUT_MS ?? 10 * 60_000); // 10 min
const MAX_BYTES = Number(process.env.BACKUP_MAX_BYTES ?? 2 * 1024 * 1024 * 1024); // 2 GB

interface Conn {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

/**
 * Backup lógico do PostgreSQL via `pg_dump`, transmitido em STREAM (sem carregar
 * na memória, com backpressure). Segurança:
 *  - argumentos em ARRAY (spawn sem shell) → sem execução arbitrária/injeção;
 *  - conexão vem de DATABASE_URL (env), NUNCA do request;
 *  - senha via PGPASSWORD no ambiente do processo filho (não vai em args/logs);
 *  - timeout + limite de bytes; auditoria LGPD sempre (sucesso/falha).
 * ATENÇÃO: pg_dump é GLOBAL (todos os tenants) → endpoint restrito a SuperAdmin.
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(private readonly auditExport: AuditExportService) {}

  stream(res: Response, actor: AuthenticatedUser, format: BackupFormat): void {
    const conn = this.parseDbUrl(); // pode lançar (500) antes de qualquer header
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `backup-${conn.database}-${timestamp}.${format}`;

    const args = [
      '-h', conn.host,
      '-p', conn.port,
      '-U', conn.user,
      '-d', conn.database,
      '--no-owner',
      '--no-privileges',
      '-F', format === 'dump' ? 'c' : 'p',
    ];

    const child = spawn(PG_DUMP, args, {
      env: { ...process.env, PGPASSWORD: conn.password }, // senha fora de args/log
    });

    let started = false;
    let bytes = 0;
    let stderr = '';
    let done = false;

    const finalize = (sucesso: boolean, motivo?: string): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (!sucesso) this.logger.warn(`Backup falhou: ${motivo ?? 'desconhecido'}`);
      void this.auditar(actor, sucesso, filename, motivo);
    };

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finalize(false, 'timeout');
      if (!res.writableEnded) res.destroy();
    }, TIMEOUT_MS);

    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });

    child.stdout.on('data', (chunk: Buffer) => {
      if (!started) {
        started = true;
        res.setHeader(
          'Content-Type',
          format === 'dump' ? 'application/octet-stream' : 'application/sql',
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${filename}"`,
        );
      }
      bytes += chunk.length;
      if (bytes > MAX_BYTES) {
        child.kill('SIGKILL');
        finalize(false, 'limite de tamanho excedido');
        if (!res.writableEnded) res.destroy();
        return;
      }
      // Backpressure: pausa o dump enquanto o socket não drena.
      if (!res.write(chunk)) {
        child.stdout.pause();
        res.once('drain', () => child.stdout.resume());
      }
    });

    child.on('error', (err: NodeJS.ErrnoException) => {
      finalize(false, err.code === 'ENOENT' ? 'pg_dump não encontrado' : err.message);
      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          message:
            err.code === 'ENOENT'
              ? 'pg_dump não está disponível no servidor.'
              : 'Falha ao iniciar o backup.',
        });
      } else if (!res.writableEnded) {
        res.destroy();
      }
    });

    child.on('close', (code) => {
      if (code === 0) {
        finalize(true);
        if (!started) {
          // Dump vazio (improvável): ainda assim entrega um arquivo válido.
          res.setHeader('Content-Type', 'application/sql');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        }
        if (!res.writableEnded) res.end();
      } else {
        finalize(false, `pg_dump exit ${code}: ${stderr.slice(0, 300)}`);
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: 'Falha ao gerar o backup.' });
        } else if (!res.writableEnded) {
          res.destroy();
        }
      }
    });
  }

  private parseDbUrl(): Conn {
    // RLS: pg_dump precisa da role DONA — como não-dona (prontuario_app) ele
    // recusa tabelas com RLS (ou dumparia só as linhas visíveis, i.e. nenhuma).
    const raw =
      process.env.MAINTENANCE_DATABASE_URL || process.env.DATABASE_URL;
    if (!raw) {
      throw new ServiceUnavailableException('DATABASE_URL não configurado.');
    }
    const u = new URL(raw);
    return {
      host: u.hostname,
      port: u.port || '5432',
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, ''),
    };
  }

  private async auditar(
    actor: AuthenticatedUser,
    sucesso: boolean,
    filename: string,
    motivo?: string,
  ): Promise<void> {
    await this.auditExport.logExport({
      tipo: 'BACKUP',
      acao: 'GERAR_BACKUP',
      status: sucesso ? 'SUCESSO' : 'FALHA',
      userId: actor.id,
      hospitalId: currentHospitalId(), // SuperAdmin: null (cross-tenant)
      metadata: { filename, ...(motivo ? { erro: motivo } : {}) },
    });
  }
}
