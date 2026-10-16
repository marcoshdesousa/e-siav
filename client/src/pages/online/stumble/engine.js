// Stumble DBV: mundo 3D, física do jogador e os outros jogadores em tempo real.
// A física roda em passos pequenos (120 por segundo) para ninguém atravessar o chão quando o
// celular engasga. Os obstáculos se movem pelo tempo da corrida (igual em todos os celulares).
import * as THREE from 'three';
import { animate, makeStumbler } from './character.js';
import { buildStage } from './stages.js';
import { outfitById } from './outfits.js';
import { studioEnv } from '../avatar/build.js';

const SPEED = 7.4; // velocidade correndo (m/s)
const GRAV = 34;
const JUMP = 12; // pulo de ~2,1 m
const BOUNCE = 17.5; // cama elástica
const R = 0.45; // raio do boneco
const H = 1.8; // altura do boneco
const STEP = 1 / 120; // passo da física
const ACC_GROUND = 48; // aceleração no chão (m/s²)
const ACC_STOP = 60; // freada no chão
const ACC_AIR = 15; // controle no ar
const ACC_ICE = 6; // gelo: escorrega
const COYOTE = 0.12; // ainda dá para pular logo depois de sair da borda
const JUMP_BUF = 0.15; // apertou pular um pouquinho antes de cair no chão: pula assim que encostar
const DIVE_V = 11.5;
const REMOTE_DELAY = 110; // ms de atraso para interpolar os outros jogadores sem tremer

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

