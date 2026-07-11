'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/modules/shared/rbac/usePermissions';
import { NAV_GROUPS, type NavItem } from '@/modules/shared/rbac/nav';
import { cn } from '@/utils/cn';

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { canAny } = usePermissions();
  if (!user) return null;

  const visivel = (i: NavItem) => {
    // Item por perfil (ex.: export/backup): visível se o perfil casar.
    if (i.roles) return i.roles.includes(user.perfil);
    // Item por permissão granular (ou liberado a todos autenticados).
    return !i.any || canAny(i.any);
  };

  const grupos = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter(visivel),
  })).filter((g) => g.items.length > 0);

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-clinic-primary">
          <Activity className="h-5 w-5 text-white" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-bold text-slate-800">SNPE</p>
          <p className="text-[11px] text-slate-400">Prontuário Eletrônico Nacional</p>
        </div>
      </div>

      <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto p-2">
        {grupos.map((grupo, gi) => (
          <div key={grupo.titulo ?? gi} className={gi > 0 ? 'mt-3' : undefined}>
            {grupo.titulo && (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {grupo.titulo}
              </p>
            )}
            <div className="space-y-0.5">
              {grupo.items.map((item) => {
                const active = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-clinic-primary/10 text-clinic-primary'
                        : 'text-slate-600 hover:bg-slate-100',
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-3 text-[11px] text-slate-400">
        Perfil: <span className="font-medium text-slate-600">{user.perfil}</span>
      </div>
    </aside>
  );
}
