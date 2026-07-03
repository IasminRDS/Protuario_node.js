'use client';

import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

/* ---------------- Button ---------------- */
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', loading, children, disabled, ...props }, ref) => {
    const variants: Record<string, string> = {
      primary: 'bg-clinic-primary text-white hover:bg-clinic-primary-dark',
      secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
      ghost: 'text-slate-600 hover:bg-slate-100',
      danger: 'bg-red-600 text-white hover:bg-red-700',
    };
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
          variants[variant],
          className,
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

/* ---------------- Input / Label / Field ---------------- */
export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-clinic-primary focus:ring-2 focus:ring-clinic-primary/20',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
      {error && <span className="block text-xs text-red-600">{error}</span>}
    </label>
  );
}

/* ---------------- Card ---------------- */
export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-slate-200 bg-white shadow-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ---------------- Badge ---------------- */
export function Badge({
  children,
  tone = 'slate',
}: {
  children: React.ReactNode;
  tone?: 'slate' | 'green' | 'amber' | 'red' | 'blue';
}) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

/* ---------------- PageHeader ---------------- */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

/* ---------------- Skeleton ---------------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-slate-200', className)} />;
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

/* ---------------- States ---------------- */
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="p-10 text-center">
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="p-8 text-center">
      <p className="text-sm font-medium text-red-600">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-3" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
