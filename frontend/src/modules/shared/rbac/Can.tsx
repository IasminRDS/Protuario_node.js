'use client';

import type { ReactNode } from 'react';
import { usePermissions } from './usePermissions';
import type { Permission } from './permissions';

/**
 * Gate declarativo de UI: renderiza children só se a permissão for concedida.
 * <Can perm="patient:create"><Button/></Can>
 */
export function Can({
  perm,
  any,
  fallback = null,
  children,
}: {
  perm?: Permission;
  any?: Permission[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { can, canAny } = usePermissions();
  const allowed = perm ? can(perm) : any ? canAny(any) : true;
  return <>{allowed ? children : fallback}</>;
}
