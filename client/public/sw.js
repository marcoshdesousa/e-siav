// Service worker do App do DBV: só é instalado para quem é DBV+ (veja client/src/offline.js).
// Guarda o app no aparelho para os jogos funcionarem sem internet; o resto precisa de internet.
// A lista de arquivos do app é colocada no build.
importScripts('/sw-push.js');
const BUILD = '__BUILD__';
const CACHE = 'dbv-' + BUILD;
const PRECACHE = self.__PRECACHE__ || [];
const SHELL = ['/', '/manifest.webmanifest', '/favicon.ico'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(SHELL).catch(() => {});
    // Um por um: se algum falhar, o resto continua.
    await Promise.all(PRECACHE.map((u) => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

const save = (req, res) => {
  if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
  return res;
};

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/audio/') || url.pathname.startsWith('/uploads/')) return; // sempre da rede
  if (e.request.mode === 'navigate') {
    // Com internet, sempre o app mais novo; sem internet, o app guardado.
    e.respondWith(fetch(e.request)
      .then((res) => (url.pathname === '/' && res.ok ? save('/', res) : res))
      .catch(() => caches.match('/')));
    return;
  }
  // Arquivos do build têm nome fixo por versão: vêm do cache.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/img/')) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => save(e.request, res))));
    return;
  }
  // Logo, ícones e manifesto: sempre a versão mais nova; o cache só vale sem internet.
  if (url.pathname.startsWith('/marca/') || url.pathname === '/manifest.webmanifest' || url.pathname === '/favicon.ico') {
    e.respondWith(fetch(e.request).then((res) => save(e.request, res)).catch(() => caches.match(e.request)));
  }
});
