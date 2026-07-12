/* Service worker do modo UBS (ADR-10) — versão CONSERVADORA.
 *
 * Sistema clínico: NUNCA servir uma página (HTML) desatualizada de cache — isso
 * poderia exibir dados/telas obsoletos. Portanto:
 *  - assets estáticos do Next (/_next/static/*, ícones): cache-first — são
 *    versionados por hash no nome, então nunca ficam obsoletos;
 *  - navegações (HTML) e /api/*: NETWORK-ONLY, sem cache e sem fallback. Se
 *    estiver offline, a página não abre — mas o caminho crítico offline (registro
 *    de triagem/atendimento) é tratado pela FILA IndexedDB do app (offline-queue),
 *    que independe do service worker.
 *
 * Bump de CACHE invalida qualquer cache de versão anterior no activate.
 */
const CACHE = 'spe-static-v2';
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
  if (url.origin !== self.location.origin) return;

  // SOMENTE assets estáticos imutáveis são cacheados (cache-first). Todo o
  // resto — navegações e API — passa direto para a rede, sem cache.
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
  }
});
