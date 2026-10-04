import { useEffect, useState } from 'react';

// Instalação do app (PWA). No Android/Chrome e no computador o navegador oferece
// o evento "beforeinstallprompt"; no iPhone a instalação é pelo menu Compartilhar.
let deferred = null;
const subs = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    subs.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    subs.forEach((fn) => fn());
  });
}

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

export function platform() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    subs.add(fn);
    return () => subs.delete(fn);
  }, []);
  return {
    canPrompt: !!deferred,
    installed: isStandalone(),
    /** Abre o instalador do navegador. Retorna false se não houver (mostrar instruções). */
    prompt: async () => {
      if (!deferred) return false;
      deferred.prompt();
      await deferred.userChoice.catch(() => null);
      deferred = null;
      subs.forEach((f) => f());
      return true;
    },
  };
}
