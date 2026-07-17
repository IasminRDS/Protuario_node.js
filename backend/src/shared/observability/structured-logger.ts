import { currentCorrelation } from '../tenant/tenant-context';

/**
 * Logging estruturado (JSON) com correlação forense (traceId/userId/tenantId
 * do contexto de requisição). Uma linha por evento, apto a ELK/Loki.
 */
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogFields {
  traceId?: string;
  [key: string]: unknown;
}

export function logJson(
  level: LogLevel,
  context: string,
  message: string,
  fields: LogFields = {},
): void {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    context,
    message,
    ...currentCorrelation(), // traceId/userId/tenantId do ALS (correlação)
    ...fields, // campos explícitos podem sobrescrever
  });
  // stdout/stderr: coletados pelo agregador central de logs.
  if (level === 'error') {
    // eslint-disable-next-line no-console
    console.error(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}
