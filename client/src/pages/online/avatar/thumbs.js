// Miniaturas (fotos) das skins e dos skates, desenhadas uma vez num renderizador escondido.
import * as THREE from 'three';
import { buildAvatar, poseAvatar, studioEnv } from './build.js';
import { buildBoard, poseBoard } from './board.js';
import { boardById, skinById } from './skins.js';

const cache = new Map();
let R = null;
function setup() {
  if (R) return R;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(180, 220);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.environment = studioEnv(renderer);
  scene.environmentIntensity = 0.5;
  scene.add(new THREE.HemisphereLight('#ffffff', '#8aa0c8', 0.9));
  const sun = new THREE.DirectionalLight('#fff6e8', 1.9);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  const cam = new THREE.PerspectiveCamera(26, 180 / 220, 0.1, 30);
  R = { renderer, scene, cam };
  return R;
}

let queue = Promise.resolve();
/** kind 'skin' (rosto e corpo, estilo Stumble fica mais fofinho na foto) ou 'board'. */
export function thumb(kind, id) {
  const key = kind + id;
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  queue = queue.then(() => new Promise((ok) => {
    window.setTimeout(() => {
      if (cache.has(key)) { ok(cache.get(key)); return; }
      const { renderer, scene, cam } = setup();
      let obj;
      if (kind === 'board') {
        obj = buildBoard(boardById(id));
        poseBoard(obj, 0);
        obj.rotation.set(1.05, 0.5, 0.35);
        obj.position.y = 0.3;
        cam.position.set(0, 0.3, 2.9);
        cam.lookAt(0, 0.3, 0);
      } else {
        obj = buildAvatar(skinById(id), 'surf');
        poseAvatar(obj, 'idle', 0.4);
        obj.rotation.y = Math.PI - 0.35;
        cam.position.set(0, 1.25, 4.4);
        cam.lookAt(0, 0.95, 0);
      }
      scene.add(obj);
      renderer.render(scene, cam);
      const url = renderer.domElement.toDataURL('image/png');
      scene.remove(obj);
      cache.set(key, url);
      ok(url);
    }, 0);
  }));
  return queue;
}
