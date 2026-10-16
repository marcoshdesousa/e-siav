// Prévia 3D do personagem: gira devagar num pedestal e vai correndo, pulando e acenando.
// mode: 'surf' (grande) ou 'stumble' (pequenininho).
import * as THREE from 'three';
import { buildAvatar, loadRig, poseAvatar, rigLoaded, studioEnv } from './build.js';
import { skinById } from './skins.js';

const CYCLE = [['run', 2.4], ['jump', 0.9], ['run', 1.6], ['wave', 1.8], ['idle', 1.2]];
const CELEBRATE = [['wave', 1.6], ['jump', 0.8], ['jump', 0.8], ['idle', 0.6]];

export function mountPreview(canvas, { mode = 'surf', skin = 'm01', spin = true, cycle = null } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.environment = studioEnv(renderer);
  scene.environmentIntensity = 0.5;
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  scene.add(new THREE.HemisphereLight('#ffffff', '#8aa0c8', 0.9));
  const sun = new THREE.DirectionalLight('#fff6e8', 2.0);
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
  let cur = {};
  let alive = true;
  function set(next) {
    cur = { mode, skin, ...cur, ...next };
    if (!rigLoaded()) { loadRig().then(() => alive && set({})); return; }
    if (model) { turn.remove(model); model = null; }
    model = buildAvatar(skinById(cur.skin), cur.mode === 'stumble' ? 'stumble' : 'surf');
    model.rotation.y = Math.PI; // de frente para a câmera
    turn.add(model);
    const h = cur.mode === 'stumble' ? 1.9 : 2.2;
    cam.position.set(0, h * 0.6, h * (cur.mode === 'stumble' ? 3.6 : 3.2));
    cam.lookAt(0, h * 0.44, 0);
    ring.material.color.set(cur.mode === 'stumble' ? '#f472b6' : '#60a5fa');
  }
  set({ mode, skin });

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
    if (spin && cycle !== 'celebrate') turn.rotation.y = t * 0.6;
    else if (cycle === 'celebrate') turn.rotation.y = Math.sin(t * 0.8) * 0.5;
    const cyc = cycle === 'celebrate' ? CELEBRATE : CYCLE;
    const total = cyc.reduce((acc, c) => acc + c[1], 0);
    let r = t % total;
    let i = 0;
    while (r > cyc[i][1]) { r -= cyc[i][1]; i++; }
    const [st, len] = cyc[i];
    const k = r / len;
    const y = st === 'jump' ? Math.sin(k * Math.PI) * (cur.mode === 'stumble' ? 0.55 : 0.75) : 0;
    if (model) {
      model.position.set(0, y, 0);
      poseAvatar(model, st, t);
    }
    renderer.render(scene, cam);
  };
  loop();
  return {
    set,
    dispose() { alive = false; window.cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); },
  };
}
