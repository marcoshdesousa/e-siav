// Boneco do Stumble DBV: a skin escolhida no estilo bonequinho (cabeçudo), do mesmo jeito em
// todos os jogos. Fica do tamanho da pista (as fases foram feitas para ~2,3 m de altura).
import { buildAvatar, poseAvatar } from '../avatar/build.js';

const SCALE = 1.3;
const STATES = { run: 'run', air: 'jump', dive: 'dive', stun: 'stumble', idle: 'idle', wave: 'wave' };

export function makeStumbler(skin) {
  const g = buildAvatar(skin, 'stumble');
  g.scale.setScalar(SCALE);
  g.traverse((o) => { if (o.isMesh && o.material.type !== 'MeshBasicMaterial') o.castShadow = true; });
  return g;
}

/** Animação: parado, correndo, no ar, mergulhando, tonto (stun) ou acenando. */
export function animate(person, t, state) {
  poseAvatar(person, STATES[state] || 'idle', t, state === 'stun' ? (t * 2) % 1 : 0);
}
