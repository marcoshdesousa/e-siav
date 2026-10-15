// As 20 fases do Stumble DBV. Cada fase é uma sequência de trechos montados com peças simples
// (plataformas, barras giratórias, pêndulos, pistões, plataformas móveis, esteiras, portas, cama
// elástica, pisos que caem...). Tudo se move em função do tempo da corrida, igual em todos os celulares.
import * as THREE from 'three';

export const W = 10; // largura da pista

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const THEMES = [
  { sky: '#7dd3fc', floor: '#fbbf24', alt: '#f97316', acc: '#ec4899', obs: '#7c3aed', water: '#0ea5e9' },
  { sky: '#a5f3fc', floor: '#34d399', alt: '#10b981', acc: '#f43f5e', obs: '#2563eb', water: '#0284c7' },
  { sky: '#fde68a', floor: '#60a5fa', alt: '#3b82f6', acc: '#facc15', obs: '#ef4444', water: '#0369a1' },
  { sky: '#c4b5fd', floor: '#f472b6', alt: '#ec4899', acc: '#22d3ee', obs: '#f59e0b', water: '#6d28d9' },
  { sky: '#bbf7d0', floor: '#fb923c', alt: '#f97316', acc: '#3b82f6', obs: '#16a34a', water: '#0891b2' },
];

const box = new THREE.BoxGeometry(1, 1, 1);
const cyl = new THREE.CylinderGeometry(1, 1, 1, 20);
const sph = new THREE.SphereGeometry(1, 16, 12);
const matCache = new Map();
const mat = (c) => {
  if (!matCache.has(c)) matCache.set(c, new THREE.MeshLambertMaterial({ color: c }));
  return matCache.get(c);
};

/** Contexto de construção: guarda as peças com colisão de cada fase. */
function makeCtx(scene, theme, r) {
  const group = new THREE.Group();
  scene.add(group);
  const ctx = { group, theme, r, plats: [], walls: [], hitters: [], checkpoints: [0], updaters: [], finishZ: -9999, z: 0 };

  /** Plataforma (chão). top = altura do chão. move(t) -> {x, y, z} de deslocamento. */
  ctx.plat = (x, z, w, d, top, color, o = {}) => {
    const m = new THREE.Mesh(box, mat(color));
    const thick = o.thick ?? 1;
    m.scale.set(w, thick, d);
    m.position.set(x, top - thick / 2, z);
    m.receiveShadow = true;
    m.castShadow = !!o.cast;
    group.add(m);
    const p = { x, z, w, d, top, kind: o.kind || 'normal', conv: o.conv || 0, move: o.move, mesh: m, ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: 0, slope: o.slope, gone: false, baseY: top - thick / 2 };
    if (o.slope) { // rampa: o chão sobe de y0 (z0) até y1 (z1)
      const len = Math.abs(o.slope.z1 - o.slope.z0);
      const ang = Math.atan2(o.slope.y1 - o.slope.y0, len);
      m.scale.set(w, 0.6, Math.hypot(len, o.slope.y1 - o.slope.y0));
      m.position.set(x, (o.slope.y0 + o.slope.y1) / 2 - 0.3, (o.slope.z0 + o.slope.z1) / 2);
      m.rotation.x = ang;
    }
    ctx.plats.push(p);
    return p;
  };
  /** Parede (bloqueia). knock: empurra com força. */
  ctx.wall = (x, z, w, d, h, y0, color, o = {}) => {
    const m = new THREE.Mesh(box, mat(color));
    m.scale.set(w, h, d);
    m.position.set(x, y0 + h / 2, z);
    m.castShadow = true;
    group.add(m);
    const wl = { x, z, w, d, h, y0, move: o.move, knock: o.knock || 0, mesh: m, ox: 0, oz: 0, fake: !!o.fake, gone: false };
    ctx.walls.push(wl);
    return wl;
  };
  ctx.deco = (mesh) => { group.add(mesh); return mesh; };
  return ctx;
}

// ───────────── Trechos ─────────────

