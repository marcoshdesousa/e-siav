// Prévia 3D da skin: o personagem gira devagar num pedestal e vai correndo, pulando e acenando.
// mode: 'surf' (adolescente + skate), 'stumble' (bonequinho) ou 'board' (só o skate).
import * as THREE from 'three';
import { buildAvatar, poseAvatar } from './build.js';
import { buildBoard, poseBoard } from './board.js';
import { boardById, skinById } from './skins.js';

const CYCLE = [['run', 2.4], ['jump', 0.9], ['run', 1.6], ['wave', 1.8], ['idle', 1.2]];
const SURF_CYCLE = [['run', 2.0], ['jump', 0.9], ['skate', 2.2], ['skatejump', 1.0], ['skatelie', 1.4], ['skate', 1.0], ['wave', 1.6]];

export function mountPreview(canvas, { mode = 'surf', skin = 'm01', board = 'b01', spin = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  scene.add(new THREE.HemisphereLight('#ffffff', '#8aa0c8', 1.6));
  const sun = new THREE.DirectionalLight('#ffffff', 2.2);
  sun.position.set(2.5, 5, -3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -2;
  sun.shadow.camera.right = sun.shadow.camera.top = 2;
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#b4d4ff', 1.2);
  rim.position.set(-3, 3, 4);
  scene.add(rim);
  // Pedestal
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.92, 0.12, 48), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }));
  ped.position.y = -0.06;
  ped.receiveShadow = true;
  scene.add(ped);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.885, 0.025, 8, 64), new THREE.MeshBasicMaterial({ color: '#60a5fa' }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.0;
  scene.add(ring);

  const turn = new THREE.Group();
  scene.add(turn);
  let model = null;
  let deck = null;
  let cur = {};
  function set(next) {
    cur = { mode, skin, board, ...cur, ...next };
    if (model) { turn.remove(model); model = null; }
    if (deck) { turn.remove(deck); deck = null; }
    if (cur.mode !== 'board') {
      model = buildAvatar(skinById(cur.skin), cur.mode === 'stumble' ? 'stumble' : 'surf');
      model.rotation.y = Math.PI; // de frente para a câmera
      turn.add(model);
    }
    if (cur.mode !== 'stumble') {
      deck = buildBoard(boardById(cur.board));
      if (cur.mode === 'board') { deck.rotation.x = -0.35; deck.position.y = 0.55; deck.scale.setScalar(1.25); }
      turn.add(deck);
    }
    const h = cur.mode === 'stumble' ? 1.9 : cur.mode === 'board' ? 1.2 : 2.2;
    cam.position.set(0, h * 0.6, cur.mode === 'board' ? 3.6 : h * (cur.mode === 'stumble' ? 3.6 : 3.2));
    cam.lookAt(0, h * (cur.mode === 'board' ? 0.35 : 0.44), 0);
    ring.material.color.set(cur.mode === 'stumble' ? '#f472b6' : '#60a5fa');
  }
  set({ mode, skin, board });

  const resize = () => {
    const w = canvas.clientWidth || 300;
    const hh = canvas.clientHeight || 300;
    renderer.setSize(w, hh, false);
    cam.aspect = w / hh;
    cam.updateProjectionMatrix();
  };
  resize();
  const ro = new window.ResizeObserver(resize);
  ro.observe(canvas);

  const t0 = window.performance.now();
  let raf = 0;
  const loop = () => {
    raf = window.requestAnimationFrame(loop);
    const t = (window.performance.now() - t0) / 1000;
    if (spin) turn.rotation.y = t * 0.6;
    if (cur.mode === 'board') {
      poseBoard(deck, t, (t % 3) / 0.8);
      deck.rotation.y = 0;
    } else {
      const cyc = cur.mode === 'surf' ? SURF_CYCLE : CYCLE;
      const total = cyc.reduce((a, c) => a + c[1], 0);
      let r = t % total;
      let i = 0;
      while (r > cyc[i][1]) { r -= cyc[i][1]; i++; }
      const [st, len] = cyc[i];
      const k = r / len;
      const onBoard = st.startsWith('skate');
      let y = 0;
      if (st === 'jump' || st === 'skatejump') y = Math.sin(k * Math.PI) * (cur.mode === 'stumble' ? 0.55 : 0.75);
      if (deck) {
        deck.visible = onBoard || cur.mode === 'surf';
        poseBoard(deck, t, st === 'skatejump' ? k * 1.15 : 0);
        deck.position.set(onBoard ? 0 : 0.72, onBoard ? y * 0.92 : 0, onBoard ? 0 : 0.2);
        deck.rotation.set(0, onBoard ? Math.PI : -0.6, onBoard ? 0 : 0);
        deck.scale.setScalar(onBoard ? 1 : 0.8);
      }
      if (model) {
        model.position.y = y + (onBoard && st !== 'skatelie' ? 0.2 : 0);
        model.position.x = 0;
        poseAvatar(model, st === 'skatejump' ? 'air' : st, t, k);
        if (st === 'skatelie') model.position.y = 0.0;
      }
    }
    renderer.render(scene, cam);
  };
  loop();
  return {
    set,
    dispose() { window.cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); },
  };
}
