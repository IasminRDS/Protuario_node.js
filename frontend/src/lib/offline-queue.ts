'use client';

import { create } from 'zustand';
import { api } from '@/services/api';

/**
 * Fila offline (modo UBS — ADR-10): mutações selecionadas são enfileiradas em
 * IndexedDB quando não há rede e sincronizadas ao reconectar. Cada item carrega
 * uma Idempotency-Key fixa — o backend deduplica reenvios (retry seguro).
 */
export interface QueuedMutation {
  id?: number;
  url: string;
  method: 'post';
  body: unknown;
  idempotencyKey: string;
  label: string; // descrição p/ UI (ex.: "Triagem — João")
  queuedAt: string;
}

const DB_NAME = 'spe-offline';
const STORE = 'queue';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

async function listQueue(): Promise<QueuedMutation[]> {
  return tx<QueuedMutation[]>('readonly', (s) => s.getAll() as IDBRequest<QueuedMutation[]>);
}

async function addToQueue(entry: QueuedMutation): Promise<void> {
  await tx('readwrite', (s) => s.add(entry));
}

async function removeFromQueue(id: number): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

// --- Estado observável para a UI (Topbar) -----------------------------------

interface OfflineState {
  online: boolean;
  pending: number;
  syncing: boolean;
}

export const useOfflineStore = create<OfflineState>(() => ({
  online: true,
  pending: 0,
  syncing: false,
}));

async function refreshPending(): Promise<void> {
  try {
    const itens = await listQueue();
    useOfflineStore.setState({ pending: itens.length });
  } catch {
    /* IndexedDB indisponível (SSR/modo privado) — indicador fica em 0 */
  }
}

/** Erro de REDE (sem resposta do servidor) → candidato à fila offline. */
function isNetworkError(err: unknown): boolean {
  const e = err as { request?: unknown; response?: unknown } | null;
  return !!e && !!e.request && !e.response;
}

/**
 * POST resiliente: tenta online; sem rede, enfileira e resolve com
 * `{ queued: true }`. O chamador decide a mensagem ao usuário.
 */
export async function postWithOfflineQueue<T>(
  url: string,
  body: unknown,
  label: string,
): Promise<{ queued: false; data: T } | { queued: true }> {
  const idempotencyKey =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  if (!offline) {
    try {
      const { data } = await api.post(url, body, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });
      return { queued: false, data: data.data as T };
    } catch (err) {
      if (!isNetworkError(err)) throw err; // erro de negócio → propaga
    }
  }

  await addToQueue({
    url,
    method: 'post',
    body,
    idempotencyKey,
    label,
    queuedAt: new Date().toISOString(),
  });
  await refreshPending();
  return { queued: true };
}

/** Sincroniza a fila (ordem FIFO). Para no primeiro erro de rede. */
export async function flushOfflineQueue(): Promise<void> {
  if (useOfflineStore.getState().syncing) return;
  useOfflineStore.setState({ syncing: true });
  try {
    const itens = (await listQueue()).sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    for (const item of itens) {
      try {
        await api.post(item.url, item.body, {
          headers: { 'Idempotency-Key': item.idempotencyKey },
        });
        await removeFromQueue(item.id!);
      } catch (err) {
        if (isNetworkError(err)) return; // ainda sem rede — tenta depois
        // Rejeição do servidor (4xx/5xx com resposta): reenviar o mesmo payload
        // não vai mudar o resultado — descarta para não travar a fila.
        console.warn('[offline-queue] item rejeitado pelo servidor; descartado:', item.label, err);
        await removeFromQueue(item.id!);
      }
    }
  } finally {
    useOfflineStore.setState({ syncing: false });
    await refreshPending();
  }
}

/** Liga os listeners de conectividade (chamar 1x no boot do app, client-side). */
export function initOfflineSync(): void {
  if (typeof window === 'undefined') return;
  useOfflineStore.setState({ online: navigator.onLine });
  window.addEventListener('online', () => {
    useOfflineStore.setState({ online: true });
    void flushOfflineQueue();
  });
  window.addEventListener('offline', () => useOfflineStore.setState({ online: false }));
  void refreshPending();
  if (navigator.onLine) void flushOfflineQueue();
}
