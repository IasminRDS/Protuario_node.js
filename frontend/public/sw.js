/* Service worker do modo UBS (ADR-10).
 *
 * Estratégia conservadora para sistema clínico:
 *  - assets estáticos do Next (/_next/static, ícones): cache-first (imutáveis);
 *  - navegações: network-first com fallback ao último shell cacheado (offline);
 *  - API (/api/): NUNCA interceptada — dados clínicos não podem ser servidos
 *    de cache; mutações offline vão pela fila IndexedDB do app (offline-queue).
 */
const CACHE = 'spe-shell-v1';
const STATIC_PATTERNS = [/^\/_next\/static\//, /^\/icon\.svg$/, /^\/manifest\.json$/];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // só mesma origem
  if (url.pathname.startsWith('/api/')) return; // API nunca cacheada

  // Assets estáticos: cache-first.
  if (STATIC_PATTERNS.some((p) => p.test(url.pathname))) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Navegações: network-first, fallback ao shell cacheado quando offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(async () => {
          const hit = await caches.match(req);
          if (hit) return hit;
          // Última tentativa: qualquer página cacheada do app (shell).
          const all = await caches.open(CACHE).then((c) => c.keys());
          const page = all.find((r) => new URL(r.url).pathname !== '/manifest.json');
          return page ? caches.match(page) : Response.error();
        }),
    );
  }
});
