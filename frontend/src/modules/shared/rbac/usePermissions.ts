'use client';

import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  hasAny,
  hasPermission,
  permissionsFor,
  type Permission,
} from './permissions';

export function usePermissions() {
  const { user } = useAuth();

  const granted = useMemo(
    () => (user ? permissionsFor(user.perfil) : new Set<Permission>()),
    [user],
  );

  return {
    granted,
    can: (perm: Permission) => hasPermission(granted, perm),
    canAny: (perms: Permission[]) => hasAny(granted, perms),
  };
}
