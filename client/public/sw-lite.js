// Service worker de quem não é DBV+: só os lembretes no celular. Nada fica guardado no aparelho.
importScripts('/sw-push.js');
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
