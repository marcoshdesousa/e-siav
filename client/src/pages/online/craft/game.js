// DesbravaCraft: o jogo em si (primeira pessoa, quebrar/colocar, inventário, animais, aranhas,
// dia e noite, vida e fome). O mundo pode ser offline (salvo no celular) ou online (salvo no servidor).
import * as THREE from 'three';
import { B, BLOCKS, FUEL, ITEMS, SMELT, isSolid, maxStack, uvOf } from './blocks.js';
import { CH, CS, World, buildChunkMesh, craftMaterials } from './world.js';

const EYE = 1.62;
const PW = 0.3; // meia largura do jogador
const PH = 1.8;
const REACH = 5;
const DAY = 600; // segundos por dia completo
const SLOTS = 36;

// ───────────── Bichos (blocos simples) ─────────────
function boxMesh(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  m.castShadow = false;
  return m;
}
const MOBS = {
  vaca: { name: 'Vaca', hp: 10, speed: 1.2, w: 0.9, h: 1.3, drops: [[130, 1, 3]], passive: true },
  ovelha: { name: 'Ovelha', hp: 8, speed: 1.2, w: 0.9, h: 1.3, drops: [[134, 1, 2], [B.WOOL, 1, 1]], passive: true },
  galinha: { name: 'Galinha', hp: 4, speed: 1.4, w: 0.4, h: 0.7, drops: [[132, 1, 1], [137, 0, 2]], passive: true },
  aranha: { name: 'Aranha', hp: 16, speed: 3.2, w: 1.4, h: 0.9, drops: [[138, 0, 2]], hostile: true, dmg: 2 },
};
function makeMob(type) {
  const g = new THREE.Group();
  if (type === 'vaca' || type === 'ovelha') {
    const body = boxMesh(0.9, 0.8, 1.4, type === 'vaca' ? '#4b3621' : '#f1f1f1');
    body.position.y = 0.95;
    const head = boxMesh(0.55, 0.55, 0.5, type === 'vaca' ? '#3b2a1a' : '#e8d9c5');
    head.position.set(0, 1.25, -0.9);
    g.add(body, head);
    if (type === 'vaca') { const spot = boxMesh(0.92, 0.4, 0.5, '#f5f5f5'); spot.position.set(0, 1.0, 0.2); g.add(spot); const horn = boxMesh(0.7, 0.1, 0.1, '#e5e5e5'); horn.position.set(0, 1.55, -0.9); g.add(horn); }
    for (const [x, z] of [[-0.3, -0.5], [0.3, -0.5], [-0.3, 0.5], [0.3, 0.5]]) { const l = boxMesh(0.25, 0.6, 0.25, type === 'vaca' ? '#3b2a1a' : '#e8d9c5'); l.position.set(x, 0.3, z); g.add(l); g.userData.legs = [...(g.userData.legs || []), l]; }
    for (const s of [-1, 1]) { const e = boxMesh(0.08, 0.08, 0.02, '#111'); e.position.set(0.15 * s, 1.32, -1.16); g.add(e); }
  } else if (type === 'galinha') {
    const body = boxMesh(0.4, 0.4, 0.55, '#fafafa'); body.position.y = 0.45;
    const head = boxMesh(0.3, 0.35, 0.25, '#fafafa'); head.position.set(0, 0.75, -0.3);
    const beak = boxMesh(0.15, 0.1, 0.12, '#f59e0b'); beak.position.set(0, 0.72, -0.48);
    const comb = boxMesh(0.08, 0.12, 0.15, '#dc2626'); comb.position.set(0, 0.97, -0.3);
    g.add(body, head, beak, comb);
    for (const s of [-1, 1]) { const l = boxMesh(0.06, 0.25, 0.06, '#f59e0b'); l.position.set(0.1 * s, 0.12, 0); g.add(l); g.userData.legs = [...(g.userData.legs || []), l]; }
  } else if (type === 'aranha') {
    const body = boxMesh(0.9, 0.55, 1.1, '#2a2522'); body.position.y = 0.55;
    const head = boxMesh(0.65, 0.5, 0.55, '#3a332f'); head.position.set(0, 0.6, -0.75);
    g.add(body, head);
    for (const s of [-1, 1]) for (const k of [0, 1]) { const e = boxMesh(0.1, 0.08, 0.02, '#ef4444'); e.position.set(0.14 * s + (k ? 0.12 * s : 0), 0.68 + k * 0.1, -1.03); g.add(e); }
    for (let k = 0; k < 4; k++) for (const s of [-1, 1]) {
      const l = boxMesh(1.0, 0.1, 0.1, '#1c1917');
      l.position.set(0.85 * s, 0.55, -0.4 + k * 0.28);
      l.rotation.z = 0.35 * s;
      g.add(l);
      g.userData.legs = [...(g.userData.legs || []), l];
    }
  }
  return g;
}

