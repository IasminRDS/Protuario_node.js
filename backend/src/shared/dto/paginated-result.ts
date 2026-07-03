/** Estrutura padrão de resultado paginado retornado pelos Services. */
export interface PaginatedResult<T> {
  items: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export function buildPaginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  return {
    items,
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}
