'use client';

import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from './usePermissions';
import { NAV_GROUPS, type NavGroup, type NavItem } from './nav';

/**
 * Grupos de navegação visíveis para o usuário atual (RBAC aplicado item a
 * item). Fonte única para a Sidebar e para os cards de categoria do Dashboard.
 */
export function useVisibleNavGroups(): NavGroup[] {
  const { user } = useAuth();
  const { canAny } = usePermissions();

  return useMemo(() => {
    if (!user) return [];
    const visivel = (i: NavItem) => {
      // Item por perfil (ex.: export/backup): visível se o perfil casar.
      if (i.roles) return i.roles.includes(user.perfil);
      // Item por permissão granular (ou liberado a todos autenticados).
      return !i.any || canAny(i.any);
    };
    return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter(visivel) })).filter(
      (g) => g.items.length > 0,
    );
  }, [user, canAny]);
}