/** Jogador online (boneco de blocos com o visual escolhido). */
function makeAvatar(o, name) {
  const g = new THREE.Group();
  const head = boxMesh(0.5, 0.5, 0.5, o.skin); head.position.y = 1.55;
  const hair = boxMesh(0.54, 0.16, 0.54, o.hairColor); hair.position.y = 1.78;
  const body = boxMesh(0.55, 0.7, 0.3, o.top); body.position.y = 0.95;
  g.add(head, hair, body);
  for (const s of [-1, 1]) {
    const arm = boxMesh(0.2, 0.65, 0.22, o.top); arm.position.set(0.38 * s, 0.97, 0); g.add(arm);
    const leg = boxMesh(0.24, 0.6, 0.26, o.bottomType === 'calca' || o.g === 'm' ? o.bottom : o.skin); leg.position.set(0.13 * s, 0.3, 0); g.add(leg);
  }
  if (o.g === 'f' && o.bottomType !== 'calca') { const skirt = boxMesh(0.62, 0.38, 0.38, o.bottom); skirt.position.y = 0.5; g.add(skirt); }
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(0, 8, 256, 48);
  x.font = 'bold 32px Arial'; x.textAlign = 'center'; x.fillStyle = '#fff'; x.fillText(name, 128, 44);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  sp.scale.set(1.6, 0.4, 1);
  sp.position.y = 2.3;
  g.add(sp);
  return g;
}

