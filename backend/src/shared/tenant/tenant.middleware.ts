import { randomUUID } from 'crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { tenantStore } from './tenant-context';

/**
 * Estabelece o contexto de tenant no início da requisição (objeto mutável).
 * O JwtStrategy, que roda depois (downstream, dentro deste ALS), preenche
 * hospitalId/userId. Assim todo o handler e os serviços enxergam o tenant.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: NextFunction): void {
    tenantStore.run(
      {
        hospitalId: null,
        userId: null,
        bypassTenant: false,
        requestId: randomUUID(),
      },
      () => next(),
    );
  }
}
