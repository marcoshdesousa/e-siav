// Surf DBV: poderes (ímã, estrela x2, foguete e pula-pula), os objetos que aparecem no personagem
// enquanto o poder dura (foguete nas costas, pula-pula nos pés) e as partículas brilhantes.
import * as THREE from 'three';

export const POWERS = {
  ima: { name: 'Ímã', time: 10, color: '#ef4444' },
  estrela: { name: 'Moedas x2', time: 12, color: '#facc15' },
  foguete: { name: 'Foguete', time: 7, color: '#38bdf8' },
  pulapula: { name: 'Pula-pula', time: 10, color: '#22c55e' },
};
export const POWER_TYPES = Object.keys(POWERS);

const M = new Map();
const mat = (color, o = {}) => {
  const k = color + JSON.stringify(o);
  if (!M.has(k)) M.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.1, ...o }));
  return M.get(k);
};

// ───────────── Brilho (textura redonda suave) ─────────────
let GLOW = null;
export function glowTexture() {
  if (GLOW) return GLOW;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  GLOW = new THREE.CanvasTexture(c);
  return GLOW;
}
let STAR = null;
function starTexture() {
  if (STAR) return STAR;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.beginPath();
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; const rr = k % 2 ? 7 : 30; g.lineTo(32 + Math.cos(a) * rr, 32 + Math.sin(a) * rr); }
  g.closePath(); g.fill();
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 16);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  STAR = new THREE.CanvasTexture(c);
  return STAR;
}

/** Partículas com brilho (sprites que somam luz), reaproveitadas para não pesar. */
export function createParticles(scene, max = 260) {
  const pool = [];
  const live = [];
  const make = () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.visible = false;
    scene.add(s);
    return s;
  };
  for (let i = 0; i < max; i++) pool.push(make());
  return {
    /** n partículas saindo de (x,y,z). o: { colors, speed, life, size, grav, star, up } */
    burst(x, y, z, n, o = {}) {
      const { colors = ['#ffffff'], speed = 4, life = 0.6, size = 0.35, grav = 6, star = false, up = 0.6, spread = 1 } = o;
      for (let i = 0; i < n && pool.length; i++) {
        const s = pool.pop();
        s.visible = true;
        s.material.map = star ? starTexture() : glowTexture();
        s.material.color.set(colors[i % colors.length]);
        s.material.opacity = 1;
        s.position.set(x + (Math.random() - 0.5) * 0.2 * spread, y, z + (Math.random() - 0.5) * 0.2 * spread);
        const sz = size * (0.6 + Math.random() * 0.8);
        s.scale.set(sz, sz, 1);
        live.push({ s, vx: (Math.random() - 0.5) * 2 * speed * spread, vy: (up + Math.random()) * speed, vz: (Math.random() - 0.5) * 2 * speed * spread, life, max: life, grav, sz, spin: (Math.random() - 0.5) * 6 });
      }
    },
    update(dt) {
      for (let i = live.length - 1; i >= 0; i--) {
        const p = live[i];
        p.life -= dt;
        p.vy -= p.grav * dt;
        p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
        const k = Math.max(0, p.life / p.max);
        p.s.material.opacity = k;
        p.s.material.rotation += p.spin * dt;
        const sc = p.sz * (0.4 + k * 0.6);
        p.s.scale.set(sc, sc, 1);
        if (p.life <= 0) { p.s.visible = false; pool.push(p.s); live.splice(i, 1); }
      }
    },
  };
}

// ───────────── Ícones dos poderes (dentro de uma bolha brilhante) ─────────────
function magnet() {
  const g = new THREE.Group();
  const u = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.11, 14, 28, Math.PI), mat('#ef4444'));
  u.rotation.z = Math.PI;
  g.add(u);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.18, 16), mat('#ef4444'));
    leg.position.set(s * 0.28, 0.09, 0);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.14, 16), mat('#e5e7eb', { metalness: 0.7, roughness: 0.2 }));
    tip.position.set(s * 0.28, 0.25, 0);
    g.add(leg, tip);
  }
  g.position.y = -0.05;
  return g;
}
function star() {
  const sh = new THREE.Shape();
  for (let k = 0; k < 10; k++) {
    const a = Math.PI / 2 + (k / 10) * Math.PI * 2;
    const r = k % 2 ? 0.17 : 0.4;
    if (k === 0) sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); else sh.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 3 });
  geo.center();
  const m = new THREE.Mesh(geo, mat('#facc15', { metalness: 0.5, roughness: 0.25, emissive: '#b45309', emissiveIntensity: 0.4 }));
  const g = new THREE.Group();
  g.add(m);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.2), new THREE.MeshBasicMaterial({ map: textTex('x2', '#7c2d12'), transparent: true }));
  label.position.z = 0.12;
  g.add(label);
  return g;
}
function textTex(t, color) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 76;
  const g = c.getContext('2d');
  g.font = 'bold 64px "Arial Black", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = color; g.fillText(t, 64, 40);
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  return tx;
}
/** Foguete (também usado nas costas do personagem). */
export function makeRocket(scale = 1) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.42, 8, 16), mat('#e2e8f0', { metalness: 0.4, roughness: 0.3 }));
    body.position.x = s * 0.13;
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#ef4444'));
    nose.position.set(s * 0.13, 0.32, 0);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.118, 0.07, 16), mat('#38bdf8'));
    band.position.set(s * 0.13, 0.05, 0);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.12), mat('#ef4444'));
    fin.position.set(s * 0.25, -0.2, 0);
    g.add(body, nose, band, fin);
  }
  const flame = new THREE.Group();
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.4, 14), new THREE.MeshBasicMaterial({ color: '#fb923c', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    f.rotation.x = Math.PI;
    f.position.set(s * 0.13, -0.5, 0);
    const core = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.25, 12), new THREE.MeshBasicMaterial({ color: '#fef08a', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    core.rotation.x = Math.PI;
    core.position.set(s * 0.13, -0.42, 0);
    flame.add(f, core);
  }
  g.add(flame);
  g.userData.flame = flame;
  g.scale.setScalar(scale);
  return g;
}
/** Pula-pula: mola verde com apoio para os pés. */
export function makePogo(scale = 1) {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 80; i++) { const a = (i / 80) * Math.PI * 2 * 5; pts.push(new THREE.Vector3(Math.cos(a) * 0.12, i / 80 * 0.45, Math.sin(a) * 0.12)); }
  const spring = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.025, 8), mat('#22c55e', { metalness: 0.4, roughness: 0.3 }));
  g.add(spring);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.06, 20), mat('#111827'));
  foot.position.y = -0.03;
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 20), mat('#facc15'));
  plate.position.y = 0.48;
  g.add(foot, plate);
  g.userData.spring = spring;
  g.scale.setScalar(scale);
  return g;
}

export function makePowerup(type) {
  const g = new THREE.Group();
  const icon = type === 'ima' ? magnet() : type === 'estrela' ? star() : type === 'foguete' ? makeRocket(0.85) : makePogo(1.1);
  if (type === 'foguete') icon.rotation.z = -0.5;
  if (type === 'pulapula') icon.position.y = -0.25;
  g.add(icon);
  const color = POWERS[type].color;
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.62, 28, 20), new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.22, roughness: 0.1, metalness: 0.2, depthWrite: false }));
  g.add(bubble);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.035, 8, 40), new THREE.MeshBasicMaterial({ color }));
  g.add(ring);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 }));
  glow.scale.set(2.2, 2.2, 1);
  g.add(glow);
  g.userData = { icon, ring, glow };
  return g;
}