function railings(ctx, z0, len, top = 0) {
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(box, mat(ctx.theme.alt));
    m.scale.set(0.3, 0.5, len);
    m.position.set(s * (W / 2 + 0.15), top + 0.25, z0 - len / 2);
    ctx.group.add(m);
  }
}

const SEG = {
  start(ctx) {
    const len = 14;
    ctx.plat(0, ctx.z - len / 2, W + 4, len, 0, ctx.theme.floor);
    // Portão de largada
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(box, mat(ctx.theme.acc));
      post.position.set(s * (W / 2 + 1.6), 2.5, ctx.z - len + 1);
      post.scale.set(0.6, 5, 0.6);
      ctx.deco(post);
    }
    const top = new THREE.Mesh(box, mat(ctx.theme.acc));
    top.scale.set(W + 4, 0.8, 0.6);
    top.position.set(0, 5, ctx.z - len + 1);
    ctx.deco(top);
    return len;
  },
  floor(ctx, { len = 14 } = {}) {
    ctx.plat(0, ctx.z - len / 2, W, len, 0, ctx.theme.floor);
    railings(ctx, ctx.z, len);
    return len;
  },
  spinner(ctx, { low = false, n = 1 } = {}) {
    const len = 14 * n;
    ctx.plat(0, ctx.z - len / 2, W, len, 0, ctx.theme.floor);
    for (let k = 0; k < n; k++) {
      const cz = ctx.z - 7 - k * 14;
      const y = low ? 0.45 : 1.25;
      const w = (k % 2 ? -1 : 1) * (low ? 1.5 : 1.1);
      const post = new THREE.Mesh(cyl, mat('#334155'));
      post.scale.set(0.4, y + 0.4, 0.4);
      post.position.set(0, (y + 0.4) / 2, cz);
      ctx.deco(post);
      const bar = new THREE.Mesh(box, mat(ctx.theme.obs));
      bar.scale.set(W - 0.6, 0.35, 0.35);
      bar.position.set(0, y, cz);
      bar.castShadow = true;
      ctx.deco(bar);
      const h = { type: 'bar', cx: 0, cz, y, L: (W - 0.6) / 2, w, ang: 0 };
      ctx.hitters.push(h);
      ctx.updaters.push((t) => { h.ang = t * w; bar.rotation.y = h.ang; });
    }
    ctx.checkpoints.push(ctx.z);
    return len;
  },
  pendulums(ctx, { n = 3 } = {}) {
    const len = 8 + n * 7;
    ctx.plat(0, ctx.z - len / 2, 5, len, 0, ctx.theme.floor);
    for (let k = 0; k < n; k++) {
      const pz = ctx.z - 6 - k * 7;
      const frame = new THREE.Mesh(box, mat('#475569'));
      frame.scale.set(9, 0.4, 0.4);
      frame.position.set(0, 7.2, pz);
      ctx.deco(frame);
      const rod = new THREE.Mesh(box, mat('#94a3b8'));
      rod.scale.set(0.15, 5.4, 0.15);
      const ball = new THREE.Mesh(sph, mat(ctx.theme.obs));
      ball.scale.setScalar(1.1);
      ball.castShadow = true;
      const pivot = new THREE.Group();
      pivot.position.set(0, 7.2, pz);
      rod.position.y = -2.7;
      ball.position.y = -5.8;
      pivot.add(rod, ball);
      ctx.deco(pivot);
      const ph = k * 1.3;
      const h = { type: 'ball', x: 0, y: 1.4, z: pz, r: 1.1, vx: 0 };
      ctx.hitters.push(h);
      ctx.updaters.push((t) => {
        const a = Math.sin(t * 1.6 + ph) * 1.0;
        pivot.rotation.z = a;
        h.x = Math.sin(a) * 5.8;
        h.y = 7.2 - Math.cos(a) * 5.8;
        h.vx = Math.cos(t * 1.6 + ph) * 1.6 * 5.8;
      });
    }
    ctx.checkpoints.push(ctx.z);
    return len;
  },
  pushers(ctx, { n = 4 } = {}) {
    const len = 6 + n * 5;
    ctx.plat(0, ctx.z - len / 2, W, len, 0, ctx.theme.floor);
    railings(ctx, ctx.z, len);
    for (let k = 0; k < n; k++) {
      const z = ctx.z - 5 - k * 5;
      const s = k % 2 ? 1 : -1;
      const ph = k * 0.9;
      const wl = ctx.wall(s * (W / 2 + 2), z, 4, 1.4, 1.6, 0, ctx.theme.obs, { knock: 9 });
      wl.baseX = wl.x;
      ctx.updaters.push((t) => {
        const e = (Math.sin(t * 1.8 + ph) + 1) / 2; // 0..1
        wl.ox = -s * e * 5.2;
        wl.vx = -s * Math.cos(t * 1.8 + ph) * 1.8 * 2.6;
        wl.mesh.position.x = wl.x + wl.ox;
      });
    }
    ctx.checkpoints.push(ctx.z);
    return len;
  },
  moving(ctx, { rows = 3 } = {}) {
    const len = 4 + rows * 6;
    for (let k = 0; k < rows; k++) {
      const z = ctx.z - 4 - k * 6;
      const ph = k * 1.7;
      const amp = 3;
      const p = ctx.plat(0, z, 3.4, 3.4, 0, k % 2 ? ctx.theme.alt : ctx.theme.acc, { cast: true, move: (t) => ({ x: Math.sin(t * 1.1 + ph) * amp, y: 0, z: 0 }) });
      p.amp = amp;
    }
    ctx.checkpoints.push(ctx.z);
    return len;
  },
  bumpers(ctx) {
    const len = 18;
    ctx.plat(0, ctx.z - len / 2, W, len, 0, ctx.theme.floor);
    railings(ctx, ctx.z, len);
    const spots = [[-2.8, 4], [2.8, 4], [0, 8], [-3.4, 12], [3.4, 12], [0, 15]];
    for (const [x, dz] of spots) {
      const z = ctx.z - dz;
      const m = new THREE.Mesh(cyl, mat(ctx.theme.acc));
      m.scale.set(0.9, 1.2, 0.9);
      m.position.set(x, 0.6, z);
      m.castShadow = true;
      ctx.deco(m);
      const top = new THREE.Mesh(sph, mat('#ffffff'));
      top.scale.set(0.9, 0.3, 0.9);
      top.position.set(x, 1.2, z);
      ctx.deco(top);
      const h = { type: 'bumper', x, z, r: 0.9 };
      ctx.hitters.push(h);
      ctx.updaters.push((t) => { const s = 1 + Math.max(0, Math.sin(t * 6 + x)) * 0.06; m.scale.set(0.9 * s, 1.2, 0.9 * s); });
    }
    return len;
  },
  conveyor(ctx, { len = 18, speed = 3.2 } = {}) {
    const p = ctx.plat(0, ctx.z - len / 2, W, len, 0, '#475569', { kind: 'conveyor', conv: speed });
    railings(ctx, ctx.z, len);
    // Faixas que andam (mostram o sentido da esteira)
    const stripes = [];
    for (let k = 0; k < Math.floor(len / 2); k++) {
      const s = new THREE.Mesh(box, mat(ctx.theme.acc));
      s.scale.set(W - 0.4, 0.04, 0.4);
      ctx.deco(s);
      stripes.push(s);
    }
    const z0 = ctx.z;
    ctx.updaters.push((t) => stripes.forEach((s, k) => { s.position.set(0, 0.02, z0 - (((k * 2 - t * speed) % len) + len) % len); }));
    p.speed = speed;
    return len;
  },
  ramp(ctx, { up = 3 } = {}) {
    const len = 12;
    ctx.plat(0, ctx.z - len / 2, W, len, 0, ctx.theme.alt, { slope: { z0: ctx.z, z1: ctx.z - len, y0: 0, y1: up } });
    ctx.plat(0, ctx.z - len - 4, W, 8, up, ctx.theme.floor);
    ctx.plat(0, ctx.z - len - 8 - len / 2, W, len, 0, ctx.theme.alt, { slope: { z0: ctx.z - len - 8, z1: ctx.z - 2 * len - 8, y0: up, y1: 0 } });
    return 2 * len + 8;
  },
  doors(ctx) {
    const len = 10;
    ctx.plat(0, ctx.z - len / 2, W, len, 0, ctx.theme.floor);
    const n = 5;
    const dw = W / n;
    const z = ctx.z - 5;
    const solid = new Set();
    while (solid.size < 3) solid.add(Math.floor(ctx.r() * n));
    for (let k = 0; k < n; k++) {
      const x = -W / 2 + dw * (k + 0.5);
      ctx.wall(x, z, dw - 0.25, 0.6, 2.6, 0, k % 2 ? ctx.theme.acc : ctx.theme.obs, { fake: !solid.has(k) });
    }
    ctx.wall(0, z, W + 0.4, 0.7, 1.2, 2.6, '#334155');
    ctx.checkpoints.push(ctx.z);
    return len;
  },
  bounce(ctx, { n = 2 } = {}) {
    const len = 6 + n * 8;
    for (let k = 0; k < n; k++) {
      const z = ctx.z - 3 - k * 8;
      const p = ctx.plat(0, z, 4.5, 3, 0.3, '#22c55e', { kind: 'bounce', thick: 0.5 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.2, 8, 24), mat('#facc15'));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 0.35, z);
      ctx.deco(ring);
      p.ring = ring;
    }
    ctx.plat(0, ctx.z - len + 1.5, W, 3, 0, ctx.theme.floor);
    ctx.checkpoints.push(ctx.z);
    return len;
  },
  narrow(ctx) {
    const len = 18;
    const xs = [0, -2.5, 2, -1, 2.5, 0];
    for (let k = 0; k < xs.length; k++) ctx.plat(xs[k], ctx.z - 1.5 - k * 3, 2.2, 3.2, 0, k % 2 ? ctx.theme.alt : ctx.theme.floor);
    ctx.checkpoints.push(ctx.z);
    return len;
  },
  tiles(ctx, { rows = 5 } = {}) {
    const cols = 4;
    const tw = W / cols;
    const len = rows * 3.2 + 1;
    for (let r = 0; r < rows; r++) {
      const real = new Set();
      while (real.size < 2) real.add(Math.floor(ctx.r() * cols));
      for (let c = 0; c < cols; c++) {
        const p = ctx.plat(-W / 2 + tw * (c + 0.5), ctx.z - 1.6 - r * 3.2, tw - 0.2, 3, 0, (r + c) % 2 ? ctx.theme.acc : ctx.theme.alt, { thick: 0.4, kind: real.has(c) ? 'normal' : 'fake' });
        p.tile = true;
      }
    }
    ctx.checkpoints.push(ctx.z);
    return len;
  },
  stairs(ctx) {
    const steps = 6;
    const len = steps * 2 + 6 + steps * 2;
    for (let k = 0; k < steps; k++) ctx.plat(0, ctx.z - 1 - k * 2, W, 2, 0.5 * (k + 1), k % 2 ? ctx.theme.alt : ctx.theme.floor, { thick: 0.5 * (k + 1) + 0.5 });
    ctx.plat(0, ctx.z - steps * 2 - 3, W, 6, 0.5 * steps, ctx.theme.floor, { thick: 0.5 * steps + 0.5 });
    for (let k = 0; k < steps; k++) ctx.plat(0, ctx.z - steps * 2 - 7 - k * 2, W, 2, 0.5 * (steps - k - 1) + 0.01, k % 2 ? ctx.theme.floor : ctx.theme.alt, { thick: 0.5 * (steps - k) });
    return len;
  },
  sweeper(ctx) {
    // Barra baixa e comprida girando no meio: pule na hora certa.
    const len = 18;
    ctx.plat(0, ctx.z - len / 2, W + 2, len, 0, ctx.theme.floor);
    const cz = ctx.z - len / 2;
    const bar = new THREE.Mesh(box, mat(ctx.theme.obs));
    bar.scale.set(W + 6, 0.5, 0.5);
    bar.position.set(0, 0.45, cz);
    bar.castShadow = true;
    ctx.deco(bar);
    const hub = new THREE.Mesh(cyl, mat('#334155'));
    hub.scale.set(0.8, 1.2, 0.8);
    hub.position.set(0, 0.6, cz);
    ctx.deco(hub);
    const h = { type: 'bar', cx: 0, cz, y: 0.45, L: (W + 6) / 2, w: 1.6, ang: 0 };
    ctx.hitters.push(h);
    ctx.updaters.push((t) => { h.ang = t * 1.6; bar.rotation.y = h.ang; });
    ctx.checkpoints.push(ctx.z);
    return len;
  },
  hammers(ctx) {
    // Martelos batendo de lado (pêndulos ao longo da pista)
    const len = 20;
    ctx.plat(0, ctx.z - len / 2, W, len, 0, ctx.theme.floor);
    railings(ctx, ctx.z, len);
    for (let k = 0; k < 3; k++) {
      const z = ctx.z - 4 - k * 6;
      const s = k % 2 ? 1 : -1;
      const pivot = new THREE.Group();
      pivot.position.set(s * (W / 2 + 0.5), 4.5, z);
      const arm = new THREE.Mesh(box, mat('#64748b'));
      arm.scale.set(0.3, 0.3, 0.3);
      const head = new THREE.Mesh(cyl, mat(ctx.theme.obs));
      head.scale.set(1, 2.2, 1);
      head.rotation.x = Math.PI / 2;
      const handle = new THREE.Mesh(box, mat('#a16207'));
      handle.scale.set(0.25, 3.8, 0.25);
      handle.position.y = -1.9;
      head.position.y = -3.8;
      pivot.add(arm, handle, head);
      ctx.deco(pivot);
      const ph = k * 1.1;
      const h = { type: 'ball', x: 0, y: 0.8, z, r: 1.2, vx: 0 };
      ctx.hitters.push(h);
      ctx.updaters.push((t) => {
        const a = s * (0.25 + (Math.sin(t * 2.2 + ph) + 1) * 0.65);
        pivot.rotation.z = a;
        h.x = pivot.position.x + Math.sin(a) * 3.8;
        h.y = 4.5 - Math.cos(a) * 3.8;
        h.vx = -s * 9;
      });
    }
    ctx.checkpoints.push(ctx.z);
    return len;
  },
  finish(ctx) {
    const len = 12;
    ctx.plat(0, ctx.z - len / 2, W + 4, len, 0, '#f8fafc');
    // Faixa quadriculada e arco de chegada
    const tex = (() => {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 16;
      const g = c.getContext('2d');
      for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * 4, y * 4, 4, 4); }
      const t = new THREE.CanvasTexture(c);
      t.magFilter = THREE.NearestFilter;
      return t;
    })();
    const line = new THREE.Mesh(new THREE.PlaneGeometry(W + 4, 1.5), new THREE.MeshBasicMaterial({ map: tex }));
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.02, ctx.z - 2);
    ctx.deco(line);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(W / 2 + 1, 0.45, 10, 30, Math.PI), mat(ctx.theme.acc));
    arch.position.set(0, 0, ctx.z - 2);
    ctx.deco(arch);
    ctx.finishZ = ctx.z - 2;
    return len;
  },
};

