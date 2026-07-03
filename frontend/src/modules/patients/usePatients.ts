'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiErrorMessage } from '@/services/api';
import { useDebounce } from '@/hooks/useDebounce';
import { patientsService } from './patients.service';
import { toPatientView, type PatientView } from './types';

const PAGE_SIZE = 15;

export function usePatients() {
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<PatientView[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await patientsService.list({
        page,
        pageSize: PAGE_SIZE,
        nome: debounced || undefined,
      });
      setRows(r.items.map(toPatientView));
      setTotal(r.meta.total);
      setTotalPages(r.meta.totalPages);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [page, debounced]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset de página ao buscar.
  useEffect(() => {
    setPage(1);
  }, [debounced]);

  return {
    rows,
    total,
    page,
    totalPages,
    loading,
    error,
    search,
    setSearch,
    setPage,
    reload: load,
  };
}
