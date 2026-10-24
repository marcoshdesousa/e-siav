// Lembretes no celular (Web Push): mostra a notificação e, ao tocar, abre o app na tela certa.
// Usado pelos dois service workers (sw.js do DBV+ e sw-lite.js dos demais).
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'App do DBV', {
    body: d.body || '',
    icon: '/marca/icon-192.png',
    badge: '/marca/icon-192.png',
    tag: d.tag || 'dbv',
    data: { url: d.url || '/membro' },
    lang: 'pt-BR',
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/membro', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if (c.url.startsWith(self.location.origin) && 'focus' in c) { c.navigate(url).catch(() => {}); return c.focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
