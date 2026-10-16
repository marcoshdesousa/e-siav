// Service worker do App do DBV: app instalável e que abre sem internet.
// Sem internet funcionam: entrar (quem já entrou antes neste aparelho), os mini jogos e colar
// figurinhas. O resto precisa de internet. A lista de arquivos do app é colocada no build.
const BUILD = '__BUILD__';
const CACHE = 'dbv-' + BUILD;
const PRECACHE = self.__PRECACHE__ || [];
const SHELL = ['/', '/atualizando.html', '/manifest.webmanifest', '/favicon.ico', '/marca/logo.png', '/marca/favicon.png', '/marca/icon-192.png', '/marca/icon-512.png'];

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
  if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
  return res;
};

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws')) return; // dados sempre da rede
  if (e.request.mode === 'navigate') {
    // Servidor fora do ar (atualização ou erro: 502, 503, 504): mostra "Sistema em atualização".
    // Sem internet: abre o app guardado no aparelho.
    const atualizando = () => caches.match('/atualizando.html').then((hit) => hit || Response.redirect('/atualizando.html', 302));
    e.respondWith(fetch(e.request)
      .then((res) => ([502, 503, 504].includes(res.status) && url.pathname !== '/atualizando.html' ? atualizando() : (url.pathname === '/' && res.ok ? save('/', res) : res)))
      .catch(() => caches.match('/')));
    return;
  }
  // Arquivos do build, imagens e modelos 3D dos jogos têm nome fixo por versão: vêm do cache.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/img/') || url.pathname.startsWith('/models/')) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => save(e.request, res))));
    return;
  }
  // Logo, ícones e manifesto: sempre a versão mais nova; o cache só vale sem internet.
  if (url.pathname.startsWith('/marca/') || url.pathname === '/manifest.webmanifest' || url.pathname === '/favicon.ico') {
    e.respondWith(fetch(e.request).then((res) => (res.ok ? save(e.request, res) : caches.match(e.request).then((hit) => hit || res)))
      .catch(() => caches.match(e.request)));
  }
});
