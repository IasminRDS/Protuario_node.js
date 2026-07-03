'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/services/api';

/**
 * Soft-lock de edição concorrente (prontuário aberto por 2 profissionais).
 * Integrado ao backend real:
 *   POST /locks/acquire   { resource, resourceId } -> { lockId, holder, acquired }
 *   POST /locks/heartbeat { lockId }
 *   POST /locks/release   { lockId }
 *   GET  /locks/:resource/:resourceId -> { holder | null }
 */
export type LockState = 'ACQUIRING' | 'HELD_BY_ME' | 'HELD_BY_OTHER' | 'UNAVAILABLE';

interface AcquireResp {
  data: { lockId: string; holder: string; acquired: boolean };
}
interface HolderResp {
  data: { holder: string | null };
}

export function useSoftLock(resource: string, resourceId: string | null) {
  const [state, setState] = useState<LockState>('ACQUIRING');
  const [holder, setHolder] = useState<string | null>(null);
  const lockId = useRef<string | null>(null);

  useEffect(() => {
    if (!resourceId) return;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let active = true;

    async function acquire() {
      try {
        const { data } = await api.post<AcquireResp>('/locks/acquire', {
          resource,
          resourceId,
        });
        if (!active) return;
        lockId.current = data.data.lockId;
        setHolder(data.data.holder);
        setState(data.data.acquired ? 'HELD_BY_ME' : 'HELD_BY_OTHER');

        if (data.data.acquired) {
          heartbeat = setInterval(() => {
            api.post('/locks/heartbeat', { lockId: lockId.current }).catch(() => undefined);
          }, 15000);
        } else {
          poll = setInterval(async () => {
            try {
              const { data: g } = await api.get<HolderResp>(
                `/locks/${resource}/${resourceId}`,
              );
              if (!g.data.holder && active) {
                if (poll) clearInterval(poll);
                acquire(); // liberou -> tenta assumir
              }
            } catch {
              /* ignora */
            }
          }, 5000);
        }
      } catch {
        if (active) setState('UNAVAILABLE');
      }
    }

    acquire();

    return () => {
      active = false;
      if (heartbeat) clearInterval(heartbeat);
      if (poll) clearInterval(poll);
      if (lockId.current) {
        api.post('/locks/release', { lockId: lockId.current }).catch(() => undefined);
      }
    };
  }, [resource, resourceId]);

  return { state, holder, isEditable: state === 'HELD_BY_ME' || state === 'UNAVAILABLE' };
}
