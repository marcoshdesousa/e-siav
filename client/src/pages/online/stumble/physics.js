// Stumble DBV: física do boneco e movimento das peças da pista, sem nada de tela (roda no celular e
// também nos testes do Node). Passos pequenos (120 por segundo) para ninguém atravessar o chão.
//
// Forças externas (vento, esteira, rolos) mexem a posição direto, sem passar pelo controle do
// jogador: assim o ventilador empurra de verdade e dá para resistir correndo contra ele.

export const SPEED = 7.4; // velocidade correndo (m/s)
export const GRAV = 34;
export const JUMP = 12; // pulo de ~2,1 m
export const BOUNCE = 17.5; // cama elástica (sempre a mesma subida: ~4,5 m)
export const R = 0.45; // raio do boneco
export const H = 1.8; // altura do boneco
export const STEP = 1 / 120; // passo da física
const ACC_GROUND = 48; // aceleração no chão (m/s²)
const ACC_STOP = 60; // freada no chão
const ACC_AIR = 15; // controle no ar
const ACC_ICE = 6; // gelo: escorrega
const COYOTE = 0.12; // ainda dá para pular logo depois de sair da borda
export const JUMP_BUF = 0.15; // apertou pular um pouquinho antes de cair no chão: pula assim que encostar
export const DIVE_V = 11.5;
const STEP_UP = 0.45; // degrau que o boneco sobe sozinho
const KNOCK_MAX = 15; // pancada mais forte possível (m/s)
const NOEV = { sound() {}, burst() {} };

export function newBody() {
  return {
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, grounded: false, stun: 0, dive: 0, recover: 0, inv: 0, coyote: 0, jumpBuf: 0,
    launch: 0, wvx: 0, wvz: 0, wind: 0, mx: 0, mz: 0, yaw: 0, ground: null,
  };
}

