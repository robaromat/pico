/* Service worker de Pico : app utilisable hors connexion (repris de Boire & Manger).
 * Généré au build : vite.config.ts y injecte le numéro de version et la liste des fichiers de l'app.
 *  - coquille de l'app (HTML, JS, CSS, icônes) : en cache à l'installation, servie même sans réseau ;
 *  - polices Google : servies du cache puis rafraîchies ;
 *  - API GitHub : jamais mises en cache (données et clés privées).
 * Les données elles-mêmes vivent dans IndexedDB, gérées par l'app.
 */
const VERSION = __VERSION__;
const PRECACHE = __PRECACHE__;
const SHELL = `pico-shell-${VERSION}`;
const FONTS = 'pico-fonts';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

const scopeUrl = (p) => new URL(p, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE.map(scopeUrl))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k.startsWith('pico-shell-') && k !== SHELL) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

// L'app demande d'activer la nouvelle version quand tu touches « Mettre à jour ».
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const inScope = url.origin === self.location.origin && url.href.startsWith(self.registration.scope);

  // Pages de l'app : réseau d'abord, cache si hors ligne.
  if (req.mode === 'navigate' && inScope) {
    event.respondWith(
      (async () => {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 4000);
          const res = await fetch(req, { signal: ctrl.signal });
          clearTimeout(t);
          return res;
        } catch {
          return (await caches.match(scopeUrl('./'), { ignoreSearch: true })) || Response.error();
        }
      })(),
    );
    return;
  }

  // Fichiers de l'app (noms avec empreinte) : cache d'abord.
  if (inScope) {
    event.respondWith(
      (async () => {
        const hit = await caches.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) (await caches.open(SHELL)).put(req, res.clone());
        return res;
      })(),
    );
    return;
  }

  // Polices : cache, puis mise à jour en arrière-plan.
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(
      (async () => {
        const c = await caches.open(FONTS);
        const hit = await c.match(req);
        const refresh = fetch(req)
          .then((res) => {
            if (res.ok || res.type === 'opaque') c.put(req, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || refresh;
      })(),
    );
  }
  // Tout le reste (API) : comportement normal du navigateur, rien en cache.
});
