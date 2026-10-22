// O App do DBV não funciona mais sem internet: este service worker só existe para se remover dos
// aparelhos que instalaram a versão antiga (apaga o cache e se desliga). Nada fica guardado.
const BUILD = '__BUILD__';
void BUILD;
void (self.__PRECACHE__ || []);
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) await caches.delete(k);
    await self.registration.unregister();
    for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url).catch(() => {});
  })());
});
