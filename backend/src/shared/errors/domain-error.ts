/**
 * Erro de regra de negócio / domínio. Lançado pelos Services quando uma
 * invariante do domínio é violada (ex.: RN-009 exclusão com histórico).
 * O AllExceptionsFilter o traduz para HTTP 422 sem vazar detalhes internos.
 */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