/** Diferença entre ângulos pelo caminho mais curto. */
const angDiff = (a, b) => ((((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;

export function createStumble(canvas, { outfit, getTime, onFinish, onProgress, sendPos, onSound }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: window.devicePixelRatio < 2, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  // Reflexo de estúdio suave: deixa o plástico das peças e dos bonecos brilhante
  scene.environment = studioEnv(renderer);
  scene.environmentIntensity = 0.5;
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 420);
  // Luz do céu (pega a cor do céu e da água de cada fase) + sol com a única sombra da cena
  const hemi = new THREE.HemisphereLight('#eaf6ff', '#c2a98a', 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff1dc', 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.radius = 3;
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
  const st = {
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, grounded: false, stun: 0, dive: 0, recover: 0, inv: 0, coyote: 0, jumpBuf: 0,
    finished: false, cp: 0, yaw: 0, mode: 'idle', mx: 0, mz: 0, lastSend: 0, lastProg: 0, respawn: 0, flash: 0,
    animT: 0, introK: 0, ground: null,
  };
  const remotes = new Map();

  function clearStage() {
    if (!stage) return;
    scene.remove(stage.group);
    stage.dispose?.();
    stage = null;
  }

  // ───────────── Colisão ─────────────
  /** Altura do chão da plataforma no ponto (x, z), ou null se o ponto está fora dela. */
  function platTop(p, x, z) {
    if (p.gone) return null;
    const px = p.x + p.ox;
    const pz = p.z + p.oz;
    if (p.r) return Math.hypot(x - px, z - pz) > p.r + 0.1 ? null : p.top + p.oy;
    if (Math.abs(x - px) > p.w / 2 + 0.15 || Math.abs(z - pz) > p.d / 2 + 0.15) return null;
    if (p.slope) {
      const { z0, z1, y0, y1 } = p.slope;
      const k = Math.max(0, Math.min(1, (z0 - z) / (z0 - z1)));
      return y0 + (y1 - y0) * k;
    }
    if (p.tiltA) return p.top + p.oy + Math.tan(p.tiltA) * (x - px);
    return p.top + p.oy;
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
        path.push({ x: px, z, y: platTop({ ...p, ox: 0, oy: 0, oz: 0, tiltA: 0, gone: false }, px, z) ?? p.top, p: p.move ? p : null });
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
        if (risky) continue;
        return { x, y: p.top + 2.2, z };
      }
    }
    return { x: 0, y: 2.5, z: cp + 1.5 };
  }

  function knock(dx, dz, power, up = 5) {
    const l = Math.hypot(dx, dz) || 1;
    st.vx = (dx / l) * power;
    st.vz = (dz / l) * power;
    st.vy = Math.max(st.vy, up);
    st.stun = 0.75; // cambaleia um pouco e logo volta ao controle
    st.inv = 1.0; // e fica um instante sem levar outra pancada
    st.dive = st.recover = 0;
    st.grounded = false;
    st.coyote = 0;
    onSound?.('stbBump');
    burst(st.x, st.y + 1, st.z, 6, SPARK, 4, 0.4);
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

  /** Um passo da física (h segundos). frac = parte do movimento das plataformas que cabe neste passo. */
  function physicsStep(h, t, frac, fw) {
    const g = st.ground;
    // Controle: aceleração em linha reta até a velocidade desejada (resposta rápida, como no Stumble Guys)
    const ctl = st.stun <= 0 && st.dive <= 0 && st.recover <= 0;
    const ix = st.mx;
    const iz = st.mz;
    const want = Math.hypot(ix, iz) > 0.15;
    // Joystick relativo à câmera: para cima (iz < 0) = para onde a câmera olha; direita = lado direito dela
    const wx = -fw.z * ix - fw.x * iz;
    const wz = fw.x * ix - fw.z * iz;
    if (ctl) {
      const tx = want ? wx * SPEED : 0;
      const tz = want ? wz * SPEED : 0;
      const ice = st.grounded && g?.kind === 'ice';
      const acc = !st.grounded ? ACC_AIR : ice ? ACC_ICE : want ? ACC_GROUND : ACC_STOP;
      const dvx = tx - st.vx;
      const dvz = tz - st.vz;
      const dl = Math.hypot(dvx, dvz);
      const m = acc * h;
      if (dl <= m) { st.vx = tx; st.vz = tz; } else { st.vx += (dvx / dl) * m; st.vz += (dvz / dl) * m; }
    } else if (st.grounded) {
      // Tonto ou deslizando do mergulho: atrito no chão
      const f = 1 - Math.min(1, h * (st.recover > 0 ? 5 : 3.2));
      st.vx *= f;
      st.vz *= f;
    }
    st.stun = Math.max(0, st.stun - h);
    st.inv = Math.max(0, st.inv - h);
    st.recover = Math.max(0, st.recover - h);
    st.coyote = st.grounded ? COYOTE : Math.max(0, st.coyote - h);
    st.jumpBuf = Math.max(0, st.jumpBuf - h);
    // O mergulho dura até encostar no chão
    if (st.dive > 0) st.dive = Math.max(0.001, st.dive - h);
    // Pulo (com tolerância de borda e de aperto antecipado)
    if (st.jumpBuf > 0 && st.coyote > 0 && ctl) {
      st.vy = JUMP;
      st.grounded = false;
      st.coyote = 0;
      st.jumpBuf = 0;
      onSound?.('stbJump');
      burst(st.x, st.y + 0.1, st.z, 5, DUST, 2, 0.4);
    }
    // Vento dos ventiladores
    if (stage.winds) {
      for (const w of stage.winds) {
        if (!w.k || st.x < w.x0 || st.x > w.x1 || st.z > w.z0 || st.z < w.z1 || st.y > 5) continue;
        st.vx += w.fx * w.k * h;
      }
    }
    st.vy -= GRAV * h;
    if (st.vy < -40) st.vy = -40;
    // Plataforma embaixo leva o jogador junto (móveis, giratórias, esteiras, troncos e gangorras)
    if (st.grounded && g && !g.gone) {
      st.x += g.dx * frac;
      st.z += g.dz * frac;
      if (g.dA) {
        const a = g.dA * frac;
        const cx = g.x + g.ox;
        const cz = g.z + g.oz;
        const ox = st.x - cx;
        const oz = st.z - cz;
        const c = Math.cos(a);
        const s = Math.sin(a);
        st.x = cx + ox * c + oz * s;
        st.z = cz - ox * s + oz * c;
        st.yaw += a;
      }
      if (g.conv) st.z += g.conv * h;
      if (g.convX) st.x += g.convX * h;
      if (g.tiltA) st.vx -= Math.sin(g.tiltA) * GRAV * 0.45 * h; // escorrega na gangorra
    }
    st.x += st.vx * h;
    st.y += st.vy * h;
    st.z += st.vz * h;
    // Chão
    const wasGrounded = st.grounded;
    st.grounded = false;
    let ground = null;
    let gtop = -Infinity;
    for (const p of stage.plats) {
      const top = platTop(p, st.x, st.z);
      if (top == null || top > st.y + 0.45) continue;
      if (top > gtop) { gtop = top; ground = p; }
    }
    if (ground && st.y <= gtop + 0.02 && st.vy <= 0.5 && gtop - st.y < 0.9) {
      const impact = st.vy;
      st.y = gtop;
      if (ground.kind === 'bounce') {
        st.vy = BOUNCE;
        st.dive = 0;
        onSound?.('stbBounce');
        burst(st.x, st.y + 0.2, st.z, 10, SPARK, 5.5, 0.35);
        ground.squash = 1;
      } else {
        if (!wasGrounded && impact < -9) { burst(st.x, st.y + 0.1, st.z, 7, DUST, 2.6, 0.55); onSound?.('stbLand'); }
        if (st.dive > 0) { st.dive = 0; st.recover = 0.32; } // caiu de barriga: escorrega e levanta
        st.vy = 0;
        st.grounded = true;
      }
      if ((ground.kind === 'fake' || ground.kind === 'crumble') && ground.fallAt == null) ground.fallAt = t;
    }
    st.ground = st.grounded ? ground : null;
    // Paredes (empurra para fora pelo lado mais perto)
    for (const w of stage.walls) {
      if (w.gone) continue;
      if (st.y > w.y0 + w.h || st.y + H < w.y0) continue;
      const wx = w.x + (w.ox || 0);
      const wz = w.z + (w.oz || 0);
      const cx = Math.max(wx - w.w / 2, Math.min(st.x, wx + w.w / 2));
      const cz = Math.max(wz - w.d / 2, Math.min(st.z, wz + w.d / 2));
      let dx = st.x - cx;
      let dz = st.z - cz;
      let d = Math.hypot(dx, dz);
      if (d >= R) continue;
      if (w.fake) { w.gone = true; w.mesh.visible = false; onSound?.('stbDoor'); burst(wx, 1.3, wz, 8, SPARK, 4, 0.5); continue; }
      let px = cx;
      let pz = cz;
      if (d < 1e-4) {
        // Centro dentro da parede: sai pelo lado mais perto
        const ex = w.w / 2 - Math.abs(st.x - wx);
        const ez = w.d / 2 - Math.abs(st.z - wz);
        if (ex < ez) { dx = Math.sign(st.x - wx) || 1; dz = 0; px = wx + dx * (w.w / 2); pz = st.z; } else { dz = Math.sign(st.z - wz) || 1; dx = 0; pz = wz + dz * (w.d / 2); px = st.x; }
        d = 1;
      }
      const nx = dx / d;
      const nz = dz / d;
      st.x = px + nx * R;
      st.z = pz + nz * R;
      if (w.knock && st.inv <= 0) knock(nx + (w.vx || 0) * 0.15, nz, w.knock + Math.abs(w.vx || 0) * 0.5, 4);
      else {
        const vn = st.vx * nx + st.vz * nz;
        if (vn < 0) { st.vx -= vn * nx; st.vz -= vn * nz; }
      }
    }
    // Obstáculos que derrubam
    if (st.stun <= 0 && st.inv <= 0) {
      for (const hh of stage.hitters) {
        if (hh.type === 'bar') {
          const ux = Math.cos(hh.ang);
          const uz = -Math.sin(hh.ang);
          const rx2 = st.x - hh.cx;
          const rz2 = st.z - hh.cz;
          const along = Math.max(-hh.L, Math.min(hh.L, rx2 * ux + rz2 * uz));
          const px = hh.cx + ux * along;
          const pz = hh.cz + uz * along;
          const d = Math.hypot(st.x - px, st.z - pz);
          if (d < 0.25 + R && st.y < hh.y + 0.25 && st.y + H > hh.y - 0.25) {
            // Empurra no sentido em que a barra gira
            const tx = -Math.sin(hh.ang) * along * hh.w;
            const tz = -Math.cos(hh.ang) * along * hh.w;
            knock(tx || (st.x - px), tz || (st.z - pz), 9 + Math.abs(along * hh.w) * 0.4, 6);
            break;
          }
        } else if (hh.type === 'ball' || hh.type === 'roll') {
          if (hh.off) continue;
          const dx = st.x - hh.x;
          const dz = st.z - hh.z;
          const dy = st.y + 0.9 - hh.y;
          if (Math.hypot(dx, dy, dz) < hh.r + 0.55) { knock(dx + (hh.vx || 0) * 0.1, dz + (hh.vz || 0) * 0.12, 11 + Math.hypot(hh.vx || 0, hh.vz || 0) * 0.4, 6); break; }
        } else if (hh.type === 'bumper') {
          const dx = st.x - hh.x;
          const dz = st.z - hh.z;
          if (st.y < 1.3 + (hh.y || 0) && st.y > (hh.y || 0) - 1 && Math.hypot(dx, dz) < hh.r + R) { knock(dx, dz, 12, 4); hh.hitAt = t; break; }
        }
      }
    }
  }

  function physics(dt, t) {
    const n = Math.max(1, Math.ceil(dt / STEP - 1e-6));
    const h = dt / n;
    const fw = camAxes();
    for (let i = 0; i < n; i++) {
      if (st.respawn) break;
      physicsStep(h, t, 1 / n, fw);
    }
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
        st.dive = st.recover = 0;
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

  // ───────────── Laço ─────────────
  let raf = 0;
  let last = 0;
  function frame(now) {
    raf = window.requestAnimationFrame(frame);
    const dt = Math.min(0.06, (now - (last || now)) / 1000);
    last = now;
    st.animT += dt;
    if (st.hidden) return; // roleta cobrindo a tela: não desenha o 3D (economiza bateria no celular)
    if (!stage) { renderer.render(scene, camera); return; }
    const t = getTime();
    // Obstáculos e plataformas móveis (mesmo tempo para todos)
    for (const u of stage.updaters) u(t, dt);
    for (const p of stage.plats) {
      if (p.move) {
        const o = p.move(t);
        p.dx = o.x - p.ox; p.dy = o.y - p.oy; p.dz = o.z - p.oz;
        p.ox = o.x; p.oy = o.y; p.oz = o.z;
        if (Math.abs(p.dx) > 2 || Math.abs(p.dz) > 2) p.dx = p.dz = 0; // tempo pulou (nova fase): não arrasta
        p.mesh.position.set(p.x + p.ox, p.baseY + p.oy, p.z + p.oz);
      } else { p.dx = 0; p.dy = 0; p.dz = 0; }
      if (p.spin) {
        const a = t * p.spin;
        p.dA = p.ang == null || Math.abs(a - p.ang) > 1 ? 0 : a - p.ang;
        p.ang = a;
        p.mesh.rotation.y = a;
      }
      if (p.tilt) { p.tiltA = p.tilt(t); p.mesh.rotation.z = p.tiltA; }
      if (p.squash) { p.squash = Math.max(0, p.squash - dt * 4); p.mesh.scale.set(1 + p.squash * 0.08, 1 - p.squash * 0.3, 1 + p.squash * 0.08); }
      if (p.fallAt != null) {
        if (p.fallAt > t + 1) p.fallAt = null; // nova corrida
        else if (p.kind === 'crumble') {
          // Favo: treme, cai e volta depois de um tempo
          const e = t - p.fallAt;
          if (!p.gone && e > 0.6) p.gone = true;
          else if (!p.gone) p.mesh.position.x = p.x + Math.sin(e * 70) * 0.06;
          if (p.gone && e > 4) { p.gone = false; p.fallAt = null; p.mesh.position.set(p.x, p.baseY, p.z); }
        } else if (!p.gone && t - p.fallAt > 0.25) p.gone = true;
      }
      if (p.gone && p.mesh.position.y > -20) p.mesh.position.y -= dt * 12;
    }
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
      tg.x = q.x; tg.y = q.y; tg.z = done ? q.z - 1.5 : q.z;
      tg.a = q.air && mov ? 'air' : mov ? 'run' : done ? 'wave' : 'idle';
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
      for (const [id, r] of remotes) if (!ids.has(id)) { scene.remove(r.mesh); remotes.delete(id); }
      for (const p of list) {
        if (p.id === meId) continue;
        let r = remotes.get(p.id);
        if (!r || r.outfit !== p.outfit) {
          if (r) scene.remove(r.mesh);
          const mesh = makeStumbler(outfitById(p.outfit));
          mesh.add(nameSprite(p.name));
          scene.add(mesh);
          r = { mesh, outfit: p.outfit, target: null, buf: [], phase: Math.random() * 3, alive: true, bot: !!p.bot, off: (Math.random() - 0.5) * 1.2 };
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
      r.buf = [];
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
        st.dive = 0.5;
        onSound?.('stbDive');
        burst(st.x, st.y + 0.2, st.z, 5, DUST, 2.2, 0.45);
      },
    },
    get finished() { return st.finished; },
    debug: () => ({ ...st, ground: st.ground ? st.ground.kind : null, t: getTime(), path: path.length, stageLen: stage?.length, finishZ: stage?.finishZ, bots: [...remotes].map(([id, r]) => ({ id, bot: r.bot, alive: r.alive, vis: r.mesh.visible, t: r.target, pos: r.mesh.position.toArray() })) }),
    /** Só para testes: coloca o jogador num ponto da pista. */
    debugSet(o) { Object.assign(st, o); },
    dispose() {
      window.cancelAnimationFrame(raf);
      ro.disconnect();
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