// ───────────── As 20 fases ─────────────

export const STAGES = [
  { name: 'Trilha da Largada', segs: [['floor'], ['spinner'], ['doors'], ['floor', { len: 8 }], ['conveyor'], ['finish']] },
  { name: 'Ponte dos Pêndulos', segs: [['floor'], ['pendulums'], ['floor', { len: 6 }], ['pendulums', { n: 4 }], ['finish']] },
  { name: 'Fábrica de Pistões', segs: [['floor', { len: 8 }], ['pushers'], ['conveyor', { len: 14 }], ['pushers', { n: 5 }], ['finish']] },
  { name: 'Lago das Plataformas', segs: [['floor', { len: 8 }], ['moving'], ['floor', { len: 6 }], ['moving', { rows: 4 }], ['finish']] },
  { name: 'Pula-Pula', segs: [['floor', { len: 8 }], ['bounce'], ['spinner', { low: true }], ['bounce', { n: 3 }], ['finish']] },
  { name: 'Portas da Sorte', segs: [['floor', { len: 8 }], ['doors'], ['floor', { len: 6 }], ['doors'], ['floor', { len: 6 }], ['doors'], ['finish']] },
  { name: 'Pisos Traiçoeiros', segs: [['floor', { len: 8 }], ['tiles'], ['floor', { len: 6 }], ['tiles', { rows: 6 }], ['finish']] },
  { name: 'Montanha Russa', segs: [['floor', { len: 8 }], ['ramp'], ['spinner'], ['ramp', { up: 4 }], ['finish']] },
  { name: 'Corredor dos Martelos', segs: [['floor', { len: 8 }], ['hammers'], ['floor', { len: 6 }], ['hammers'], ['finish']] },
  { name: 'Hélice Gigante', segs: [['floor', { len: 8 }], ['sweeper'], ['floor', { len: 6 }], ['spinner', { n: 2 }], ['sweeper'], ['finish']] },
  { name: 'Parque dos Bumpers', segs: [['floor', { len: 8 }], ['bumpers'], ['conveyor', { len: 12 }], ['bumpers'], ['finish']] },
  { name: 'Equilibrista', segs: [['floor', { len: 8 }], ['narrow'], ['floor', { len: 6 }], ['narrow'], ['pendulums', { n: 2 }], ['finish']] },
  { name: 'Escadaria', segs: [['floor', { len: 8 }], ['stairs'], ['spinner'], ['stairs'], ['finish']] },
  { name: 'Esteira Maluca', segs: [['floor', { len: 8 }], ['conveyor', { len: 22, speed: 4 }], ['pushers'], ['conveyor', { len: 16, speed: 4.5 }], ['finish']] },
  { name: 'Ilhas Flutuantes', segs: [['floor', { len: 8 }], ['moving', { rows: 2 }], ['narrow'], ['moving', { rows: 3 }], ['finish']] },
  { name: 'Mistura Total', segs: [['floor', { len: 8 }], ['spinner'], ['tiles', { rows: 4 }], ['hammers'], ['doors'], ['finish']] },
  { name: 'Salto no Vazio', segs: [['floor', { len: 8 }], ['bounce', { n: 3 }], ['narrow'], ['bounce'], ['finish']] },
  { name: 'Rodamoinho', segs: [['floor', { len: 8 }], ['sweeper'], ['bumpers'], ['sweeper'], ['finish']] },
  { name: 'Desafio do Acampamento', segs: [['floor', { len: 8 }], ['pushers'], ['pendulums'], ['tiles', { rows: 4 }], ['ramp'], ['finish']] },
  { name: 'Grande Final DBV', segs: [['floor', { len: 8 }], ['spinner', { n: 2 }], ['moving', { rows: 3 }], ['hammers'], ['doors'], ['sweeper'], ['finish']] },
];

/** Monta a fase na cena e devolve as peças com colisão. */
export function buildStage(scene, index, seed) {
  const st = STAGES[index % STAGES.length];
  const theme = THEMES[index % THEMES.length];
  const ctx = makeCtx(scene, theme, rng(seed));
  ctx.z = 0;
  ctx.z -= SEG.start(ctx);
  for (const [type, opts] of st.segs) {
    const len = SEG[type](ctx, opts);
    ctx.z -= len;
  }
  ctx.length = -ctx.z;
  // Água lá embaixo (quem cai volta no último ponto seguro)
  const water = new THREE.Mesh(new THREE.PlaneGeometry(400, 600), new THREE.MeshLambertMaterial({ color: theme.water }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -12, -ctx.length / 2);
  ctx.group.add(water);
  scene.background = new THREE.Color(theme.sky);
  scene.fog = new THREE.Fog(theme.sky, 70, 190);
  return { ...ctx, name: st.name, theme };
}
