// Peças comuns dos mini jogos: laço de animação, teclado, toque (deslizar) e canvas nítido.
import { useEffect, useRef } from 'react';

export const rand = (n) => Math.floor(Math.random() * n);
export const pick = (arr) => arr[rand(arr.length)];
export const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Cores fixas dos jogos (servem no tema claro e no escuro, pois o jogo tem fundo próprio). */
export const COLORS = {
  navy: '#0E2A6B', blue: '#2B54B0', sky: '#7FB2FF', red: '#E92A2F', yellow: '#F9C71D',
  green: '#18875A', lime: '#5BD38A', white: '#FFFFFF', ink: '#101831', gray: '#8A94AA', bg: '#0B1430',
};

/** setInterval que acompanha o fn mais recente. ms = null pausa. */
export function useInterval(fn, ms) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (ms == null) return undefined;
    const t = setInterval(() => ref.current(), ms);
    return () => clearInterval(t);
  }, [ms]);
}

/** requestAnimationFrame: fn(dt em segundos, limitado a 0,05). active = false pausa. */
export function useRaf(fn, active = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!active) return undefined;
    let id; let last = window.performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ref.current(dt);
      id = window.requestAnimationFrame(loop);
    };
    id = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(id);
  }, [active]);
}

const KEYS = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right', Space: 'action', Enter: 'action',
};

/**
 * Teclado: onKey(nome, ativo) com nome em up/down/left/right/action; ativo = true ao apertar e
 * false ao soltar. Evita a página rolar com setas e espaço.
 */
export function useKeys(onKey) {
  const ref = useRef(onKey);
  ref.current = onKey;
  useEffect(() => {
    const handle = (down) => (e) => {
      const k = KEYS[e.code];
      if (!k) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      e.preventDefault();
      if (down && e.repeat && k === 'action') return;
      ref.current(k, down, e);
    };
    const d = handle(true); const u = handle(false);
    window.addEventListener('keydown', d);
    window.addEventListener('keyup', u);
    return () => { window.removeEventListener('keydown', d); window.removeEventListener('keyup', u); };
  }, []);
}

/** Deslizar o dedo sobre o elemento: onDir('up'|'down'|'left'|'right'). Um toque curto chama onTap. */
export function useSwipe(ref, onDir, onTap) {
  const cb = useRef({ onDir, onTap });
  cb.current = { onDir, onTap };
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let sx = 0; let sy = 0;
    const start = (e) => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; };
    const end = (e) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - sx; const dy = t.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) { cb.current.onTap?.(); return; }
      cb.current.onDir?.(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchend', end, { passive: true });
    return () => { el.removeEventListener('touchstart', start); el.removeEventListener('touchend', end); };
  }, [ref]);
}

/**
 * Canvas nítido em qualquer tela: desenhe em coordenadas lógicas (w x h); ele ocupa 100% da
 * largura do jogo mantendo a proporção. Retorna [ref, getCtx].
 */
export function useCanvas(w, h) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = w * dpr; c.height = h * dpr;
    c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  }, [w, h]);
  return [ref, () => ref.current?.getContext('2d')];
}

/** Posição do toque/clique em coordenadas lógicas do canvas. */
export function pointerPos(e, canvas, w, h) {
  const r = canvas.getBoundingClientRect();
  const p = e.touches?.[0] || e.changedTouches?.[0] || e;
  return { x: ((p.clientX - r.left) / r.width) * w, y: ((p.clientY - r.top) / r.height) * h };
}
