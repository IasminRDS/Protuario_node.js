import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { getTraceId } from '../observability/trace-id.middleware';
import { RAW_RESPONSE_KEY } from '../decorators/raw-response.decorator';

export interface StandardResponse<T> {
  success: true;
  data: T;
  message: string;
  traceId?: string;
}

/**
 * Padroniza toda resposta de sucesso (cap. 142 + SNPE):
 *   { success: true, data, message, traceId }
 * Handlers podem retornar { data, message } ou apenas o payload.
 */
@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, StandardResponse<T> | T>
{
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardResponse<T> | T> {
    const raw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (raw) {
      return next.handle(); // resposta crua (ex.: recursos FHIR)
    }

    const traceId = getTraceId(context.switchToHttp().getRequest());
    return next.handle().pipe(
      map((payload) => {
        if (
          payload &&
          typeof payload === 'object' &&
          'data' in payload &&
          'message' in payload
        ) {
          return {
            success: true,
            data: (payload as { data: T }).data,
            message: (payload as { message: string }).message,
            traceId,
          };
        }
        return {
          success: true,
          data: payload as T,
          message: 'Operação realizada com sucesso.',
          traceId,
        };
      }),
    );
  }
}
