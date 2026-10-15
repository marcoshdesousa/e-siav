// Boneco do Stumble DBV: corpo arredondado, cabeça grande e o visual escolhido.
import * as THREE from 'three';

const geo = {
  body: new THREE.CapsuleGeometry(0.42, 0.42, 6, 14),
  head: new THREE.SphereGeometry(0.46, 18, 14),
  limb: new THREE.CapsuleGeometry(0.11, 0.32, 4, 8),
  leg: new THREE.CapsuleGeometry(0.13, 0.26, 4, 8),
  eye: new THREE.SphereGeometry(0.1, 10, 8),
  pupil: new THREE.SphereGeometry(0.05, 8, 6),
};
const mats = new Map();
const mat = (c) => {
  if (!mats.has(c)) mats.set(c, new THREE.MeshLambertMaterial({ color: c }));
  return mats.get(c);
};

export function makeStumbler(o) {
  const g = new THREE.Group();
  const inner = new THREE.Group(); // gira inteiro no mergulho
  g.add(inner);
  const parts = {};
  const add = (m, x, y, z, parent = inner) => { m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };

  // Pernas
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(0.18 * s, 0.5, 0);
    const longLeg = o.bottomType === 'calca';
    add(new THREE.Mesh(geo.leg, mat(longLeg ? o.bottom : o.skin)), 0, -0.2, 0, hip);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.34), mat(o.shoes)), 0, -0.42, -0.05, hip);
    inner.add(hip);
    parts[s < 0 ? 'legL' : 'legR'] = hip;
  }
  // Corpo: parte de cima (camisa) e de baixo
  add(new THREE.Mesh(geo.body, mat(o.top)), 0, 1.05, 0);
  const low = o.bottomType === 'saia' || o.bottomType === 'vestido'
    ? new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.56, o.bottomType === 'vestido' ? 0.62 : 0.5, 14), mat(o.bottomType === 'vestido' ? o.top : o.bottom))
    : new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.32, 14), mat(o.bottom));
  add(low, 0, o.bottomType === 'vestido' ? 0.62 : 0.66, 0);
  // Braços
  for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(0.5 * s, 1.25, 0);
    add(new THREE.Mesh(geo.limb, mat(o.top)), 0, -0.22, 0, sh);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), mat(o.skin)), 0, -0.47, 0, sh);
    sh.rotation.z = 0.15 * s;
    inner.add(sh);
    parts[s < 0 ? 'armL' : 'armR'] = sh;
  }
  // Cabeça e rosto
  const head = new THREE.Group();
  head.position.y = 1.86;
  inner.add(head);
  add(new THREE.Mesh(geo.head, mat(o.skin)), 0, 0, 0, head);
  for (const s of [-1, 1]) {
    add(new THREE.Mesh(geo.eye, mat('#ffffff')), 0.16 * s, 0.06, -0.39, head);
    add(new THREE.Mesh(geo.pupil, mat('#111111')), 0.16 * s, 0.06, -0.48, head);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 12, Math.PI), mat('#7f1d1d'));
  smile.rotation.z = Math.PI;
  add(smile, 0, -0.14, -0.43, head);

  // Cabelo
  const hc = mat(o.hairColor);
  const cap = (r = 0.48, phi = Math.PI / 2) => new THREE.Mesh(new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, phi), hc);
  if (o.hair !== 'raspado') add(cap(0.485, o.hair === 'longo' || o.hair === 'trancas' ? Math.PI * 0.62 : Math.PI * 0.5), 0, 0.04, 0.02, head);
  if (o.hair === 'topete') { const t = add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), hc), 0, 0.42, -0.22, head); t.scale.set(1.4, 0.8, 1); }
  if (o.hair === 'cacheado') for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), hc), Math.cos(a) * 0.38, 0.28, Math.sin(a) * 0.38 + 0.05, head); }
  if (o.hair === 'coque') add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), hc), 0, 0.38, 0.32, head);
  if (o.hair === 'rabo') { const t = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.4, 4, 8), hc), 0, -0.05, 0.5, head); t.rotation.x = 0.5; parts.tail = t; }
  if (o.hair === 'trancas') for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.5, 4, 8), hc), 0.38 * s, -0.32, 0.12, head);
  if (o.hair === 'longo') add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.2), hc), 0, -0.25, 0.32, head);

  // Chapéus
  const hm = mat(o.hatColor || '#333');
  if (o.hat === 'bone') {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), hm), 0, 0.08, 0, head);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.36), hm), 0, 0.2, -0.5, head);
  }
  if (o.hat === 'chapeu') {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.04, 20), hm), 0, 0.28, 0, head);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.34, 16), hm), 0, 0.44, 0, head);
  }
  if (o.hat === 'boina') { const b = add(new THREE.Mesh(new THREE.SphereGeometry(0.46, 14, 8), hm), 0.06, 0.34, 0.02, head); b.scale.y = 0.38; }
  if (o.hat === 'faixa') add(new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.05, 6, 22), hm), 0, 0.18, 0, head).rotation.x = Math.PI / 2;
  if (o.hat === 'capacete') {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.56, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hm), 0, 0.02, 0, head);
  }
  if (o.hat === 'chef') {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.3, 16), hm), 0, 0.46, 0, head);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), hm), 0, 0.72, 0, head);
  }
  // Extras
  const em = mat(o.extraColor || '#333');
  if (o.extra === 'lenco') { const l = add(new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.4, 3), em), 0, 1.36, -0.32); l.rotation.x = Math.PI; }
  if (o.extra === 'mochila') add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.62, 0.3), em), 0, 1.1, 0.46);
  if (o.extra === 'avental') add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.66, 0.04), em), 0, 0.9, -0.43);
  if (o.extra === 'capa') { const c = add(new THREE.Mesh(new THREE.BoxGeometry(0.86, 1.0, 0.05), em), 0, 1.0, 0.46); c.rotation.x = -0.12; parts.cape = c; }
  if (o.extra === 'oculos') {
    for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 6, 14), em), 0.16 * s, 0.06, -0.45, head);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.03), em), 0, 0.08, -0.46, head);
  }
  parts.inner = inner;
  parts.head = head;
  g.userData.parts = parts;
  return g;
}

/** Animação: parado, correndo, no ar, mergulhando ou caído. */
export function animate(person, t, state) {
  const p = person.userData.parts;
  const run = state === 'run';
  const s = Math.sin(t * 14);
  p.inner.rotation.x = state === 'dive' ? -1.3 : state === 'stun' ? Math.sin(t * 20) * 0.3 : 0;
  p.inner.position.y = state === 'dive' ? 0.45 : run ? Math.abs(s) * 0.08 : 0;
  if (state === 'air') { p.legL.rotation.x = -0.6; p.legR.rotation.x = 0.5; p.armL.rotation.x = -2.6; p.armR.rotation.x = -2.6; return; }
  if (state === 'dive') { p.armL.rotation.x = -3; p.armR.rotation.x = -3; p.legL.rotation.x = 0.3; p.legR.rotation.x = 0.3; return; }
  const k = run ? 0.9 : 0.05;
  const sp = run ? s : Math.sin(t * 2);
  p.legL.rotation.x = sp * k;
  p.legR.rotation.x = -sp * k;
  p.armL.rotation.x = -sp * k;
  p.armR.rotation.x = sp * k;
  if (p.tail) p.tail.rotation.x = 0.5 + Math.abs(sp) * 0.3;
}
