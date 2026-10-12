// Service worker do Exploradores do Brasil: app instalável e tela inicial disponível offline.
const CACHE = 'dbv-v24';
const SHELL = ['/', '/atualizando.html', '/manifest.webmanifest', '/favicon.ico', '/marca/logo.png', '/marca/favicon.png', '/marca/icon-192.png', '/marca/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
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
    const atualizando = () => caches.match('/atualizando.html').then((hit) => hit || Response.redirect('/atualizando.html', 302));
    e.respondWith(fetch(e.request).then((res) => ([502, 503, 504].includes(res.status) && url.pathname !== '/atualizando.html' ? atualizando() : res))
      .catch(() => caches.match('/')));
    return;
  }
  // Arquivos do build têm nome único: podem vir direto do cache.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/uploads/')) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => save(e.request, res))));
    return;
  }
  // Logo, ícones e manifesto: sempre a versão mais nova; o cache só vale sem internet.
  if (url.pathname.startsWith('/marca/') || url.pathname === '/manifest.webmanifest' || url.pathname === '/favicon.ico') {
    e.respondWith(fetch(e.request).then((res) => (res.ok ? save(e.request, res) : caches.match(e.request).then((hit) => hit || res)))
      .catch(() => caches.match(e.request)));
  }
});
