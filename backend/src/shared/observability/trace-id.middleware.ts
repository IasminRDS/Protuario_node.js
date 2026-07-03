import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { v7 as uuidv7 } from 'uuid';

export const TRACE_ID_HEADER = 'x-trace-id';

/**
 * Propaga (ou gera) um traceId por requisição, disponibilizado em req.traceId
 * e devolvido no header de resposta. Base da observabilidade ponta a ponta.
 */
@Injectable()
export class TraceIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header(TRACE_ID_HEADER);
    const traceId = incoming && incoming.trim() ? incoming.trim() : uuidv7();
    (req as Request & { traceId: string }).traceId = traceId;
    res.setHeader(TRACE_ID_HEADER, traceId);
    next();
  }
}

export function getTraceId(req: unknown): string | undefined {
  return (req as { traceId?: string } | undefined)?.traceId;
}
