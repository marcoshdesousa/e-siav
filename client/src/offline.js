// Sem internet: só quem é DBV+ continua jogando os jogos (o app fica guardado no aparelho).
// Para quem não é DBV+, o app precisa de internet e nada fica guardado.
import { useEffect, useState } from 'react';

/** true quando o aparelho está com internet. */
export function useOnline() {
  const [on, setOn] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const up = () => setOn(true); const down = () => setOn(false);
    window.addEventListener('online', up); window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  return on;
}

const KEY = 'dbv-offline-conta';
const hasPlus = (a) => a?.type === 'member' && !!a.plus && new Date(a.plus.until) > new Date();

/** A conta de DBV+ guardada neste aparelho (para abrir os jogos sem internet). */
export function savedActor() {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) || 'null');
    return hasPlus(a) ? { ...a, offline: true } : null;
  } catch { return null; }
}

/**
 * Depois de entrar (ou conferir a conta): DBV+ guarda o app no aparelho para jogar sem internet;
 * sem DBV+ (ou ao sair), tira o que estava guardado.
 */
export function syncOffline(actor) {
  if (!('serviceWorker' in navigator)) return;
  if (hasPlus(actor)) {
    try { localStorage.setItem(KEY, JSON.stringify(actor)); } catch { /* sem armazenamento */ }
    if (import.meta.env.PROD) navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {});
    return;
  }
  try { localStorage.removeItem(KEY); } catch { /* sem armazenamento */ }
  navigator.serviceWorker.getRegistrations().then((list) => list.forEach((r) => r.unregister())).catch(() => {});
  if (window.caches) window.caches.keys().then((keys) => keys.forEach((k) => window.caches.delete(k))).catch(() => {});
}
