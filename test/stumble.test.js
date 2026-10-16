import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as stb from '../server/online/stumble.js';

test('stumble: 3 fases sorteadas, classificação por rodada e só o 1º da final vence', () => {
  assert.equal(stb.qualifyCount(10, 0), 7);
  assert.equal(stb.qualifyCount(7, 1), 5);
  assert.equal(stb.qualifyCount(3, 0), 2);
  assert.equal(stb.qualifyCount(5, 2), 1);
  let now = 1_000_000;
  const s = stb.start([1, 2, 3, 4, 5], now);
  assert.equal(new Set(s.stages).size, 3);
  assert.ok(s.stages.every((x) => x >= 0 && x < stb.STAGE_COUNT));
  assert.equal(s.phase, 'intro');
  assert.ok(s.rouletteEndsAt > now && s.rouletteEndsAt < s.raceStartAt, 'roleta antes da apresentação');
  stb.tick(s, now + stb.INTRO_TOTAL - 1);
  assert.equal(s.phase, 'intro');
  now += stb.INTRO_TOTAL; stb.tick(s, now);
  assert.equal(s.phase, 'race');
  assert.ok(stb.act(s, 1, { type: 'finish' }, {}, now + 1000).error, 'rápido demais');
  assert.ok(stb.act(s, 1, { type: 'finish' }, {}, now + 20_000).error, 'fase longa: 20 s ainda é rápido demais');
  now += 30_000;
  for (const id of [3, 1, 5, 2]) stb.act(s, id, { type: 'finish' }, {}, now);
  assert.equal(s.phase, 'results');
  assert.deepEqual(s.alive, [3, 1, 5, 2]);
  assert.deepEqual(s.eliminated, [4]);
  now += 6000; stb.tick(s, now);
  assert.equal(s.round, 1);
  assert.equal(s.qualify, 3);
  now += stb.INTRO_TOTAL; stb.tick(s, now);
  now += 30_000;
  // Tempo acabou com só 1 chegando: passam os que foram mais longe
  stb.act(s, 2, { type: 'finish' }, {}, now);
  stb.act(s, 5, { type: 'progress', p: 0.8 }, {}, now);
  stb.act(s, 3, { type: 'progress', p: 0.3 }, {}, now);
  stb.act(s, 1, { type: 'progress', p: 0.5 }, {}, now);
  stb.tick(s, now + 200_000);
  assert.deepEqual(s.alive, [2, 5, 1]);
  stb.tick(s, now + 206_001);
  assert.equal(s.round, 2);
  assert.equal(s.qualify, 1);
  now += 230_000; stb.tick(s, now);
  now += 30_000;
  stb.act(s, 5, { type: 'finish' }, {}, now);
  assert.equal(s.winner, 5);
  stb.tick(s, now + 7000);
  assert.equal(s.done, true);
});

test('stumble: tempo da fase depende do tamanho da pista e os robôs não seguram a fase', () => {
  assert.equal(stb.STAGE_LEN.length, stb.STAGE_COUNT);
  // Fases longas: de ~360 a ~440 m (1 a 2 minutos para uma pessoa)
  assert.ok(stb.STAGE_LEN.every((l) => l >= 355 && l <= 440));
  assert.equal(stb.raceSeconds(300), 125);
  assert.equal(stb.raceSeconds(600), 180);
  assert.ok(stb.STAGE_LEN.every((l) => stb.raceSeconds(l) >= l / 3.2 && stb.raceSeconds(l) <= 180), 'tempo dá para quem cai algumas vezes');
  let now = 2_000_000;
  // 1 pessoa e 4 robôs: a pessoa não chega e mesmo assim a fase acaba cedo
  const s = stb.start([1, -1, -2, -3, -4], now);
  const len = stb.STAGE_LEN[s.stages[0]];
  now += stb.INTRO_TOTAL; stb.tick(s, now);
  assert.equal(s.phase, 'race');
  assert.equal(s.phaseEndsAt - s.raceStartAt, stb.raceSeconds(len) * 1000);
  assert.ok(Object.values(s.botT).every((t) => t >= len / 6 && t <= len / 4.2 + 4));
  for (let el = 0; el <= stb.botFreeAfter(len) + 1 && s.phase === 'race'; el += 1) stb.bot(s, now + el * 1000);
  assert.equal(s.phase, 'results');
  assert.equal(s.finished.length, s.qualify);
  assert.ok(stb.view(s).stageLen === len);
});

// ───────────── Pista e física de verdade (as fases do cliente montadas no Node) ─────────────
const ctx2d = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 100 }) : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }) };
const THREE = await import('three');
const { buildStage, STAGES } = await import('../client/src/pages/online/stumble/stages.js');
const ph = await import('../client/src/pages/online/stumble/physics.js');
const scene = new THREE.Scene();
const stageOf = (name) => buildStage(scene, STAGES.findIndex((x) => x.name === name), 1);
const FW = { x: 0, z: -1 };
/** Roda a física por `secs` segundos (com as peças andando junto). */
function run(st, stage, t0, secs, ev) {
  let t = t0;
  for (let i = 0; i < Math.round(secs / ph.STEP); i++) {
    t += ph.STEP;
    ph.updateStage(stage, t, ph.STEP);
    ph.stepBody(st, stage, ph.STEP, t, 1, FW, ev);
  }
  return t;
}