export function createCraft(canvas, { seed, save, online = false, onHud, onUse, onBlock, onPos, onSave, onToast, onSound }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 200);
  camera.rotation.order = 'YXZ';
  const hemi = new THREE.HemisphereLight('#ffffff', '#55606e', 1.5);
  const sun = new THREE.DirectionalLight('#fffbea', 1.2);
  sun.position.set(30, 60, 20);
  scene.add(hemi, sun);
  scene.fog = new THREE.Fog('#9ad5ff', 40, 78);
  scene.background = new THREE.Color('#9ad5ff');
  const daySky = new THREE.Color('#9ad5ff');
  const nightSky = new THREE.Color('#0b1026');
  const sky = new THREE.Color();

  let hudAt = 0;
  let hudDirty = true;
  const world = new World(seed);
  if (save?.changes) world.importChanges(save.changes);
  const meshes = new Map();
  const dirty = new Set();
  let radius = window.innerWidth > 900 ? 5 : 4;

  // ───────────── Jogador ─────────────
  const p = {
    x: 0.5, y: 40, z: 0.5, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: -0.2, ground: false, inWater: false, fallFrom: null,
    health: 20, hunger: 20, hungerT: 0, regenT: 0, hurtT: 0, sel: 0, inv: Array(SLOTS).fill(null), fuel: 0,
    spawn: null, mx: 0, mz: 0, jump: false, time: 0.3 * DAY,
  };
  if (save?.player) Object.assign(p, save.player, { mx: 0, mz: 0, jump: false });
  if (save?.time != null) p.time = save.time;
  if (!p.spawn) {
    // Começa num lugar seco perto da origem
    let sx = 0;
    let sz = 0;
    for (let k = 0; k < 60; k++) { const y = world.surfaceY(sx, sz); if (world.get(sx, y - 1, sz) !== B.WATER && y > 25) break; sx += 7; sz += 3; }
    p.spawn = { x: sx + 0.5, y: world.surfaceY(sx, sz) + 0.1, z: sz + 0.5 };
    if (!save?.player) { p.x = p.spawn.x; p.y = p.spawn.y; p.z = p.spawn.z; }
  }

  // ───────────── Inventário ─────────────
  const inv = {
    add(id, n = 1, dur) {
      let left = n;
      if (!ITEMS[id]?.tool) for (const s of p.inv) if (s && s.id === id && s.n < maxStack(id) && left) { const k = Math.min(left, maxStack(id) - s.n); s.n += k; left -= k; }
      for (let i = 0; i < SLOTS && left; i++) if (!p.inv[i]) { const k = Math.min(left, maxStack(id)); p.inv[i] = { id, n: k, ...(ITEMS[id]?.tool ? { dur: dur ?? ITEMS[id].uses } : {}) }; left -= k; }
      hud(true);
      return n - left;
    },
    count(ids) {
      const set = Array.isArray(ids) ? ids : [ids];
      return p.inv.reduce((t, s) => t + (s && set.includes(s.id) ? s.n : 0), 0);
    },
    remove(ids, n) {
      const set = Array.isArray(ids) ? ids : [ids];
      let left = n;
      for (let i = 0; i < SLOTS && left; i++) {
        const s = p.inv[i];
        if (!s || !set.includes(s.id)) continue;
        const k = Math.min(left, s.n);
        s.n -= k;
        left -= k;
        if (!s.n) p.inv[i] = null;
      }
      hud(true);
      return left === 0;
    },
  };
  if (!save?.player) {
    // Começo: algumas coisas para não começar do zero absoluto
    inv.add(B.TORCH, 4);
    inv.add(136, 3);
  }
  const held = () => p.inv[p.sel] || null;

  // ───────────── Pedaços do mundo ─────────────
  function ensureChunks() {
    const pcx = Math.floor(p.x / CS);
    const pcz = Math.floor(p.z / CS);
    const want = [];
    for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dz * dz > radius * radius + 1) continue;
      const k = `${pcx + dx},${pcz + dz}`;
      if (!meshes.has(k)) want.push([dx * dx + dz * dz, pcx + dx, pcz + dz]);
    }
    want.sort((a, b) => a[0] - b[0]);
    // Monta poucos por quadro (não trava)
    for (const [, cx, cz] of want.slice(0, 2)) {
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) world.chunk(cx + a, cz + b);
      const m = buildChunkMesh(world, cx, cz);
      scene.add(m);
      meshes.set(`${cx},${cz}`, m);
    }
    for (const k of [...dirty].slice(0, 3)) {
      dirty.delete(k);
      const old = meshes.get(k);
      if (!old) continue;
      const [cx, cz] = k.split(',').map(Number);
      const m = buildChunkMesh(world, cx, cz);
      scene.remove(old);
      old.children.forEach((c) => c.geometry.dispose());
      scene.add(m);
      meshes.set(k, m);
    }
    for (const [k, m] of meshes) {
      const [cx, cz] = k.split(',').map(Number);
      if ((cx - pcx) ** 2 + (cz - pcz) ** 2 > (radius + 2) ** 2) { scene.remove(m); m.children.forEach((c) => c.geometry.dispose()); meshes.delete(k); }
    }
    return want.length;
  }
  world.onChange = (x, y, z, id, remote) => {
    const cx = Math.floor(x / CS);
    const cz = Math.floor(z / CS);
    dirty.add(`${cx},${cz}`);
    const lx = x - cx * CS;
    const lz = z - cz * CS;
    if (lx === 0) dirty.add(`${cx - 1},${cz}`);
    if (lx === CS - 1) dirty.add(`${cx + 1},${cz}`);
    if (lz === 0) dirty.add(`${cx},${cz - 1}`);
    if (lz === CS - 1) dirty.add(`${cx},${cz + 1}`);
    if (!remote) onBlock?.(x, y, z, id);
  };

  // ───────────── Física ─────────────
  const solidAt = (x, y, z) => isSolid(world.get(Math.floor(x), Math.floor(y), Math.floor(z)));
  function collides(x, y, z) {
    for (let bx = Math.floor(x - PW); bx <= Math.floor(x + PW); bx++) for (let by = Math.floor(y); by <= Math.floor(y + PH - 0.01); by++) for (let bz = Math.floor(z - PW); bz <= Math.floor(z + PW); bz++) {
      if (isSolid(world.get(bx, by, bz))) return true;
    }
    return false;
  }
  function moveAxis(axis, d) {
    if (!d) return false;
    const step = Math.sign(d) * Math.min(Math.abs(d), 0.4);
    let left = d;
    while (Math.abs(left) > 1e-6) {
      const s = Math.abs(left) < Math.abs(step) ? left : step;
      const nx = axis === 'x' ? p.x + s : p.x;
      const ny = axis === 'y' ? p.y + s : p.y;
      const nz = axis === 'z' ? p.z + s : p.z;
      if (collides(nx, ny, nz)) return true;
      p.x = nx; p.y = ny; p.z = nz;
      left -= s;
    }
    return false;
  }
  function physics(dt) {
    const feet = world.get(Math.floor(p.x), Math.floor(p.y + 0.2), Math.floor(p.z));
    p.inWater = feet === B.WATER || world.get(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z)) === B.WATER;
    const speed = p.inWater ? 2.2 : 4.3;
    const fx = -Math.sin(p.yaw);
    const fz = -Math.cos(p.yaw);
    const rx = Math.cos(p.yaw);
    const rz = -Math.sin(p.yaw);
    const tx = (fx * -p.mz + rx * p.mx) * speed;
    const tz = (fz * -p.mz + rz * p.mx) * speed;
    const acc = p.ground ? 12 : 3;
    p.vx += (tx - p.vx) * Math.min(1, dt * acc);
    p.vz += (tz - p.vz) * Math.min(1, dt * acc);
    if (p.inWater) {
      p.vy = Math.max(p.vy - 10 * dt, -3);
      if (p.jump) p.vy = 3.2;
    } else {
      p.vy -= 28 * dt;
      if (p.jump && p.ground) { p.vy = 8.6; p.ground = false; }
    }
    p.vy = Math.max(p.vy, -40);
    if (moveAxis('x', p.vx * dt)) p.vx = 0;
    if (moveAxis('z', p.vz * dt)) p.vz = 0;
    const wasGround = p.ground;
    p.ground = false;
    if (moveAxis('y', p.vy * dt)) {
      if (p.vy < 0) p.ground = true;
      p.vy = 0;
    }
    // Pular sozinho um degrau quando encosta andando (fica mais fácil no celular)
    if (p.ground && (Math.abs(tx) > 0.1 || Math.abs(tz) > 0.1)) {
      const ax = p.x + Math.sign(tx) * (PW + 0.1);
      const az = p.z + Math.sign(tz) * (PW + 0.1);
      if ((solidAt(ax, p.y + 0.5, p.z) || solidAt(p.x, p.y + 0.5, az)) && !solidAt(p.x, p.y + 2.2, p.z) && !solidAt(ax, p.y + 1.5, az)) p.vy = 8.6;
    }
    // Dano de queda
    if (!p.ground && !p.inWater) { if (p.fallFrom == null || p.y > p.fallFrom) p.fallFrom = p.y; }
    if (p.ground && !wasGround && p.fallFrom != null) {
      const dist = p.fallFrom - p.y;
      if (dist > 3.5) hurt(Math.floor(dist - 3));
      p.fallFrom = null;
    }
    if (p.inWater) p.fallFrom = null;
    if (p.y < -10) { hurt(4); p.y = world.surfaceY(Math.floor(p.x), Math.floor(p.z)) + 1; }
  }

  function hurt(n) {
    if (n <= 0 || p.health <= 0) return;
    p.health = Math.max(0, p.health - n);
    p.hurtT = 0.4;
    onSound?.('hit');
    if (p.health <= 0) {
      onToast?.('Você desmaiou! Voltando para o início...');
      setTimeout(() => {
        p.health = 20; p.hunger = Math.max(p.hunger, 12);
        p.x = p.spawn.x; p.y = world.surfaceY(Math.floor(p.spawn.x), Math.floor(p.spawn.z)) + 0.1; p.z = p.spawn.z;
        p.vx = p.vy = p.vz = 0;
      }, 1200);
    }
    hud(true);
  }

  // ───────────── Mira (raio) ─────────────
  const ray = new THREE.Raycaster();
  function pickBlock(dir) {
    const o = camera.position;
    let x = Math.floor(o.x); let y = Math.floor(o.y); let z = Math.floor(o.z);
    const sx = Math.sign(dir.x); const sy = Math.sign(dir.y); const sz = Math.sign(dir.z);
    const tdx = Math.abs(1 / dir.x); const tdy = Math.abs(1 / dir.y); const tdz = Math.abs(1 / dir.z);
    let tx = (sx > 0 ? x + 1 - o.x : o.x - x) * tdx;
    let ty = (sy > 0 ? y + 1 - o.y : o.y - y) * tdy;
    let tz = (sz > 0 ? z + 1 - o.z : o.z - z) * tdz;
    let face = null;
    let t = 0;
    while (t <= REACH) {
      const id = world.get(x, y, z);
      if (id && id !== B.WATER) return { x, y, z, id, face, dist: t };
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; face = [-sx, 0, 0]; }
      else if (ty < tz) { y += sy; t = ty; ty += tdy; face = [0, -sy, 0]; }
      else { z += sz; t = tz; tz += tdz; face = [0, 0, -sz]; }
    }
    return null;
  }
  function dirFromScreen(sx, sy) {
    if (sx == null) { const d = new THREE.Vector3(); camera.getWorldDirection(d); return d; }
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((sx - r.left) / r.width) * 2 - 1, -((sy - r.top) / r.height) * 2 + 1), camera);
    return ray.ray.direction.clone();
  }
  function pickMob(dir) {
    let best = null;
    const o = camera.position;
    for (const m of mobs) {
      const def = MOBS[m.type];
      const box = new THREE.Box3(new THREE.Vector3(m.x - def.w / 2, m.y, m.z - def.w / 2), new THREE.Vector3(m.x + def.w / 2, m.y + def.h, m.z + def.w / 2));
      const hit = new THREE.Ray(o, dir).intersectBox(box, new THREE.Vector3());
      if (hit) { const d = hit.distanceTo(o); if (d < 4 && (!best || d < best.d)) best = { m, d }; }
    }
    return best;
  }

  // Contorno do bloco mirado e rachaduras ao quebrar
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)), new THREE.LineBasicMaterial({ color: '#111', transparent: true, opacity: 0.6 }));
  outline.visible = false;
  scene.add(outline);
  const crackMats = [1, 2, 3, 4].map((n) => {
    const [u0, v0, u1, v1] = uvOf(`crack${n}`);
    const g = new THREE.BoxGeometry(1.01, 1.01, 1.01);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0);
    return g;
  });
  const crack = new THREE.Mesh(crackMats[0], new THREE.MeshBasicMaterial({ map: craftMaterials().solid.map, transparent: true, depthWrite: false }));
  crack.visible = false;
  scene.add(crack);

  const mining = { active: false, sx: null, sy: null, target: null, t: 0 };
  function breakTime(id) {
    const def = BLOCKS[id];
    if (!def || def.hard === Infinity) return Infinity;
    const h = held();
    const it = h && ITEMS[h.id];
    const right = it?.tool && it.tool === def.tool;
    if (right) return Math.max(0.05, (def.hard * 1.5) / it.speed);
    return def.hard * (def.tier ? 5 : 1.5);
  }
  function finishBreak(b) {
    const def = BLOCKS[b.id];
    const h = held();
    const it = h && ITEMS[h.id];
    const tierOk = !def.tier || (it?.tool === def.tool && it.tier >= def.tier);
    world.set(b.x, b.y, b.z, 0);
    // Planta em cima cai junto
    const above = world.get(b.x, b.y + 1, b.z);
    if (BLOCKS[above]?.plant || above === B.TORCH) world.set(b.x, b.y + 1, b.z, 0);
    if (tierOk) {
      if (def.dropChance) { for (const [id, ch] of def.dropChance) if (Math.random() < ch) inv.add(id, 1); }
      else if (def.drop !== null) inv.add(def.drop ?? b.id, 1);
    }
    if (it?.tool) wearTool();
    onSound?.('pop');
    // Areia e cascalho caem
    for (let y = b.y + 1; y < CH; y++) {
      const id = world.get(b.x, y, b.z);
      if (!BLOCKS[id]?.fall) break;
      world.set(b.x, y, b.z, 0);
      world.set(b.x, y - 1, b.z, id);
    }
  }
  function wearTool() {
    const h = held();
    if (!h || !ITEMS[h.id]?.tool) return;
    h.dur = (h.dur ?? ITEMS[h.id].uses) - 1;
    if (h.dur <= 0) { p.inv[p.sel] = null; onToast?.('A ferramenta quebrou!'); onSound?.('error'); }
    hud(true);
  }

  /** Toque rápido: bater num bicho, usar bancada/fornalha, comer ou colocar bloco. */
  function tap(sx, sy) {
    const dir = dirFromScreen(sx, sy);
    const mob = pickMob(dir);
    const b = pickBlock(dir);
    if (mob && (!b || mob.d < b.dist)) { attack(mob.m); return; }
    if (b && BLOCKS[b.id]?.use) { onUse?.(BLOCKS[b.id].use); return; }
    const h = held();
    if (h && ITEMS[h.id]?.food && (!b || p.hunger < 20)) { eat(); return; }
    if (!b || !b.face || !h || h.id >= 100) return;
    const nx = b.x + b.face[0]; const ny = b.y + b.face[1]; const nz = b.z + b.face[2];
    const cur = world.get(nx, ny, nz);
    if (cur && cur !== B.WATER && !BLOCKS[cur]?.plant) return;
    if (ny < 1 || ny >= CH) return;
    // Não coloca dentro do próprio jogador
    if (isSolid(h.id) && nx + 1 > p.x - PW && nx < p.x + PW && nz + 1 > p.z - PW && nz < p.z + PW && ny + 1 > p.y && ny < p.y + PH) return;
    if ((BLOCKS[h.id]?.plant || h.id === B.TORCH) && !isSolid(world.get(nx, ny - 1, nz))) return;
    world.set(nx, ny, nz, h.id);
    h.n--;
    if (!h.n) p.inv[p.sel] = null;
    onSound?.('tap');
    hud(true);
  }
  function eat() {
    const h = held();
    const it = h && ITEMS[h.id];
    if (!it?.food) return;
    if (p.hunger >= 20) { onToast?.('Você está sem fome.'); return; }
    p.hunger = Math.min(20, p.hunger + it.food);
    h.n--;
    if (!h.n) p.inv[p.sel] = null;
    onSound?.('coin');
    hud(true);
  }
  function attack(m) {
    const it = held() && ITEMS[held().id];
    const dmg = it?.damage || 1;
    m.hp -= dmg;
    m.hurtT = 0.3;
    const dx = m.x - p.x; const dz = m.z - p.z; const l = Math.hypot(dx, dz) || 1;
    m.vx = (dx / l) * 6; m.vz = (dz / l) * 6; m.vy = 4;
    m.flee = 4;
    if (it?.tool) wearTool();
    onSound?.('hit');
    if (m.hp <= 0) {
      for (const [id, a, b] of MOBS[m.type].drops) { const n = a + Math.floor(Math.random() * (b - a + 1)); if (n) inv.add(id, n); }
      scene.remove(m.mesh);
      mobs.splice(mobs.indexOf(m), 1);
    }
  }

  // ───────────── Bichos ─────────────
  const mobs = [];
  function spawnMob(type, x, z) {
    const y = world.surfaceY(Math.floor(x), Math.floor(z));
    if (world.get(Math.floor(x), y - 1, Math.floor(z)) === B.WATER) return;
    const mesh = makeMob(type);
    scene.add(mesh);
    mobs.push({ type, x: Math.floor(x) + 0.5, y, z: Math.floor(z) + 0.5, vx: 0, vy: 0, vz: 0, yaw: Math.random() * 6, hp: MOBS[type].hp, mesh, wander: 0, hurtT: 0, flee: 0, atk: 0 });
  }
  let spawnT = 0;
  function mobTick(dt, night) {
    spawnT -= dt;
    if (spawnT <= 0) {
      spawnT = 4;
      const passive = mobs.filter((m) => MOBS[m.type].passive).length;
      const spiders = mobs.filter((m) => m.type === 'aranha').length;
      const a = Math.random() * Math.PI * 2;
      const d = 18 + Math.random() * 16;
      const x = p.x + Math.cos(a) * d;
      const z = p.z + Math.sin(a) * d;
      const ground = world.get(Math.floor(x), world.surfaceY(Math.floor(x), Math.floor(z)) - 1, Math.floor(z));
      if (passive < 10 && (ground === B.GRASS || ground === B.SNOW_GRASS)) spawnMob(['vaca', 'ovelha', 'galinha'][Math.floor(Math.random() * 3)], x, z);
      if (night && spiders < 4) spawnMob('aranha', x, z);
    }
    for (let i = mobs.length - 1; i >= 0; i--) {
      const m = mobs[i];
      const def = MOBS[m.type];
      const dx = p.x - m.x; const dz = p.z - m.z; const dist = Math.hypot(dx, dz);
      // Longe demais ou aranha de dia: some
      if (dist > 70 || (m.type === 'aranha' && !night && dist > 20)) { scene.remove(m.mesh); mobs.splice(i, 1); continue; }
      let tx = 0; let tz = 0;
      if (def.hostile && night && dist < 16) {
        tx = (dx / dist) * def.speed; tz = (dz / dist) * def.speed;
        m.atk -= dt;
        if (dist < 1.3 && Math.abs(p.y - m.y) < 1.5 && m.atk <= 0) { hurt(def.dmg); m.atk = 1.1; const l = dist || 1; p.vx += (dx / l) * 5; p.vz += (dz / l) * 5; p.vy = 4; }
      } else if (m.flee > 0) {
        m.flee -= dt;
        tx = (-dx / (dist || 1)) * def.speed * 2; tz = (-dz / (dist || 1)) * def.speed * 2;
      } else {
        m.wander -= dt;
        if (m.wander <= 0) { m.wander = 2 + Math.random() * 4; m.wyaw = Math.random() < 0.4 ? null : Math.random() * Math.PI * 2; }
        if (m.wyaw != null) { tx = -Math.sin(m.wyaw) * def.speed * 0.6; tz = -Math.cos(m.wyaw) * def.speed * 0.6; }
      }
      m.vx += (tx - m.vx) * Math.min(1, dt * 5);
      m.vz += (tz - m.vz) * Math.min(1, dt * 5);
      m.vy -= 28 * dt;
      const nx = m.x + m.vx * dt;
      const nz = m.z + m.vz * dt;
      const blocked = (x, z) => isSolid(world.get(Math.floor(x), Math.floor(m.y + 0.3), Math.floor(z)));
      if (!blocked(nx, m.z)) m.x = nx; else if (!isSolid(world.get(Math.floor(nx), Math.floor(m.y + 1.3), Math.floor(m.z)))) m.vy = 7; else m.vx = 0;
      if (!blocked(m.x, nz)) m.z = nz; else if (!isSolid(world.get(Math.floor(m.x), Math.floor(m.y + 1.3), Math.floor(nz)))) m.vy = 7; else m.vz = 0;
      m.y += m.vy * dt;
      if (isSolid(world.get(Math.floor(m.x), Math.floor(m.y), Math.floor(m.z)))) { m.y = Math.floor(m.y) + 1; m.vy = 0; }
      if (world.get(Math.floor(m.x), Math.floor(m.y), Math.floor(m.z)) === B.WATER) m.vy = Math.max(m.vy, 1.5);
      if (Math.hypot(m.vx, m.vz) > 0.2) m.yaw = Math.atan2(-m.vx, -m.vz);
      m.mesh.position.set(m.x, m.y, m.z);
      m.mesh.rotation.y = m.yaw;
      const sw = Math.sin(window.performance.now() / 120) * (Math.hypot(m.vx, m.vz) > 0.2 ? 0.5 : 0);
      (m.mesh.userData.legs || []).forEach((l, k) => { l.rotation.x = k % 2 ? sw : -sw; });
      m.hurtT = Math.max(0, m.hurtT - dt);
      m.mesh.traverse((o) => { if (o.isMesh) o.material.emissive?.setRGB(m.hurtT > 0 ? 0.6 : 0, 0, 0); });
    }
  }

  // ───────────── Jogadores online ─────────────
  const remotes = new Map();

  // ───────────── HUD e laço ─────────────
  function hud(force) {
    if (force) hudDirty = true;
  }
  function biomeName() { return world.biomeAt(Math.floor(p.x), Math.floor(p.z)); }

  let raf = 0;
  let last = 0;
  let saveT = 0;
  let posT = 0;
  let loading = true;
  function frame(now) {
    raf = window.requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    const pending = ensureChunks();
    if (loading) {
      // Espera o chão em volta ficar pronto antes de deixar cair
      if (pending > 0 && meshes.size < 9) { camera.position.set(p.x, p.y + EYE, p.z); renderer.render(scene, camera); return; }
      loading = false;
      onHud?.({ loading: false });
    }
    p.time = (p.time + dt) % DAY;
    const dayK = Math.cos(((p.time / DAY) - 0.25) * Math.PI * 2) * 0.5 + 0.5; // 1 meio-dia, 0 meia-noite
    const night = dayK < 0.28;
    sky.copy(nightSky).lerp(daySky, Math.min(1, dayK * 1.4));
    scene.background = sky;
    scene.fog.color.copy(sky);
    hemi.intensity = 0.35 + dayK * 1.25;
    sun.intensity = dayK * 1.2;
    physics(dt);
    // Fome e vida
    const moving = Math.hypot(p.vx, p.vz) > 0.5;
    p.hungerT += dt * (moving ? 1.6 : 1);
    if (p.hungerT > 45) { p.hungerT = 0; p.hunger = Math.max(0, p.hunger - 1); hud(true); }
    p.regenT += dt;
    if (p.regenT > 4) {
      p.regenT = 0;
      if (p.hunger >= 16 && p.health < 20) { p.health = Math.min(20, p.health + 1); p.hunger = Math.max(0, p.hunger - 0.5); hud(true); }
      if (p.hunger <= 0 && p.health > 2) hurt(1);
    }
    p.hurtT = Math.max(0, p.hurtT - dt);
    mobTick(dt, night);
    // Câmera
    camera.position.set(p.x, p.y + EYE, p.z);
    camera.rotation.set(p.pitch, p.yaw, 0);
    // Mira
    const dir = mining.active ? dirFromScreen(mining.sx, mining.sy) : dirFromScreen();
    const b = pickBlock(dir);
    outline.visible = !!b;
    if (b) outline.position.set(b.x + 0.5, b.y + 0.5, b.z + 0.5);
    if (mining.active && b) {
      const same = mining.target && mining.target.x === b.x && mining.target.y === b.y && mining.target.z === b.z;
      if (!same) { mining.target = b; mining.t = 0; }
      const total = breakTime(b.id);
      mining.t += dt;
      const k = Math.min(3, Math.floor((mining.t / total) * 4));
      crack.visible = total !== Infinity && total > 0.1;
      crack.geometry = crackMats[k];
      crack.position.set(b.x + 0.5, b.y + 0.5, b.z + 0.5);
      if (mining.t >= total) { finishBreak(b); mining.t = 0; mining.target = null; crack.visible = false; }
    } else { crack.visible = false; if (!mining.active) mining.target = null; }
    // Outros jogadores
    for (const r of remotes.values()) {
      if (!r.t) continue;
      const k = Math.min(1, dt * 10);
      r.mesh.position.x += (r.t.x - r.mesh.position.x) * k;
      r.mesh.position.y += (r.t.y - r.mesh.position.y) * k;
      r.mesh.position.z += (r.t.z - r.mesh.position.z) * k;
      r.mesh.rotation.y = r.t.r;
    }
    if (online && now - posT > 100) { posT = now; onPos?.({ x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), r: +p.yaw.toFixed(2) }); }
    saveT += dt;
    if (saveT > 15) { saveT = 0; onSave?.(); }
    if (hudDirty || now - hudAt > 500) {
      hudAt = now;
      hudDirty = false;
      onHud?.({
        health: p.health, hunger: p.hunger, sel: p.sel, inv: p.inv.map((s) => (s ? { ...s } : null)), night,
        biome: biomeName(), hurt: p.hurtT > 0, inWater: p.inWater, x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z),
        clock: Math.floor(((p.time / DAY) * 24 + 6) % 24),
      });
    }
    renderer.render(scene, camera);
  }

  function resize() {
    const w = canvas.clientWidth || 360;
    const h = canvas.clientHeight || 640;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new window.ResizeObserver(resize);
  ro.observe(canvas);
  raf = window.requestAnimationFrame(frame);

  const nearBlock = (id, r = 4) => {
    for (let x = -r; x <= r; x++) for (let y = -2; y <= 3; y++) for (let z = -r; z <= r; z++) if (world.get(Math.floor(p.x) + x, Math.floor(p.y) + y, Math.floor(p.z) + z) === id) return true;
    return false;
  };

  return {
    world,
    input: {
      move(x, z) { p.mx = x; p.mz = z; },
      look(dx, dy) { p.yaw -= dx; p.pitch = Math.max(-1.55, Math.min(1.55, p.pitch - dy)); },
      jump(on) { p.jump = on; },
      tap,
      mineStart(sx, sy) { mining.active = true; mining.sx = sx; mining.sy = sy; mining.t = 0; mining.target = null; },
      mineMove(sx, sy) { mining.sx = sx; mining.sy = sy; },
      mineEnd() { mining.active = false; mining.target = null; },
      select(i) { p.sel = i; hud(true); },
      eat,
    },
    inv,
    get state() { return p; },
    nearTable: () => nearBlock(B.TABLE),
    nearFurnace: () => nearBlock(B.FURNACE),
    craft(r) {
      if (r.grid === 3 && !nearBlock(B.TABLE)) return 'Precisa estar perto de uma bancada de trabalho.';
      for (const [ids, n] of r.need) if (inv.count(ids) < n) return 'Faltam materiais.';
      for (const [ids, n] of r.need) inv.remove(ids, n);
      inv.add(r.out[0], r.out[1]);
      onSound?.('point');
      return null;
    },
    smelt(id) {
      if (!nearBlock(B.FURNACE)) return 'Precisa estar perto de uma fornalha.';
      if (!SMELT[id] || inv.count(id) < 1) return 'Nada para assar.';
      if (p.fuel < 1) {
        const fuelId = Object.keys(FUEL).map(Number).find((f) => f !== id && inv.count(f) > 0);
        if (fuelId == null) return 'Sem combustível (carvão ou madeira).';
        inv.remove(fuelId, 1);
        p.fuel += FUEL[fuelId];
      }
      p.fuel -= 1;
      inv.remove(id, 1);
      inv.add(SMELT[id], 1);
      onSound?.('coin');
      return null;
    },
    moveSlot(a, b) { const t = p.inv[a]; p.inv[a] = p.inv[b]; p.inv[b] = t; hud(true); },
    setRemote(id, d, name, o) {
      let r = remotes.get(id);
      if (!r) { const mesh = makeAvatar(o, name); scene.add(mesh); r = { mesh }; remotes.set(id, r); mesh.position.set(d.x, d.y, d.z); }
      r.t = d;
    },
    removeRemote(id) { const r = remotes.get(id); if (r) { scene.remove(r.mesh); remotes.delete(id); } },
    applyRemoteBlock(x, y, z, id) { world.chunk(Math.floor(x / CS), Math.floor(z / CS)); world.set(x, y, z, id, { remote: true }); },
    setRadius(r) { radius = r; },
    exportSave() {
      const { mx: _a, mz: _b, jump: _c, ...player } = p;
      return { seed, changes: world.exportChanges(), player, time: p.time };
    },
    exportPlayer() { const { mx: _a, mz: _b, jump: _c, ...player } = p; return player; },
    dispose() {
      window.cancelAnimationFrame(raf);
      ro.disconnect();
      for (const m of meshes.values()) m.children.forEach((c) => c.geometry.dispose());
      renderer.dispose();
    },
  };
}

