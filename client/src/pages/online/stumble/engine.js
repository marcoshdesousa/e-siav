// Stumble DBV: mundo 3D, física do jogador e os outros jogadores em tempo real.
// A física roda em passos pequenos (120 por segundo) para ninguém atravessar o chão quando o
// celular engasga. Os obstáculos se movem pelo tempo da corrida (igual em todos os celulares).
import * as THREE from 'three';
import { animate, makeStumbler } from './character.js';
import { buildStage } from './stages.js';
import { outfitById } from './outfits.js';
import { studioEnv } from '../avatar/build.js';
import { DIVE_V, JUMP_BUF, STEP, hitTest, newBody, stepBody, updateStage } from './physics.js';

const REMOTE_DELAY = 110; // ms de atraso para interpolar os outros jogadores sem tremer
const LABEL_Y = 2.75; // altura do nome acima do pé do boneco

/** Diferença entre ângulos pelo caminho mais curto. */
const angDiff = (a, b) => ((((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;

export function createStumble(canvas, { outfit, getTime, onFinish, onProgress, sendPos, onSound }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: window.devicePixelRatio < 2, powerPreference: 'high-performance' });
  // Celular deitado: no máximo 1,5 pixel por ponto (a tela já é larga; acima disso só gasta bateria)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // sombra simples (a "soft" custa caro no celular)
  renderer.shadowMap.autoUpdate = false; // a sombra é refeita a cada 2 quadros
  const scene = new THREE.Scene();
  // Reflexo de estúdio suave: deixa o plástico das peças e dos bonecos brilhante
  scene.environment = studioEnv(renderer);
  scene.environmentIntensity = 0.5;
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 240); // além da névoa não desenha nada
  // Luz do céu (pega a cor do céu e da água de cada fase) + sol com a única sombra da cena
  const hemi = new THREE.HemisphereLight('#eaf6ff', '#c2a98a', 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff1dc', 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 20, bottom: -20, near: 1, far: 80 });
  scene.add(sun, sun.target);
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const camLookNow = new THREE.Vector3(0, 1, -5);

  // Clarão branco na frente da câmera (quando volta da água)
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false }));
  flash.position.z = -0.5;
  flash.renderOrder = 999;
  flash.visible = false;
  camera.add(flash);
  scene.add(camera);

  // ───────────── Partículas (poeira ao cair, brilho na cama elástica) ─────────────
  const DUST = new THREE.Color('#f8fafc');
  const SPARK = new THREE.Color('#fde047');
  const SPLASH = new THREE.Color('#e0f2fe');
  const puffTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.45, 'rgba(255,255,255,.75)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const puffs = Array.from({ length: 32 }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false }));
    s.visible = false;
    scene.add(s);
    return { s, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 1 };
  });
  let puffI = 0;
  function burst(x, y, z, n, color, speed, size) {
    for (let k = 0; k < n; k++) {
      const p = puffs[puffI++ % puffs.length];
      const a = (k / n) * Math.PI * 2 + Math.random() * 0.5;
      p.vx = Math.cos(a) * speed * (0.6 + Math.random() * 0.4);
      p.vz = Math.sin(a) * speed * (0.6 + Math.random() * 0.4);
      p.vy = speed * (0.25 + Math.random() * 0.5);
      p.life = p.max = 0.45 + Math.random() * 0.25;
      p.size = size;
      p.s.material.color.copy(color);
      p.s.position.set(x, y, z);
      p.s.visible = true;
    }
  }
  function stepPuffs(dt) {
    for (const p of puffs) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.s.visible = false; continue; }
      p.vy -= 6 * dt;
      p.vx *= 1 - Math.min(1, dt * 4);
      p.vz *= 1 - Math.min(1, dt * 4);
      p.s.position.x += p.vx * dt;
      p.s.position.y += p.vy * dt;
      p.s.position.z += p.vz * dt;
      const k = p.life / p.max;
      p.s.scale.setScalar(p.size * (1.6 - k));
      p.s.material.opacity = k * 0.9;
    }
  }

  // ───────────── Confete na chegada (um InstancedMesh só = 1 desenho) ─────────────
  const CONF_N = 140;
  const confGeo = new THREE.PlaneGeometry(0.16, 0.26);
  const confMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, fog: false });
  const conf = new THREE.InstancedMesh(confGeo, confMat, CONF_N);
  conf.frustumCulled = false;
  conf.visible = false;
  const confP = Array.from({ length: CONF_N }, (_, i) => {
    conf.setColorAt(i, new THREE.Color().setHSL((i * 0.137) % 1, 0.9, 0.58));
    return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, sx: 0, sy: 0, life: 0 };
  });
  scene.add(conf);
  let confLife = 0;
  const _m = new THREE.Object3D();
  function confetti(x, y, z) {
    for (const p of confP) {
      const a = Math.random() * Math.PI * 2;
      const v = 3 + Math.random() * 6;
      Object.assign(p, { x, y, z, vx: Math.cos(a) * v, vz: Math.sin(a) * v - 2, vy: 7 + Math.random() * 8, rx: Math.random() * 6, ry: Math.random() * 6, sx: 4 + Math.random() * 8, sy: 3 + Math.random() * 7, life: 2.6 + Math.random() * 1.6 });
    }
    confLife = 4.4;
    conf.visible = true;
  }
  function stepConfetti(dt) {
    if (confLife <= 0) return;
    confLife -= dt;
    for (let i = 0; i < CONF_N; i++) {
      const p = confP[i];
      p.life -= dt;
      // Cai devagar e balança como papel
      p.vy = Math.max(p.vy - 14 * dt, -2.4);
      p.vx *= 1 - Math.min(1, dt * 1.6);
      p.vz *= 1 - Math.min(1, dt * 1.6);
      p.x += (p.vx + Math.sin(p.rx * 2) * 0.8) * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rx += p.sx * dt;
      p.ry += p.sy * dt;
      _m.position.set(p.x, p.y, p.z);
      _m.rotation.set(p.rx, p.ry, 0);
      _m.scale.setScalar(p.life > 0 ? Math.min(1, p.life * 2) : 0);
      _m.updateMatrix();
      conf.setMatrixAt(i, _m.matrix);
    }
    conf.instanceMatrix.needsUpdate = true;
    if (confLife <= 0) conf.visible = false;
  }

  // ───────────── Linhas de velocidade (mergulho e quedas rápidas) ─────────────
  const LINE_N = 18;
  const lineGeo = new THREE.BoxGeometry(0.025, 0.025, 1);
  const lineMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, depthWrite: false, fog: false });
  const lines = new THREE.InstancedMesh(lineGeo, lineMat, LINE_N);
  lines.frustumCulled = false;
  lines.visible = false;
  scene.add(lines);
  const lineP = Array.from({ length: LINE_N }, () => ({ x: 0, y: 0, z: 0, ry: 0, len: 1, life: 0 }));
  let lineI = 0;
  let lineAcc = 0;
  let linesOn = 0;
  function stepLines(dt, fast) {
    if (fast) {
      lineAcc += dt * 40;
      while (lineAcc >= 1) {
        lineAcc -= 1;
        const p = lineP[lineI++ % LINE_N];
        const a = Math.random() * Math.PI * 2;
        const rr = 0.7 + Math.random() * 0.9;
        // Nasce em volta do boneco, um pouco atrás do movimento
        const vl = Math.hypot(st.vx, st.vz) || 1;
        const back = 0.6 + Math.random();
        p.x = st.x + Math.cos(a) * rr - (st.vx / vl) * back;
        p.y = st.y + 0.9 + Math.sin(a) * rr * 0.8;
        p.z = st.z + Math.sin(a) * rr * 0.3 - (st.vz / vl) * back;
        p.ry = Math.atan2(st.vx, st.vz);
        p.len = 0.8 + Math.random() * 1.2;
        p.life = 0.22;
      }
    }
    let any = false;
    for (let i = 0; i < LINE_N; i++) {
      const p = lineP[i];
      if (p.life > 0) { p.life -= dt; any = true; }
      const k = Math.max(0, p.life / 0.22);
      _m.position.set(p.x, p.y, p.z);
      _m.rotation.set(0, p.ry, 0);
      _m.scale.set(k, k, p.len * k);
      _m.updateMatrix();
      lines.setMatrixAt(i, _m.matrix);
    }
    lines.instanceMatrix.needsUpdate = any || linesOn > 0;
    linesOn = any ? 1 : 0;
    lines.visible = any;
  }

  let stage = null;
  let me = makeStumbler(outfitById(outfit));
  scene.add(me);
  const st = Object.assign(newBody(), {
    finished: false, cp: 0, mode: 'idle', lastSend: 0, lastProg: 0, respawn: 0, flash: 0, animT: 0, introK: 0, inWind: 0,
  });
  // Eventos da física: som e partículas
  const ev = {
    sound: (n) => onSound?.(n),
    burst(kind, x, y, z) {
      if (kind === 'spark') burst(x, y, z, 6, SPARK, 4, 0.4);
      else if (kind === 'bounce') burst(x, y, z, 10, SPARK, 5.5, 0.35);
      else if (kind === 'land') burst(x, y, z, 7, DUST, 2.6, 0.55);
      else if (kind === 'door') burst(x, y, z, 8, SPARK, 4, 0.5);
      else burst(x, y, z, 5, DUST, 2, 0.4);
    },
  };

  // ───────────── Nomes dos jogadores: pílulas pequenas em HTML (nítidas e do mesmo tamanho na tela) ─────────────
  const labelLayer = document.createElement('div');
  labelLayer.className = 'stb-labels';
  canvas.parentElement?.insertBefore(labelLayer, canvas.nextSibling);
  const _lv = new THREE.Vector3();
  function makeLabel(name) {
    const el = document.createElement('span');
    el.className = 'stb-name';
    el.textContent = name;
    el.style.opacity = '0';
    labelLayer.appendChild(el);
    return { el, x: -1, y: -1, s: -1, o: -1 };
  }
  /** Posiciona os nomes: encolhem com a distância (sem nunca crescer perto da câmera) e somem no meio da tela. */
  function placeLabels() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    for (const r of remotes.values()) {
      const L = r.label;
      if (!L) continue;
      let o = 0;
      let x = L.x;
      let y = L.y;
      let sc = L.s;
      if (r.mesh.visible && st.mode !== 'intro') {
        const p = r.mesh.position;
        _lv.set(p.x, p.y + LABEL_Y, p.z);
        const d = _lv.distanceTo(camera.position);
        _lv.project(camera);
        if (_lv.z < 1 && Math.abs(_lv.x) < 1.05 && Math.abs(_lv.y) < 1.05) {
          x = Math.round((_lv.x * 0.5 + 0.5) * w);
          y = Math.round((0.5 - _lv.y * 0.5) * h);
          sc = Math.round(Math.max(0.85, Math.min(1, 14 / d)) * 100) / 100; // 11 a 13 px na tela
          // Some perto demais da câmera, vai sumindo longe e fica bem fraquinho no meio da tela
          o = Math.min(1, Math.max(0, (d - 2.2) / 2), Math.max(0, (50 - d) / 20));
          const cx = Math.abs(x - w / 2) / w;
          const cy = Math.abs(y - h * 0.5) / h;
          if (cx < 0.14 && cy < 0.2) o *= 0.3;
          o = Math.round(o * 20) / 20;
        }
      }
      if (o !== L.o) { L.o = o; L.el.style.opacity = String(o); }
      if (o > 0 && (x !== L.x || y !== L.y || sc !== L.s)) {
        L.x = x; L.y = y; L.s = sc;
        L.el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%) scale(${sc})`;
      }
    }
  }
  const remotes = new Map();

  function clearStage() {
    if (!stage) return;
    scene.remove(stage.group);
    stage.dispose?.();
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
        if (p.kind === 'fake' || Math.abs(z - p.z) > (p.r || p.d / 2)) continue;
        const half = p.r ? Math.sqrt(Math.max(0, p.r * p.r - (z - p.z) ** 2)) : p.w / 2;
        const inside = Math.abs(px - p.x) <= half - 0.3;
        const d = inside ? -1 : Math.abs(px - p.x);
        if (!best || d < best.d) best = { p, d, half };
      }
      if (best) {
        const p = best.p;
        px = Math.max(p.x - best.half + 0.5, Math.min(p.x + best.half - 0.5, best.d < 0 ? px : p.x));
        // Porta de verdade na frente: vai para uma porta falsa
        const wall = stage.walls.find((w) => !w.fake && !w.knock && !w.hole && Math.abs(z - w.z) < 0.8 && Math.abs(px - w.x) < w.w / 2 && w.y0 < 1);
        if (wall) {
          const doors = stage.walls.filter((w) => w.fake && Math.abs(z - w.z) < 0.8);
          if (doors.length) px = doors.reduce((a, b) => (Math.abs(b.x - px) < Math.abs(a.x - px) ? b : a)).x;
        }
        const y = p.slope ? p.slope.y0 + (p.slope.y1 - p.slope.y0) * Math.max(0, Math.min(1, (p.slope.z0 - z) / (p.slope.z0 - p.slope.z1))) : p.top;
        path.push({ x: px, z, y, p: p.move ? p : null, bounce: p.kind === 'bounce' });
      } else path.push({ x: null, z, y: null });
    }
    // Buracos: liga as pontas com um pulo
    for (let i = 0; i < path.length; i++) {
      if (path[i].y != null) continue;
      let j = i;
      while (j < path.length && path[j].y == null) j++;
      const a = path[i - 1] || path[j];
      const b = path[j] || a;
      // Saindo de uma mola o pulo é bem mais alto (igual ao do jogador)
      const arc = a.bounce ? 4.6 : 1.8;
      for (let k = i; k < j; k++) {
        const f = (k - i + 1) / (j - i + 1);
        path[k].x = a.x + (b.x - a.x) * f;
        path[k].y = a.y + (b.y - a.y) * f + Math.sin(f * Math.PI) * arc;
        path[k].air = true;
      }
      i = j;
    }
  }
  const pathOut = { x: 0, y: 0, z: 0, air: false };
  function pathAt(k, off) {
    if (!path.length) return null;
    const f = Math.max(0, Math.min(1, k)) * (path.length - 1);
    const i = Math.floor(f);
    const a = path[i];
    const b = path[Math.min(path.length - 1, i + 1)];
    const t = f - i;
    // Em cima de plataforma móvel (ou elevador) o robô anda junto com ela
    const mo = (a.p ? a.p.ox : 0) * (1 - t) + (b.p ? b.p.ox : 0) * t;
    const my = (a.p ? a.p.oy : 0) * (1 - t) + (b.p ? b.p.oy : 0) * t;
    pathOut.x = a.x + (b.x - a.x) * t + off + mo;
    pathOut.y = a.y + (b.y - a.y) * t + my;
    pathOut.z = a.z + (b.z - a.z) * t;
    pathOut.air = a.air || b.air;
    return pathOut;
  }
  let botT = {};
  let botDone = new Set();

  function loadStage(index, seed, slot, count) {
    clearStage();
    stage = buildStage(scene, index, seed);
    if (stage.theme) {
      hemi.color.set('#eaf6ff').lerp(new THREE.Color(stage.theme.skyTop), 0.22);
      hemi.groundColor.set('#c2a98a').lerp(new THREE.Color(stage.theme.water), 0.35);
    }
    buildPath();
    const cols = Math.min(count, 5);
    const row = Math.floor(slot / 5);
    st.x = (slot % 5 - (cols - 1) / 2) * 1.6;
    st.z = -3 - row * 1.8;
    st.y = 0.01;
    st.vx = st.vy = st.vz = 0;
    st.finished = false;
    st.cp = 0;
    st.stun = st.dive = st.recover = st.inv = st.respawn = 0;
    st.yaw = 0;
    me.rotation.y = 0;
    camPos.set(st.x * 0.6, 5.6, st.z + 8.4);
    camLookNow.set(0, 1, st.z - 5);
    return { name: stage.name, length: stage.length };
  }

  /** Ponto seguro para voltar: chão parado e firme logo atrás do último ponto seguro. */
  function safeSpot(cp) {
    for (let dz = 1.5; dz < 40; dz += 0.5) {
      const z = cp + dz;
      for (const p of stage.plats) {
        if (p.move || p.gone || p.r || p.spin || p.tilt || p.tile || p.slope || !(p.kind === 'normal' || p.kind === 'ice')) continue;
        if (Math.abs(z - p.z) > p.d / 2 - 0.4 || p.w < 2) continue;
        const x = Math.max(p.x - p.w / 2 + 0.6, Math.min(p.x + p.w / 2 - 0.6, 0));
        // Longe do alcance das barras giratórias, pêndulos, martelos e bolas
        const risky = stage.hitters.some((h) => (h.type === 'bar' ? Math.hypot(x - h.cx, z - h.cz) < h.L + 0.9 : h.type === 'roll' ? z <= h.z0 + 1 && z >= h.z1 - 1 : Math.abs(z - h.z) < 2.2));
        const windy = stage.winds.some((w) => z <= w.z0 + 0.5 && z >= w.z1 - 0.5);
        if (risky || windy) continue;
        return { x, y: p.top + 2.2, z };
      }
    }
    return { x: 0, y: 2.5, z: cp + 1.5 };
  }

  /** Direção da câmera no chão: o joystick e as setas andam em relação a ela. */
  const fwd = { x: 0, z: -1 };
  function camAxes() {
    const fx = camLookNow.x - camera.position.x;
    const fz = camLookNow.z - camera.position.z;
    const l = Math.hypot(fx, fz);
    if (l > 0.5) { fwd.x = fx / l; fwd.z = fz / l; }
    return fwd;
  }

  function physics(dt, t) {
    const n = Math.max(1, Math.ceil(dt / STEP - 1e-6));
    const h = dt / n;
    const fw = camAxes();
    for (let i = 0; i < n; i++) {
      if (st.respawn) break;
      stepBody(st, stage, h, t, 1 / n, fw, ev);
    }
    // Entrou no vento: um "fuuu" (no máximo a cada 1,5 s)
    if (st.wind > 0.5) { if (!st.inWind) onSound?.('stbWind'); st.inWind = 1.5; } else st.inWind = Math.max(0, st.inWind - dt);
    // Pontos seguros
    for (const c of stage.checkpoints) {
      if (!(st.z < c - 0.5 && c < st.cp)) continue;
      st.cp = c;
      onSound?.('stbCheckpoint');
      burst(st.x, st.y + 1.2, st.z, 8, SPARK, 3.5, 0.35);
    }
    // Caiu na água: volta no último ponto seguro
    if (st.y < -6 && !st.respawn) { st.respawn = 0.8; onSound?.('stbFall'); burst(st.x, -11.5, st.z, 10, SPLASH, 6, 1.2); }
    if (st.respawn) {
      st.respawn -= dt;
      if (st.respawn <= 0) {
        st.respawn = 0;
        const sp = safeSpot(st.cp);
        st.x = sp.x; st.y = sp.y; st.z = sp.z;
        st.vx = st.vy = st.vz = 0;
        st.stun = 0.2;
        st.inv = 1.2;
        st.dive = st.recover = st.launch = st.wvx = st.wvz = 0;
        st.yaw = 0;
        st.flash = 1;
        camPos.set(st.x * 0.6, st.y + 5.6, st.z + 8.4);
      }
    }
    // Chegada
    if (!st.finished && st.z < stage.finishZ && st.y > -1) {
      st.finished = true;
      onSound?.('stbQualify');
      burst(st.x, st.y + 1.5, st.z, 16, SPARK, 7, 0.5);
      confetti(st.x, st.y + 2, st.z);
      onFinish?.();
    }
    // Vira suave para onde está andando
    const sp = Math.hypot(st.vx, st.vz);
    if (sp > 0.6 && st.stun <= 0 && st.recover <= 0) st.yaw += angDiff(st.yaw, Math.atan2(-st.vx, -st.vz)) * Math.min(1, dt * 14);
  }

  /** Robôs: o vento empurra de lado e os obstáculos dão um tranco (eles se recuperam sozinhos). */
  function botForces(r, q, t, dt) {
    let wx = 0;
    for (const w of stage.winds) if (w.k && q.z <= w.z0 && q.z >= w.z1 && q.y < w.top) wx += w.fx * w.k;
    r.kvx = (r.kvx || 0) * Math.max(0, 1 - dt * 4);
    r.kvz = (r.kvz || 0) * Math.max(0, 1 - dt * 4);
    if (!r.kt) {
      for (const hh of stage.hitters) {
        if (hitTest(q.x + (r.kx || 0), q.y, q.z + (r.kz || 0), hh) == null) continue;
        const dx = q.x + (r.kx || 0) - (hh.type === 'bar' ? hh.cx : hh.x);
        r.kvx = Math.sign(dx || 1) * 5 + (hh.vx || 0) * 0.3;
        r.kvz = 2.5;
        r.kt = 0.7;
        if (hh.type === 'bumper') hh.hitAt = t;
        break;
      }
    }
    r.kx = (r.kx || 0) + (wx * 0.45 + r.kvx) * dt;
    r.kz = (r.kz || 0) + r.kvz * dt;
    // Volta para o caminho aos poucos (e nunca sai da pista)
    r.kx *= Math.max(0, 1 - dt * (wx ? 0.6 : 1.6));
    r.kz *= Math.max(0, 1 - dt * 1.6);
    r.kx = Math.max(-2.4, Math.min(2.4, r.kx));
    r.kz = Math.max(-1.5, Math.min(2.5, r.kz));
  }

  // ───────────── Laço ─────────────
  let raf = 0;
  let last = 0;
  let frameN = 0;
  function render() {
    // Sombra a cada 2 quadros: quase não se nota e economiza muito no celular
    renderer.shadowMap.needsUpdate = (frameN++ & 1) === 0;
    renderer.render(scene, camera);
  }
  function frame(now) {
    raf = window.requestAnimationFrame(frame);
    const dt = Math.min(0.06, (now - (last || now)) / 1000);
    last = now;
    st.animT += dt;
    if (st.hidden || document.hidden) return; // roleta cobrindo a tela ou aba escondida: não desenha nada
    if (!stage) { render(); return; }
    const t = getTime();
    // Obstáculos e plataformas móveis (mesmo tempo para todos)
    updateStage(stage, t, dt);
    stepPuffs(dt);
    const racing = st.mode === 'race' && t >= 0;
    if (racing) physics(dt, t);
    stepConfetti(dt);
    const fast = racing && !st.respawn && (st.dive > 0 || st.vy < -15 || Math.hypot(st.vx, st.vz) > 10.5);
    stepLines(dt, fast);
    // Câmera abre um pouco quando está rápido (mergulho, queda, cama elástica) e volta suave
    const fov = fast || st.vy > 14 ? 66 : 60;
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 5); camera.updateProjectionMatrix(); }
    // Meu boneco
    me.position.set(st.x, st.y, st.z);
    me.rotation.y += angDiff(me.rotation.y, st.yaw) * Math.min(1, dt * 16);
    const moving = Math.hypot(st.vx, st.vz) > 1;
    const anim = st.dive > 0 || st.recover > 0 ? 'dive' : st.stun > 0 ? 'stun' : !st.grounded && racing ? 'air' : moving ? 'run' : st.finished ? 'wave' : 'idle';
    animate(me, st.animT, anim);
    // Pisca de leve logo depois de voltar da água (sem levar pancada nesse tempo)
    me.visible = st.mode !== 'spectate' && !(st.inv > 0.3 && st.stun <= 0 && st.flash <= 0 && Math.floor(now / 90) % 2);
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
      const mov = !done && k < 0.985;
      const tg = r.target || (r.target = { x: q.x, y: q.y, z: q.z, r: 0, a: 'idle' });
      const dxp = q.x - tg.x;
      const dzp = q.z - tg.z;
      if (Math.hypot(dxp, dzp) > 0.02) tg.r = Math.atan2(-dxp, -dzp);
      // O vento e as pancadas também mexem nos robôs (desviam um pouco e voltam para o caminho)
      if (mov) botForces(r, q, t, dt);
      r.kt = Math.max(0, (r.kt || 0) - dt);
      tg.x = q.x + (r.kx || 0); tg.y = q.y; tg.z = (done ? q.z - 1.5 : q.z) + (r.kz || 0);
      tg.a = r.kt > 0 && mov ? 'stun' : q.air && mov ? 'air' : mov ? 'run' : done ? 'wave' : 'idle';
    }
    // Os outros: robôs seguem o alvo; pessoas são interpoladas entre as posições recebidas
    const rt = window.performance.now() - REMOTE_DELAY;
    for (const r of remotes.values()) {
      if (!r.bot && r.buf.length) {
        const b = r.buf;
        while (b.length > 2 && b[1].t <= rt) b.shift();
        let x; let y; let z; let rot;
        if (b.length >= 2 && rt >= b[0].t && rt <= b[1].t) {
          const f = (rt - b[0].t) / Math.max(1, b[1].t - b[0].t);
          x = b[0].x + (b[1].x - b[0].x) * f;
          y = b[0].y + (b[1].y - b[0].y) * f;
          z = b[0].z + (b[1].z - b[0].z) * f;
          rot = b[0].r + angDiff(b[0].r, b[1].r) * f;
        } else {
          // Sem pacote novo: continua um pouquinho na mesma direção (no máximo 150 ms)
          const lb = b[b.length - 1];
          const pb = b.length >= 2 ? b[b.length - 2] : lb;
          const ext = rt > lb.t ? Math.min(150, rt - lb.t) / Math.max(1, lb.t - pb.t) : 0;
          x = lb.x + (lb.x - pb.x) * ext;
          y = lb.y + (lb.y - pb.y) * ext;
          z = lb.z + (lb.z - pb.z) * ext;
          rot = lb.r;
        }
        // Pulo grande (voltou da água): vai direto
        const jump = Math.hypot(x - r.mesh.position.x, z - r.mesh.position.z) > 6;
        const k = jump ? 1 : Math.min(1, dt * 20);
        r.mesh.position.x += (x - r.mesh.position.x) * k;
        r.mesh.position.y += (y - r.mesh.position.y) * k;
        r.mesh.position.z += (z - r.mesh.position.z) * k;
        r.mesh.rotation.y += angDiff(r.mesh.rotation.y, rot) * Math.min(1, dt * 16);
        animate(r.mesh, st.animT + r.phase, b[b.length - 1].a);
        continue;
      }
      if (!r.target) continue;
      const k = Math.min(1, dt * 14);
      r.mesh.position.x += (r.target.x - r.mesh.position.x) * k;
      r.mesh.position.y += (r.target.y - r.mesh.position.y) * k;
      r.mesh.position.z += (r.target.z - r.mesh.position.z) * k;
      r.mesh.rotation.y += angDiff(r.mesh.rotation.y, r.target.r) * Math.min(1, dt * 10);
      animate(r.mesh, st.animT + r.phase, r.target.a);
    }
    // Câmera
    if (st.mode === 'intro') {
      const k = st.introK;
      // Passeio pela pista: da chegada até a largada, sempre olhando para a frente
      const z = THREE.MathUtils.lerp(stage.finishZ + 18, 9, k);
      camera.position.set(Math.sin(k * 3) * 4, 13 - k * 6, z);
      camLookNow.set(0, 0, z - 16);
      camera.lookAt(camLookNow);
      camPos.copy(camera.position);
    } else if (st.mode === 'spectate') {
      let lead = null;
      for (const r of remotes.values()) if (r.alive && (!lead || r.mesh.position.z < lead.mesh.position.z)) lead = r;
      const fz = lead ? lead.mesh.position.z : st.z;
      const fx = lead ? lead.mesh.position.x : 0;
      const fy = lead ? lead.mesh.position.y : 0;
      camPos.lerp(camLook.set(fx * 0.5, Math.max(fy, -2) + 7, fz + 10), Math.min(1, dt * 3));
      camera.position.copy(camPos);
      camLookNow.lerp(camLook.set(fx, Math.max(fy, -2) + 1, fz - 4), Math.min(1, dt * 5));
      camera.lookAt(camLookNow);
    } else {
      // Atrás e acima do jogador; a altura acompanha mais devagar para o pulo não sacudir a tela
      const gy = Math.max(st.y, -2);
      const kxz = Math.min(1, dt * 9);
      const ky = Math.min(1, dt * (st.grounded ? 6 : 2.5));
      camPos.x += (st.x * 0.6 - camPos.x) * kxz;
      camPos.z += (st.z + 8.4 - camPos.z) * kxz;
      camPos.y += (gy + 5.6 - camPos.y) * ky;
      camera.position.copy(camPos);
      // Olha um pouquinho para onde está indo (a câmera fica mais viva sem sacudir)
      camLookNow.lerp(camLook.set(st.x * 0.8 + st.vx * 0.12, gy + 1.2, st.z - 5 + Math.min(0, st.vz) * 0.12), Math.min(1, dt * 7));
      camera.lookAt(camLookNow);
    }
    // Clarão ao voltar da água
    if (st.flash > 0) {
      st.flash = Math.max(0, st.flash - dt * 2.2);
      flash.material.opacity = st.flash * 0.85;
    }
    flash.visible = st.flash > 0;
    sun.position.set(camera.position.x - 8, 22, camera.position.z - 4);
    sun.target.position.set(camera.position.x, 0, camera.position.z - 14);
    render();
    placeLabels();
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
  // Aba escondida: para o laço de vez (e volta sem dar um "pulo" no tempo)
  const onVis = () => {
    window.cancelAnimationFrame(raf);
    last = 0;
    if (!document.hidden) raf = window.requestAnimationFrame(frame);
  };
  document.addEventListener('visibilitychange', onVis);
  raf = window.requestAnimationFrame(frame);

  return {
    loadStage,
    setMode(m) { st.mode = m; },
    setIntro(k) { st.introK = k; },
    setHidden(v) { st.hidden = !!v; },
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
      for (const [id, r] of remotes) if (!ids.has(id)) { scene.remove(r.mesh); r.label?.el.remove(); remotes.delete(id); }
      for (const p of list) {
        if (p.id === meId) continue;
        let r = remotes.get(p.id);
        if (!r || r.outfit !== p.outfit) {
          if (r) { scene.remove(r.mesh); r.label?.el.remove(); }
          const mesh = makeStumbler(outfitById(p.outfit));
          scene.add(mesh);
          r = { mesh, outfit: p.outfit, target: null, buf: [], phase: Math.random() * 3, alive: true, bot: !!p.bot, off: (Math.random() - 0.5) * 1.2, label: makeLabel(p.name) };
          remotes.set(p.id, r);
        }
        if (r.label.el.textContent !== p.name) r.label.el.textContent = p.name;
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
      r.buf = [];
      r.kx = r.kz = r.kvx = r.kvz = r.kt = 0;
      r.mesh.position.set(x, 0, z);
      r.mesh.rotation.y = 0;
    },
    remotePos(id, d) {
      const r = remotes.get(id);
      if (!r || !d || !Number.isFinite(d.x)) return;
      const a = ['run', 'idle', 'air', 'dive', 'stun', 'wave'].includes(d.a) ? d.a : 'idle';
      r.buf.push({ t: window.performance.now(), x: d.x, y: d.y, z: d.z, r: d.r || 0, a });
      if (r.buf.length > 8) r.buf.shift();
    },
    input: {
      move(x, z) { st.mx = x; st.mz = z; },
      jump() { if (st.mode === 'race') st.jumpBuf = JUMP_BUF; },
      dive() {
        if (st.mode !== 'race' || st.dive > 0 || st.recover > 0 || st.stun > 0 || st.respawn) return;
        // Mergulho: impulso para a frente (para onde está virado) e uma subidinha
        const l = Math.hypot(st.vx, st.vz);
        const fx = l > 1 ? st.vx / l : -Math.sin(st.yaw);
        const fz = l > 1 ? st.vz / l : -Math.cos(st.yaw);
        st.vx = fx * DIVE_V; st.vz = fz * DIVE_V;
        st.vy = st.grounded ? 5 : Math.max(st.vy, 2.5);
        st.grounded = false;
        st.coyote = 0;
        st.launch = 0;
        st.dive = 0.5;
        onSound?.('stbDive');
        burst(st.x, st.y + 0.2, st.z, 5, DUST, 2.2, 0.45);
      },
    },
    get finished() { return st.finished; },
    debug: () => ({ ...st, ground: st.ground ? st.ground.kind : null, t: getTime(), path: path.length, stageLen: stage?.length, finishZ: stage?.finishZ, winds: stage?.winds.map((w) => ({ z0: w.z0, z1: w.z1, k: w.k, fx: w.fx })), springs: stage?.plats.filter((p) => p.kind === 'bounce').map((p) => ({ x: p.x, z: p.z, top: p.top })), bots: [...remotes].map(([id, r]) => ({ id, bot: r.bot, alive: r.alive, vis: r.mesh.visible, t: r.target, pos: r.mesh.position.toArray() })) }),
    /** Só para testes: números do desenho (chamadas e triângulos) e acesso ao renderizador. */
    debugRender: () => ({ ...renderer.info.render, renderer, scene }),
    /** Só para testes: coloca o jogador num ponto da pista. */
    debugSet(o) { Object.assign(st, o); },
    dispose() {
      window.cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      labelLayer.remove();
      clearStage();
      for (const p of puffs) p.s.material.dispose();
      confGeo.dispose(); confMat.dispose(); conf.dispose();
      lineGeo.dispose(); lineMat.dispose(); lines.dispose();
      puffTex.dispose();
      flash.geometry.dispose();
      flash.material.dispose();
      renderer.dispose();
    },
  };
}
