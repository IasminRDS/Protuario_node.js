'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { cn } from '@/utils/cn';
import {
  Input,
  TableSkeleton,
  EmptyState,
  ErrorState,
  Button,
} from '@/components/ui/primitives';

function compareValues(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** valor usado para ordenação (default: não ordenável) */
  sortValue?: (row: T) => string | number;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** busca controlada (server-side). Se ausente, usa busca client-side. */
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  /** paginação server-side opcional */
  pagination?: {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
  onRowClick?: (row: T) => void;
  emptyLabel?: string;
}

/**
 * DataTable avançada: ordenação client-side, busca (client ou server),
 * paginação (server), loading/erro/vazio. Genérica e tipada.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  search,
  onSearchChange,
  searchPlaceholder = 'Buscar...',
  pagination,
  onRowClick,
  emptyLabel = 'Nenhum registro encontrado',
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(
    null,
  );
  const [localSearch, setLocalSearch] = useState('');
  const serverSearch = onSearchChange !== undefined;
  const searchValue = serverSearch ? (search ?? '') : localSearch;

  const sortedRows = useMemo(() => {
    let data = rows;
    if (!serverSearch && localSearch.trim()) {
      const q = localSearch.toLowerCase();
      data = data.filter((r) =>
        columns.some((c) =>
          String(c.sortValue?.(r) ?? '').toLowerCase().includes(q),
        ),
      );
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sortValue) {
        data = [...data].sort((a, b) => {
          const cmp = compareValues(col.sortValue!(a), col.sortValue!(b));
          return sort.dir === 'asc' ? cmp : -cmp;
        });
      }
    }
    return data;
  }, [rows, sort, localSearch, serverSearch, columns]);

  function toggleSort(key: string) {
    setSort((prev) =>
      prev?.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) =>
              serverSearch
                ? onSearchChange?.(e.target.value)
                : setLocalSearch(e.target.value)
            }
          />
        </div>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : sortedRows.length === 0 ? (
        <EmptyState title={emptyLabel} />
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn('px-4 py-2 font-medium', c.className)}
                >
                  {c.sortValue ? (
                    <button
                      className="inline-flex items-center gap-1 hover:text-slate-700"
                      onClick={() => toggleSort(c.key)}
                    >
                      {c.header}
                      {sort?.key === c.key &&
                        (sort.dir === 'asc' ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        ))}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedRows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'hover:bg-slate-50',
                  onRowClick && 'cursor-pointer',
                )}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-4 py-2.5', c.className)}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
          <span>
            Página {pagination.page} de {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="secondary"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