/** Altura do chão da plataforma no ponto (x, z), ou null se o ponto está fora dela. */
export function platTop(p, x, z) {
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

/** Move obstáculos e plataformas para o tempo t da corrida (igual em todos os celulares). */
export function updateStage(stage, t, dt) {
  for (const u of stage.updaters) u(t, dt);
  for (const p of stage.plats) {
    if (p.move) {
      const o = p.move(t, p.mv || (p.mv = { x: 0, y: 0, z: 0 }));
      p.dx = o.x - p.ox; p.dy = o.y - p.oy; p.dz = o.z - p.oz;
      p.ox = o.x; p.oy = o.y; p.oz = o.z;
      if (Math.abs(p.dx) > 2 || Math.abs(p.dz) > 2 || Math.abs(p.dy) > 2) p.dx = p.dy = p.dz = 0; // tempo pulou (nova fase): não arrasta
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
      if (p.fallAt > t + 1) { p.fallAt = null; p.gone = false; p.mesh.position.set(p.x, p.baseY, p.z); } // nova corrida
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
}

/** Pancada: joga o boneco para longe (sempre com a mesma sensação, limitada). */
export function knock(st, dx, dz, power, up, ev = NOEV) {
  const l = Math.hypot(dx, dz) || 1;
  const pw = Math.min(KNOCK_MAX, power);
  st.vx = (dx / l) * pw;
  st.vz = (dz / l) * pw;
  st.vy = Math.max(st.vy, up);
  st.stun = 0.75; // cambaleia um pouco e logo volta ao controle
  st.inv = 1.0; // e fica um instante sem levar outra pancada
  st.dive = st.recover = st.launch = 0;
  st.grounded = false;
  st.coyote = 0;
  ev.sound('stbBump');
  ev.burst('spark', st.x, st.y + 1, st.z);
}

/**
 * Cama elástica: sobe sempre igual e cai no alvo da mola (a próxima mola ou o chão depois delas),
 * então o pulo é confiável e não depende de como o jogador chegou.
 */
export function springLaunch(st, p, ev = NOEV) {
  const v = BOUNCE;
  st.vy = v;
  st.dive = st.recover = 0;
  st.grounded = false;
  st.coyote = 0;
  const a = p.aim;
  if (a) {
    const dy = a.y - st.y;
    const T = (v + Math.sqrt(Math.max(0, v * v - 2 * GRAV * dy))) / GRAV;
    const half = Math.max(0.3, (a.w || 4) / 2 - 0.9);
    const tx = Math.max(a.x - half, Math.min(a.x + half, st.x));
    st.vz = (a.z - st.z) / T;
    st.vx = (tx - st.x) / T;
    st.launch = T * 0.85;
  } else st.launch = 0.3;
  p.squash = 1;
  ev.sound('stbBounce');
  ev.burst('bounce', st.x, st.y + 0.2, st.z);
}

/**
 * Um passo da física (h segundos). frac = parte do movimento das plataformas que cabe neste passo.
 * fw = para onde a câmera olha no chão (o joystick é relativo a ela).
 */
export function stepBody(st, stage, h, t, frac, fw, ev = NOEV) {
  const g = st.ground;
  const ctl = st.stun <= 0 && st.dive <= 0 && st.recover <= 0;
  const ix = st.mx;
  const iz = st.mz;
  const want = Math.hypot(ix, iz) > 0.15;
  // Joystick relativo à câmera: para cima (iz < 0) = para onde a câmera olha; direita = lado direito dela
  const wx = -fw.z * ix - fw.x * iz;
  const wz = fw.x * ix - fw.z * iz;
  if (ctl) {
    let tx; let tz; let acc;
    if (st.grounded) {
      tx = want ? wx * SPEED : 0;
      tz = want ? wz * SPEED : 0;
      acc = g?.kind === 'ice' ? ACC_ICE : want ? ACC_GROUND : ACC_STOP;
    } else {
      // No ar: sem frear quando solta o joystick, e sem perder o impulso da mola
      const sp = Math.hypot(st.vx, st.vz);
      if (want) { const s = Math.max(SPEED, sp); tx = wx * s; tz = wz * s; } else { tx = st.vx; tz = st.vz; }
      acc = st.launch > 0 ? ACC_AIR * 0.25 : ACC_AIR;
    }
    const dvx = tx - st.vx;
    const dvz = tz - st.vz;
    const dl = Math.hypot(dvx, dvz);
    const m = acc * h;
    if (dl <= m) { st.vx = tx; st.vz = tz; } else if (dl > 0) { st.vx += (dvx / dl) * m; st.vz += (dvz / dl) * m; }
  } else if (st.grounded) {
    // Tonto ou deslizando do mergulho: atrito no chão
    const f = 1 - Math.min(1, h * (st.recover > 0 ? 5 : 3.2));
    st.vx *= f;
    st.vz *= f;
  }
  st.stun = Math.max(0, st.stun - h);
  st.inv = Math.max(0, st.inv - h);
  st.recover = Math.max(0, st.recover - h);
  st.launch = Math.max(0, st.launch - h);
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
    ev.sound('stbJump');
    ev.burst('dust', st.x, st.y + 0.1, st.z);
  }
  // Vento dos ventiladores: empurra a posição (o controle do jogador não "come" o vento)
  let wtx = 0;
  let wtz = 0;
  if (stage.winds) {
    for (const w of stage.winds) {
      if (!w.k || st.x < w.x0 || st.x > w.x1 || st.z > w.z0 || st.z < w.z1 || st.y > w.top) continue;
      const air = st.grounded ? 1 : 1.25; // no ar o vento leva mais
      wtx += w.fx * w.k * air;
      wtz += (w.fz || 0) * w.k * air;
    }
  }
  const ks = Math.min(1, h * 7);
  st.wvx += (wtx - st.wvx) * ks;
  st.wvz += (wtz - st.wvz) * ks;
  st.wind = Math.hypot(wtx, wtz);
  st.x += st.wvx * h;
  st.z += st.wvz * h;
  st.vy -= GRAV * h;
  if (st.vy < -40) st.vy = -40;
  // Plataforma embaixo leva o jogador junto (móveis, elevadores, giratórias, esteiras, troncos e gangorras)
  if (st.grounded && g && !g.gone) {
    st.x += g.dx * frac;
    st.z += g.dz * frac;
    if (g.dy) st.y += g.dy * frac;
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
  const py = st.y;
  st.x += st.vx * h;
  st.y += st.vy * h;
  st.z += st.vz * h;
  // Chão
  const wasGrounded = st.grounded;
  st.grounded = false;
  let ground = null;
  let gtop = -Infinity;
  const plats = stage.plats;
  for (let i = 0; i < plats.length; i++) {
    const p = plats[i];
    if (Math.abs(st.z - p.z - p.oz) > (p.r || p.d / 2) + 1) continue;
    const top = platTop(p, st.x, st.z);
    if (top == null || top > st.y + STEP_UP) continue;
    if (top > gtop) { gtop = top; ground = p; }
  }
  // Desce até 0,9 m num passo: mesmo caindo a 40 m/s (0,33 m por passo) não atravessa
  if (ground && st.y <= gtop + 0.02 && st.vy <= 0.5 && gtop - st.y < 0.9) {
    const impact = st.vy;
    st.y = gtop;
    if (ground.kind === 'bounce') springLaunch(st, ground, ev);
    else {
      if (!wasGrounded && impact < -9) { ev.burst('land', st.x, st.y + 0.1, st.z); ev.sound('stbLand'); }
      if (st.dive > 0) { st.dive = 0; st.recover = 0.32; } // caiu de barriga: escorrega e levanta
      st.vy = 0;
      st.grounded = true;
      st.launch = 0;
    }
    if ((ground.kind === 'fake' || ground.kind === 'crumble') && ground.fallAt == null) ground.fallAt = t;
  }
  st.ground = st.grounded ? ground : null;
  // Lados das plataformas altas: ninguém entra dentro de um bloco (sai pelo lado mais perto)
  for (let i = 0; i < plats.length; i++) {
    const p = plats[i];
    if (p.gone || p.slope || p.tiltA || p === st.ground) continue;
    const pz = p.z + p.oz;
    if (Math.abs(st.z - pz) > (p.r || p.d / 2) + R) continue;
    const top = p.top + p.oy;
    if (st.y >= top - STEP_UP || st.y + H <= top - (p.thick ?? 1)) continue;
    const px = p.x + p.ox;
    if (p.r) {
      const dx = st.x - px;
      const dz = st.z - pz;
      const d = Math.hypot(dx, dz);
      if (d >= p.r + R) continue;
      const nx = d > 1e-4 ? dx / d : 0;
      const nz = d > 1e-4 ? dz / d : 1;
      st.x = px + nx * (p.r + R);
      st.z = pz + nz * (p.r + R);
      const vn = st.vx * nx + st.vz * nz;
      if (vn < 0) { st.vx -= vn * nx; st.vz -= vn * nz; }
      continue;
    }
    const ex = p.w / 2 + R - Math.abs(st.x - px);
    const ez = p.d / 2 + R - Math.abs(st.z - pz);
    if (ex <= 0 || ez <= 0) continue;
    // Cantos arredondados: só empurra se o círculo do boneco encosta mesmo no retângulo
    const cx = Math.max(px - p.w / 2, Math.min(st.x, px + p.w / 2));
    const cz = Math.max(pz - p.d / 2, Math.min(st.z, pz + p.d / 2));
    if (Math.hypot(st.x - cx, st.z - cz) >= R && (st.x !== cx || st.z !== cz)) continue;
    if (ex < ez) {
      const s = Math.sign(st.x - px) || 1;
      st.x += s * ex;
      if (st.vx * s < 0) st.vx = 0;
    } else {
      const s = Math.sign(st.z - pz) || 1;
      st.z += s * ez;
      if (st.vz * s < 0) st.vz = 0;
    }
  }
  // Paredes (empurra para fora pelo lado mais perto; por baixo, bate a cabeça)
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
    if (w.fake) { w.gone = true; if (w.mesh) w.mesh.visible = false; ev.sound('stbDoor'); ev.burst('door', wx, 1.3, wz); continue; }
    if (py + H <= w.y0 + 0.05 && !w.knock) {
      // Viga em cima (portas): bate a cabeça e cai, sem ser jogado para trás
      st.y = w.y0 - H;
      if (st.vy > 0) st.vy = 0;
      continue;
    }
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
    if (w.knock && st.inv <= 0) knock(st, nx + (w.vx || 0) * 0.15, nz, w.knock + Math.abs(w.vx || 0) * 0.5, 4, ev);
    else {
      const vn = st.vx * nx + st.vz * nz;
      if (vn < 0) { st.vx -= vn * nx; st.vz -= vn * nz; }
      // Parede andando de lado: empurra junto (não fica preso dentro)
      if (w.vx && nx * w.vx > 0) st.x += w.vx * h;
    }
  }
  // Obstáculos que derrubam
  if (st.stun <= 0 && st.inv <= 0) {
    for (const hh of stage.hitters) {
      if (hit(st, hh, t, ev)) break;
    }
  }
}

/** Testa uma pancada de um obstáculo; devolve true se acertou. Também usado para os robôs. */
export function hitTest(x, y, z, hh) {
  if (hh.type === 'bar') {
    const ux = Math.cos(hh.ang);
    const uz = -Math.sin(hh.ang);
    const rx2 = x - hh.cx;
    const rz2 = z - hh.cz;
    const along = Math.max(-hh.L, Math.min(hh.L, rx2 * ux + rz2 * uz));
    const d = Math.hypot(x - (hh.cx + ux * along), z - (hh.cz + uz * along));
    return d < 0.25 + R && y < hh.y + 0.25 && y + H > hh.y - 0.25 ? along : null;
  }
  if (hh.type === 'ball' || hh.type === 'roll') {
    if (hh.off) return null;
    return Math.hypot(x - hh.x, y + 0.9 - hh.y, z - hh.z) < hh.r + 0.55 ? 1 : null;
  }
  if (hh.type === 'bumper') {
    const y0 = hh.y || 0;
    return y < 1.3 + y0 && y > y0 - 1 && Math.hypot(x - hh.x, z - hh.z) < hh.r + R ? 1 : null;
  }
  return null;
}

function hit(st, hh, t, ev) {
  const r = hitTest(st.x, st.y, st.z, hh);
  if (r == null) return false;
  if (hh.type === 'bar') {
    // Empurra no sentido em que a barra gira (e um pouco para fora dela)
    const along = r;
    const px = hh.cx + Math.cos(hh.ang) * along;
    const pz = hh.cz - Math.sin(hh.ang) * along;
    const tx = -Math.sin(hh.ang) * along * hh.w;
    const tz = -Math.cos(hh.ang) * along * hh.w;
    const ox = st.x - px;
    const oz = st.z - pz;
    const ol = Math.hypot(ox, oz) || 1;
    const tl = Math.hypot(tx, tz) || 1;
    knock(st, tx / tl + (ox / ol) * 0.35, tz / tl + (oz / ol) * 0.35, 9 + Math.abs(along * hh.w) * 0.4, 6, ev);
  } else if (hh.type === 'bumper') {
    knock(st, st.x - hh.x, st.z - hh.z, 12, 4, ev);
    hh.hitAt = t;
  } else {
    const vx = hh.vx || 0;
    const vz = hh.vz || 0;
    const dx = st.x - hh.x;
    const dz = st.z - hh.z;
    const dl = Math.hypot(dx, dz) || 1;
    const vl = Math.hypot(vx, vz);
    // Para onde o martelo/bola está indo, mais um pouco para fora do centro dele
    const kx = (vl > 0.5 ? vx / vl : 0) + (dx / dl) * 0.6;
    const kz = (vl > 0.5 ? vz / vl : 0) + (dz / dl) * 0.6;
    knock(st, kx, kz, 10 + vl * 0.35, 6, ev);
  }
  return true;
}
