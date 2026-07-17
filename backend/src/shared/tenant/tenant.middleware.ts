import { randomUUID } from 'crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { tenantStore } from './tenant-context';

/**
 * Estabelece o contexto de tenant no início da requisição (objeto mutável).
 * O JwtStrategy, que roda depois (downstream, dentro deste ALS), preenche
 * hospitalId/userId. Assim todo o handler e os serviços enxergam o tenant.
 */
// Aceita apenas ids de correlação "sãos" (evita log/response-splitting via
// header do cliente). Fora do padrão → gera um novo.
const SAFE_ID = /^[A-Za-z0-9._-]{1,128}$/;

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Propaga o id de correlação de entrada (gateway/serviço a montante) se for
    // seguro; senão gera um novo. Devolve no header para o cliente correlacionar.
    const incoming = req.header('x-request-id');
    const requestId = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader('X-Request-Id', requestId);

    tenantStore.run(
      {
        hospitalId: null,
        userId: null,
        bypassTenant: false,
        requestId,
      },
      () => next(),
    );
  }
}
