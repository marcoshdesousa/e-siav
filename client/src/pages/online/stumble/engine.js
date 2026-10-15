// Stumble DBV: mundo 3D, física do jogador e os outros jogadores em tempo real.
import * as THREE from 'three';
import { animate, makeStumbler } from './character.js';
import { buildStage } from './stages.js';
import { outfitById } from './outfits.js';

const SPEED = 7.2;
const GRAV = 32;
const JUMP = 11.5;
const R = 0.45;
const H = 1.8;

function nameSprite(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 34px Arial';
  g.textAlign = 'center';
  g.lineWidth = 7;
  g.strokeStyle = 'rgba(0,0,0,.7)';
  g.strokeText(text, 128, 44);
  g.fillStyle = '#fff';
  g.fillText(text, 128, 44);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  s.scale.set(2.4, 0.6, 1);
  s.position.y = 2.8;
  return s;
}

export function createStumble(canvas, { outfit, getTime, onFinish, onProgress, sendPos, onSound }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: window.devicePixelRatio < 2, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 260);
  scene.add(new THREE.HemisphereLight('#ffffff', '#64748b', 1.7));
  const sun = new THREE.DirectionalLight('#fffaf0', 1.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 18, bottom: -18, near: 1, far: 70 });
  scene.add(sun, sun.target);

  let stage = null;
  let me = makeStumbler(outfitById(outfit));
  scene.add(me);
  const st = {
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, grounded: false, stun: 0, dive: 0, finished: false, cp: 0, yaw: 0,
    mode: 'idle', mx: 0, mz: 0, lastSend: 0, lastProg: 0, respawn: 0, animT: 0, introK: 0,
  };
  const remotes = new Map();

  function clearStage() {
    if (!stage) return;
    scene.remove(stage.group);
    stage = null;
  }

  /** Caminho dos robôs: segue o chão da pista (desvia das portas de verdade e pula os buracos). */
  let path = [];
  function buildPath() {
    path = [];
    let px = 0;
    for (let z = -2; z >= stage.finishZ - 3; z -= 0.5) {
      let best = null;
      for (const p of stage.plats) {
        if (p.kind === 'fake' || Math.abs(z - p.z) > p.d / 2) continue;
        const inside = Math.abs(px - p.x) <= p.w / 2 - 0.3;
        const d = inside ? -1 : Math.abs(px - p.x);
        if (!best || d < best.d) best = { p, d };
      }
      if (best) {
        const p = best.p;
        px = Math.max(p.x - p.w / 2 + 0.5, Math.min(p.x + p.w / 2 - 0.5, best.d < 0 ? px : p.x));
        // Porta de verdade na frente: vai para uma porta falsa
        const wall = stage.walls.find((w) => !w.fake && !w.knock && Math.abs(z - w.z) < 0.8 && Math.abs(px - w.x) < w.w / 2 && w.y0 < 1);
        if (wall) {
          const doors = stage.walls.filter((w) => w.fake && Math.abs(z - w.z) < 0.8);
          if (doors.length) px = doors.reduce((a, b) => (Math.abs(b.x - px) < Math.abs(a.x - px) ? b : a)).x;
        }
        path.push({ x: px, z, y: platTop({ ...p, ox: 0, oy: 0, oz: 0, gone: false }, px, z) ?? p.top });
      } else path.push({ x: null, z, y: null });
    }
    // Buracos: liga as pontas com um pulo
    for (let i = 0; i < path.length; i++) {
      if (path[i].y != null) continue;
      let j = i;
      while (j < path.length && path[j].y == null) j++;
      const a = path[i - 1] || path[j];
      const b = path[j] || a;
      for (let k = i; k < j; k++) {
        const f = (k - i + 1) / (j - i + 1);
        path[k].x = a.x + (b.x - a.x) * f;
        path[k].y = a.y + (b.y - a.y) * f + Math.sin(f * Math.PI) * 1.8;
        path[k].air = true;
      }
      i = j;
    }
  }
  function pathAt(k, off) {
    if (!path.length) return null;
    const f = Math.max(0, Math.min(1, k)) * (path.length - 1);
    const i = Math.floor(f);
    const a = path[i];
    const b = path[Math.min(path.length - 1, i + 1)];
    const t = f - i;
    return { x: a.x + (b.x - a.x) * t + off, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, air: a.air || b.air };
  }
  let botT = {};
  let botDone = new Set();

  function loadStage(index, seed, slot, count) {
    clearStage();
    stage = buildStage(scene, index, seed);
    buildPath();
    const cols = Math.min(count, 5);
    const row = Math.floor(slot / 5);
    st.x = (slot % 5 - (cols - 1) / 2) * 1.6;
    st.z = -3 - row * 1.8;
    st.y = 0.01;
    st.vx = st.vy = st.vz = 0;
    st.finished = false;
    st.cp = 0;
    st.stun = st.dive = 0;
    st.yaw = 0;
    return { name: stage.name, length: stage.length };
  }

  // ───────────── Colisão ─────────────
  function platTop(p, x, z) {
    if (p.gone) return null;
    const px = p.x + p.ox;
    const pz = p.z + p.oz;
    if (Math.abs(x - px) > p.w / 2 + 0.15 || Math.abs(z - pz) > p.d / 2 + 0.15) return null;
    if (p.slope) {
      const { z0, z1, y0, y1 } = p.slope;
      const k = Math.max(0, Math.min(1, (z0 - z) / (z0 - z1)));
      return y0 + (y1 - y0) * k;
    }
    return p.top + p.oy;
  }

  function knock(dx, dz, power, up = 5) {
    const l = Math.hypot(dx, dz) || 1;
    st.vx = (dx / l) * power;
    st.vz = (dz / l) * power;
    st.vy = Math.max(st.vy, up);
    st.stun = 0.55;
    st.grounded = false;
    onSound?.('hit');
  }

  function physics(dt, t) {
    // Controle
    const ctl = st.stun <= 0 && st.dive <= 0;
    const want = Math.hypot(st.mx, st.mz) > 0.15;
    const acc = st.grounded ? 14 : 4;
    if (ctl) {
      const tx = want ? st.mx * SPEED : 0;
      const tz = want ? st.mz * SPEED : 0;
      st.vx += (tx - st.vx) * Math.min(1, dt * acc);
      st.vz += (tz - st.vz) * Math.min(1, dt * acc);
    } else if (st.grounded) {
      st.vx *= 1 - Math.min(1, dt * 3);
      st.vz *= 1 - Math.min(1, dt * 3);
    }
    st.stun = Math.max(0, st.stun - dt);
    if (st.dive > 0) { st.dive -= dt; if (st.dive <= 0) st.stun = 0.25; }
    st.vy -= GRAV * dt;
    // Plataforma embaixo leva o jogador junto (móveis e esteiras)
    let carry = null;
    let best = -Infinity;
    for (const p of stage.plats) {
      const top = platTop(p, st.x, st.z);
      if (top == null || top > st.y + 0.45 || top < st.y - 0.7) continue;
      if (top > best) { best = top; carry = p; }
    }
    if (carry && st.grounded) {
      st.x += carry.dx;
      st.z += carry.dz;
      if (carry.kind === 'conveyor') st.z += carry.conv * dt;
    }
    st.x += st.vx * dt;
    st.y += st.vy * dt;
    st.z += st.vz * dt;
    // Chão
    st.grounded = false;
    let ground = null;
    let gtop = -Infinity;
    for (const p of stage.plats) {
      const top = platTop(p, st.x, st.z);
      if (top == null || top > st.y + 0.45) continue;
      if (top > gtop) { gtop = top; ground = p; }
    }
    if (ground && st.y <= gtop && st.vy <= 0 && gtop - st.y < 0.9) {
      st.y = gtop;
      if (ground.kind === 'bounce') { st.vy = 17; onSound?.('jump'); }
      else { st.vy = 0; st.grounded = true; }
      if (ground.kind === 'fake' && !ground.fallAt) ground.fallAt = t;
    }
    // Paredes
    for (const w of stage.walls) {
      if (w.gone) continue;
      if (st.y > w.y0 + w.h || st.y + H < w.y0) continue;
      const wx = w.x + (w.ox || 0);
      const cx = Math.max(wx - w.w / 2, Math.min(st.x, wx + w.w / 2));
      const cz = Math.max(w.z - w.d / 2, Math.min(st.z, w.z + w.d / 2));
      const dx = st.x - cx;
      const dz = st.z - cz;
      const d = Math.hypot(dx, dz);
      if (d >= R) continue;
      if (w.fake) { w.gone = true; w.mesh.visible = false; onSound?.('pop'); continue; }
      const nx = d > 1e-4 ? dx / d : 0;
      const nz = d > 1e-4 ? dz / d : 1;
      st.x = cx + nx * R;
      st.z = cz + nz * R;
      if (w.knock) knock(nx + (w.vx || 0) * 0.15, nz, w.knock + Math.abs(w.vx || 0) * 0.5, 4);
      else {
        const vn = st.vx * nx + st.vz * nz;
        if (vn < 0) { st.vx -= vn * nx; st.vz -= vn * nz; }
      }
    }
    // Obstáculos que derrubam
    if (st.stun <= 0) {
      for (const h of stage.hitters) {
        if (h.type === 'bar') {
          const ux = Math.cos(h.ang);
          const uz = -Math.sin(h.ang);
          const rx = st.x - h.cx;
          const rz = st.z - h.cz;
          const along = Math.max(-h.L, Math.min(h.L, rx * ux + rz * uz));
          const px = h.cx + ux * along;
          const pz = h.cz + uz * along;
          const d = Math.hypot(st.x - px, st.z - pz);
          if (d < 0.25 + R && st.y < h.y + 0.25 && st.y + H > h.y - 0.25) {
            // Empurra no sentido em que a barra gira
            const tx = -Math.sin(h.ang) * along * h.w;
            const tz = -Math.cos(h.ang) * along * h.w;
            knock(tx || (st.x - px), tz || (st.z - pz), 9 + Math.abs(along * h.w) * 0.4, 6);
            break;
          }
        } else if (h.type === 'ball') {
          const dx = st.x - h.x;
          const dz = st.z - h.z;
          const dy = st.y + 0.9 - h.y;
          if (Math.hypot(dx, dy, dz) < h.r + 0.55) { knock(dx + h.vx * 0.1, dz, 11 + Math.abs(h.vx) * 0.4, 6); break; }
        } else if (h.type === 'bumper') {
          const dx = st.x - h.x;
          const dz = st.z - h.z;
          if (st.y < 1.3 && Math.hypot(dx, dz) < h.r + R) { knock(dx, dz, 12, 4); break; }
        }
      }
    }
    // Pontos seguros
    for (const c of stage.checkpoints) if (st.z < c - 0.5 && c < st.cp) st.cp = c;
    // Caiu na água: volta no último ponto seguro
    if (st.y < -6 && !st.respawn) { st.respawn = 0.9; onSound?.('error'); }
    if (st.respawn) {
      st.respawn -= dt;
      if (st.respawn <= 0) {
        st.respawn = 0;
        st.x = 0; st.y = 2.5; st.z = st.cp + 1.5;
        st.vx = st.vy = st.vz = 0;
        st.stun = 0.3;
      }
    }
    // Chegada
    if (!st.finished && st.z < stage.finishZ && st.y > -1) {
      st.finished = true;
      onSound?.('win');
      onFinish?.();
    }
    if (Math.hypot(st.vx, st.vz) > 0.5 && st.stun <= 0) st.yaw = Math.atan2(-st.vx, -st.vz);
  }

  // ───────────── Laço ─────────────
  let raf = 0;
  let last = 0;
  function frame(now) {
    raf = window.requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    st.animT += dt;
    if (!stage) { renderer.render(scene, camera); return; }
    const t = getTime();
    // Obstáculos e plataformas móveis (mesmo tempo para todos)
    for (const u of stage.updaters) u(t);
    for (const p of stage.plats) {
      if (p.move) {
        const o = p.move(t);
        p.dx = o.x - p.ox; p.dz = o.z - p.oz;
        p.ox = o.x; p.oy = o.y; p.oz = o.z;
        p.mesh.position.set(p.x + p.ox, p.baseY + p.oy, p.z + p.oz);
      } else { p.dx = 0; p.dz = 0; }
      if (p.fallAt != null && !p.gone && t - p.fallAt > 0.25) { p.gone = true; }
      if (p.gone && p.mesh.position.y > -20) p.mesh.position.y -= dt * 12;
    }
    const racing = st.mode === 'race' && t >= 0;
    if (racing) physics(dt, t);
    // Meu boneco
    me.position.set(st.x, st.y, st.z);
    me.rotation.y += ((st.yaw - me.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 12);
    const anim = st.dive > 0 ? 'dive' : st.stun > 0 ? 'stun' : !st.grounded && racing ? 'air' : Math.hypot(st.vx, st.vz) > 1 ? 'run' : 'idle';
    animate(me, st.animT, anim);
    me.visible = st.mode !== 'spectate';
    // Envia a minha posição ~12 vezes por segundo
    if (racing && now - st.lastSend > 80) {
      st.lastSend = now;
      sendPos?.({ x: +st.x.toFixed(2), y: +st.y.toFixed(2), z: +st.z.toFixed(2), r: +me.rotation.y.toFixed(2), a: anim });
    }
    if (racing && now - st.lastProg > 1000 && stage.finishZ) {
      st.lastProg = now;
      onProgress?.(Math.max(0, Math.min(1, st.z / stage.finishZ)));
    }
    // Robôs: andam pelo caminho no tempo deles
    for (const [id, r] of remotes) {
      if (!r.bot || !r.alive || t < 0) continue;
      const T = botT[id] || 40;
      const done = botDone.has(id);
      const k = done ? 1 : Math.min(t / T, 0.985);
      const q = pathAt(k, r.off);
      if (!q) continue;
      const prev = r.target || q;
      const moving = !done && k < 0.985;
      r.target = { x: q.x, y: q.y, z: done ? q.z - 1.5 : q.z, r: Math.atan2(-(q.x - prev.x), -(q.z - prev.z) || -1e-3), a: q.air && moving ? 'air' : moving ? 'run' : 'idle' };
    }
    // Os outros
    for (const r of remotes.values()) {
      if (!r.target) continue;
      const k = Math.min(1, dt * 12);
      r.mesh.position.x += (r.target.x - r.mesh.position.x) * k;
      r.mesh.position.y += (r.target.y - r.mesh.position.y) * k;
      r.mesh.position.z += (r.target.z - r.mesh.position.z) * k;
      r.mesh.rotation.y = r.target.r;
      animate(r.mesh, st.animT + r.phase, r.target.a);
    }
    // Câmera
    if (st.mode === 'intro') {
      const k = st.introK;
      // Passeio pela pista: da chegada até a largada, sempre olhando para a frente
      const z = THREE.MathUtils.lerp(stage.finishZ + 18, 9, k);
      camera.position.set(Math.sin(k * 3) * 3, 10 - k * 3, z);
      camera.lookAt(0, 0, z - 16);
    } else if (st.mode === 'spectate') {
      let lead = null;
      for (const r of remotes.values()) if (r.target && r.alive && (!lead || r.target.z < lead.target.z)) lead = r;
      const fz = lead ? lead.mesh.position.z : st.z;
      const fx = lead ? lead.mesh.position.x : 0;
      const fy = lead ? lead.mesh.position.y : 0;
      camera.position.lerp(new THREE.Vector3(fx * 0.5, fy + 7, fz + 10), Math.min(1, dt * 3));
      camera.lookAt(fx, fy + 1, fz - 4);
    } else {
      const target = new THREE.Vector3(st.x * 0.7, Math.max(st.y, -2) + 5.8, st.z + 8.6);
      camera.position.lerp(target, Math.min(1, dt * 6));
      camera.lookAt(st.x * 0.85, Math.max(st.y, -2) + 1, st.z - 5);
    }
    sun.position.set(camera.position.x - 8, 22, camera.position.z - 4);
    sun.target.position.set(camera.position.x, 0, camera.position.z - 14);
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

  return {
    loadStage,
    setMode(m) { st.mode = m; },
    setIntro(k) { st.introK = k; },
    setOutfit(o) {
      const pos = me.position.clone();
      scene.remove(me);
      me = makeStumbler(outfitById(o));
      me.position.copy(pos);
      scene.add(me);
    },
    setPlayers(list, meId) {
      // Cria/remove os bonecos dos outros jogadores
      const ids = new Set(list.filter((p) => p.id !== meId).map((p) => p.id));
      for (const [id, r] of remotes) if (!ids.has(id)) { scene.remove(r.mesh); remotes.delete(id); }
      for (const p of list) {
        if (p.id === meId) continue;
        let r = remotes.get(p.id);
        if (!r || r.outfit !== p.outfit) {
          if (r) scene.remove(r.mesh);
          const mesh = makeStumbler(outfitById(p.outfit));
          mesh.add(nameSprite(p.name));
          scene.add(mesh);
          r = { mesh, outfit: p.outfit, target: null, phase: Math.random() * 3, alive: true, bot: !!p.bot, off: (Math.random() - 0.5) * 1.2 };
          remotes.set(p.id, r);
        }
        r.alive = p.alive !== false;
        r.mesh.visible = r.alive || st.mode === 'spectate';
      }
    },
    setBots(times, finished) { botT = times || {}; botDone = new Set(finished || []); },
    placeRemote(id, slot, count) {
      const r = remotes.get(id);
      if (!r) return;
      const cols = Math.min(count, 5);
      const x = (slot % 5 - (cols - 1) / 2) * 1.6;
      const z = -3 - Math.floor(slot / 5) * 1.8;
      r.target = { x, y: 0, z, r: 0, a: 'idle' };
      r.mesh.position.set(x, 0, z);
    },
    remotePos(id, d) {
      const r = remotes.get(id);
      if (r && d && Number.isFinite(d.x)) r.target = { x: d.x, y: d.y, z: d.z, r: d.r || 0, a: ['run', 'idle', 'air', 'dive', 'stun'].includes(d.a) ? d.a : 'idle' };
    },
    input: {
      move(x, z) { st.mx = x; st.mz = z; },
      jump() { if (st.mode === 'race' && st.grounded && st.stun <= 0) { st.vy = JUMP; st.grounded = false; onSound?.('jump'); } },
      dive() {
        if (st.mode !== 'race' || st.dive > 0 || st.stun > 0) return;
        const l = Math.hypot(st.vx, st.vz);
        const fx = l > 0.5 ? st.vx / l : -Math.sin(st.yaw);
        const fz = l > 0.5 ? st.vz / l : -Math.cos(st.yaw);
        st.vx = fx * 11; st.vz = fz * 11; st.vy = Math.max(st.vy, 4);
        st.dive = 0.6;
        onSound?.('move');
      },
    },
    get finished() { return st.finished; },
    debug: () => ({ ...st, t: getTime(), path: path.length, bots: [...remotes].map(([id, r]) => ({ id, bot: r.bot, alive: r.alive, vis: r.mesh.visible, t: r.target, pos: r.mesh.position.toArray() })) }),
    dispose() {
      window.cancelAnimationFrame(raf);
      ro.disconnect();
      clearStage();
      renderer.dispose();
    },
  };
}
