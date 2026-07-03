'use client';

import { useRouter } from 'next/navigation';
import { LogOut, UserCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/primitives';

export function Topbar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="text-sm text-slate-500">
        {new Date().toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <UserCircle2 className="h-5 w-5 text-slate-400" />
          <span className="font-medium text-slate-700">{user?.login}</span>
        </div>
        <Button variant="ghost" onClick={handleLogout} title="Sair">
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </header>
  );
}
