// Lembretes no celular (Web Push): pedir permissão, cadastrar o aparelho do membro e tirar ao sair.
import { api } from './api.js';

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
/** Os lembretes são só para quem baixou o app (aberto pela tela de início, não pelo navegador). */
export const installedApp = () => typeof window !== 'undefined' && (!!window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true);

const b64 = (s) => {
  const raw = window.atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

async function registration() {
  const reg = await navigator.serviceWorker.getRegistration();
  if (reg) return reg;
  await navigator.serviceWorker.register('/sw-lite.js', { updateViaCache: 'none' });
  return navigator.serviceWorker.ready;
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Pede a permissão (precisa ser num toque) e cadastra o aparelho. true = lembretes ligados. */
export async function enablePush() {
  if (!pushSupported() || !installedApp()) return false;
  if ((await Notification.requestPermission()) !== 'granted') return false;
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { key } = await api.get('/push/chave');
    try {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
    } catch {
      throw new Error('Este aparelho não conseguiu ligar os lembretes. Tente pelo app instalado na tela de início.');
    }
  }
  await api.post('/me/push', { subscription: sub.toJSON() });
  return true;
}

/** Ao abrir o app: com a permissão já dada, garante o aparelho cadastrado (pode ter trocado). */
export async function syncPush() {
  if (!pushSupported() || !installedApp() || Notification.permission !== 'granted') return;
  try { await enablePush(); } catch { /* sem internet ou sem suporte */ }
}

/** Ao sair da conta: este aparelho para de receber os lembretes dela. */
export async function leavePush() {
  try {
    const sub = await currentSubscription();
    if (!sub) return;
    await api.post('/me/push/sair', { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe();
  } catch { /* nada a fazer */ }
}
