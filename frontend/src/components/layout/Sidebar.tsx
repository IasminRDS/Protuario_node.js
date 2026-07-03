'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/modules/shared/rbac/usePermissions';
import { NAV } from '@/modules/shared/rbac/nav';
import { cn } from '@/utils/cn';

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { canAny } = usePermissions();
  if (!user) return null;

  const items = NAV.filter((i) => !i.any || canAny(i.any));

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4">
        <Activity className="h-6 w-6 text-clinic-primary" />
        <div>
          <p className="text-sm font-bold text-slate-800">S-PE</p>
          <p className="text-[11px] text-slate-400">Prontuário Eletrônico</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-clinic-primary/10 text-clinic-primary'
                  : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-3 text-[11px] text-slate-400">
        Perfil: <span className="font-medium text-slate-600">{user.perfil}</span>
      </div>
    </aside>
  );
}
