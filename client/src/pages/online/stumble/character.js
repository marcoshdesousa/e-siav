// Boneco do Stumble DBV: a skin escolhida no estilo feijãozinho (estilo "Stumble Guys"), com as
// animações de verdade do esqueleto. O esqueleto precisa estar carregado antes (loadRig()).
import { buildAvatar, poseAvatar } from '../avatar/build.js';

const SCALE = 1.7; // do tamanho da pista (~2,1 m de altura, como antes)
const STATES = { run: 'run', air: 'jump', dive: 'dive', stun: 'stumble', idle: 'idle', wave: 'wave', fall: 'fall', win: 'win', lose: 'lose' };

export function makeStumbler(skin) {
  const g = buildAvatar(skin, 'stumble');
  g.scale.setScalar(SCALE);
  return g;
}

/** Anima: parado, correndo, no ar, mergulhando, tonto (stun), caindo, acenando, comemorando. */
export function animate(person, t, state) {
  poseAvatar(person, STATES[state] || 'idle', t);
}