test('stumble: o comprimento de cada fase no servidor é o mesmo da pista montada', () => {
  assert.equal(STAGES.length, stb.STAGE_COUNT);
  const lens = STAGES.map((_, i) => { const s = buildStage(scene, i, 1); scene.remove(s.group); return Math.round(-s.finishZ); });
  assert.deepEqual(lens, stb.STAGE_LEN);
});

test('stumble: ventilador empurra de verdade para o lado (e dá para resistir correndo contra)', () => {
  const stage = stageOf('Vendaval');
  const w = stage.winds[0];
  // Acha um momento com o vento ligado no máximo
  let t = 0;
  for (; t < 20; t += 0.01) { ph.updateStage(stage, t, 0.01); if (w.k === 1) break; }
  assert.equal(w.k, 1);
  const zc = (w.z0 + w.z1) / 2;
  const free = Object.assign(ph.newBody(), { x: 0, y: 0, z: zc });
  run(free, stage, t, 0.05);
  free.grounded = true;
  const x0 = free.x;
  run(free, stage, t + 0.05, 0.5);
  const pushed = free.x - x0;
  assert.ok(Math.sign(pushed) === Math.sign(w.fx) && Math.abs(pushed) > 1.2, `vento empurrou ${pushed.toFixed(2)} m`);
  // Correndo contra o vento anda bem menos para o lado
  const fight = Object.assign(ph.newBody(), { x: 0, y: 0, z: zc, mx: -Math.sign(w.fx), grounded: true });
  run(fight, stage, t, 0.55);
  assert.ok(Math.abs(fight.x) < Math.abs(pushed) || Math.sign(fight.x) !== Math.sign(w.fx));
});

test('stumble: mola joga sempre igual e o boneco cai na próxima mola até o chão do fim', () => {
  const stage = stageOf('Pula-Pula');
  const pads = stage.plats.filter((p) => p.kind === 'bounce' && p.aim);
  assert.ok(pads.length >= 10 && pads.every((p) => p.aim), 'todas as molas têm alvo');
  const first = pads[0];
  for (const vz of [0, -7.4, -11.5]) {
    // Chega parado, correndo ou mergulhando: o pulo é o mesmo
    const st = Object.assign(ph.newBody(), { x: 0.8, y: 1.2, z: first.z + 1, vz });
    let bounces = 0;
    const ev = { sound: (n) => { if (n === 'stbBounce') bounces++; }, burst() {} };
    let t = 0;
    for (let k = 0; k < 600 && !(st.grounded && st.ground?.kind === 'normal'); k++) t = run(st, stage, t, ph.STEP, ev);
    assert.ok(st.grounded && st.ground.kind === 'normal', 'terminou em pé no chão');
    assert.ok(st.y > -0.5, 'não caiu na água');
    assert.ok(bounces >= 2, `pulou em ${bounces} molas`);
  }
  // Velocidade de subida é sempre a mesma
  const st = Object.assign(ph.newBody(), { x: 0, y: first.top, z: first.z });
  ph.springLaunch(st, first);
  assert.equal(st.vy, ph.BOUNCE);
  assert.ok(st.vz < -5 && st.vz > -12);
});

test('stumble: boneco não entra dentro de bloco alto e bate a cabeça na viga das portas', () => {
  const stage = stageOf('Pula-Pula');
  const tower = stage.plats.find((p) => p.top >= 4 && !p.slope);
  assert.ok(tower);
  const st = Object.assign(ph.newBody(), { x: 0, y: 0, z: tower.z + tower.d / 2 + 0.2, vz: -9, grounded: true, mz: -1 });
  stage.plats.push({ x: 0, z: st.z + 2, w: 12, d: 6, top: 0, thick: 1, kind: 'normal', ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: 0, mesh: { position: { set() {} } } });
  run(st, stage, 0, 0.6);
  assert.ok(st.z >= tower.z + tower.d / 2 + ph.R - 0.01, 'ficou do lado de fora da torre');
  // Pulo dentro da porta aberta: bate a cabeça na viga, sem ser jogado para trás
  const doors = stageOf('Portas da Sorte');
  const beam = doors.walls.find((w) => w.y0 > 2);
  const open = doors.walls.find((w) => w.fake && Math.abs(w.z - beam.z) < 0.1);
  open.gone = true;
  const j = Object.assign(ph.newBody(), { x: open.x, y: 0, z: beam.z, vy: ph.JUMP });
  doors.walls.filter((w) => w !== beam && w !== open).forEach((w) => { w.gone = true; });
  let maxY = 0;
  for (let i = 0; i < 40; i++) { ph.stepBody(j, doors, ph.STEP, 0, 1, FW); maxY = Math.max(maxY, j.y); }
  assert.ok(maxY <= beam.y0 - ph.H + 1e-6, 'cabeça parou na viga');
  assert.ok(Math.abs(j.z - beam.z) < 0.01, 'continua dentro da porta');
  // Pancada nunca passa do limite
  const k = ph.newBody();
  ph.knock(k, 1, 0, 99, 5);
  assert.ok(Math.hypot(k.vx, k.vz) <= 15.01);
});
