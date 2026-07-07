'use client';

import { FileDown } from 'lucide-react';
import { Button } from '@/components/ui/primitives';

/**
 * Botão reutilizável de geração/download de PDF. Presentacional (a mutation e o
 * tratamento de erro ficam no componente que o usa). Construído sobre o Button
 * do design system (que já expõe `loading`).
 */
export function PdfButton({
  onClick,
  loading,
  label,
  variant = 'secondary',
}: {
  onClick: () => void;
  loading?: boolean;
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost';
}) {
  return (
    <Button variant={variant} loading={loading} onClick={onClick}>
      {!loading && <FileDown className="h-4 w-4" />}
      {loading ? 'Gerando…' : label}
    </Button>
  );
}
