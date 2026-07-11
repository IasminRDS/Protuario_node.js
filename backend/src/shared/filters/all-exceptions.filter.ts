import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { DomainError } from '../errors/domain-error';
import { getTraceId } from '../observability/trace-id.middleware';

/**
 * Tratamento centralizado de erros (cap. 30/156). Nunca expõe stack trace, SQL
 * ou detalhes internos ao cliente. Formato de erro padronizado:
 *   { success: false, timestamp, path, error: { code, message } }
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Erro interno do servidor.';

    // Quarentena (P0.2): o trigger de banco levanta REGISTRO_CLINICO_EM_QUARENTENA.
    // Chega aqui como erro Prisma não-tipado; padronizamos o contrato de erro
    // (§3.5) em vez de vazar um 500 genérico. Verificado antes dos demais ramos.
    const rawMessage = exception instanceof Error ? exception.message : String(exception);

    if (rawMessage.includes('REGISTRO_CLINICO_EM_QUARENTENA')) {
      status = HttpStatus.CONFLICT;
      code = 'REGISTRO_CLINICO_EM_QUARENTENA';
      message =
        'Registro clínico bloqueado por inconsistência de vínculo institucional';
    } else if (exception instanceof DomainError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      code = exception.code;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      code = this.codeFromStatus(status);
      message =
        typeof res === 'string'
          ? res
          : ((res as Record<string, unknown>).message as string) ??
            exception.message;
      if (Array.isArray(message)) {
        message = (message as string[]).join('; ');
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      ({ status, code, message } = this.mapPrismaError(exception));
    }

    const traceId = getTraceId(request);

    // Log completo apenas do lado do servidor (com stack para 5xx).
    if (status >= 500) {
      this.logger.error(
        `[${traceId}] ${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      // Erros de banco 4xx: inclui código/motivo Prisma no log (server-side
      // apenas) — sem isso, um DB_ERROR intermitente é indiagnosticável.
      const detalhe =
        exception instanceof Prisma.PrismaClientKnownRequestError
          ? ` — ${exception.code}: ${exception.message.split('\n').filter(Boolean).pop()}`
          : '';
      this.logger.warn(
        `[${traceId}] ${request.method} ${request.url} -> ${status} ${code}${detalhe}`,
      );
    }

    response.status(status).json({
      success: false,
      timestamp: new Date().toISOString(),
      path: request.url,
      error: { code, message },
      traceId,
    });
  }

  private mapPrismaError(e: Prisma.PrismaClientKnownRequestError): {
    status: number;
    code: string;
    message: string;
  } {
    switch (e.code) {
      case 'P2002': // unique constraint
        return {
          status: HttpStatus.CONFLICT,
          code: 'CONFLICT',
          message: 'Registro já existente (violação de unicidade).',
        };
      case 'P2025': // not found
        return {
          status: HttpStatus.NOT_FOUND,
          code: 'NOT_FOUND',
          message: 'Registro não encontrado.',
        };
      case 'P2003': // FK constraint
        return {
          status: HttpStatus.CONFLICT,
          code: 'FK_CONSTRAINT',
          message: 'Operação viola integridade referencial.',
        };
      default:
        return {
          status: HttpStatus.BAD_REQUEST,
          code: 'DB_ERROR',
          message: 'Não foi possível processar a operação.',
        };
    }
  }

  private codeFromStatus(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'VALIDATION_ERROR',
    };
    return map[status] ?? 'ERROR';
  }
}
