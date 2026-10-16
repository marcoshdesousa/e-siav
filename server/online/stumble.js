// Stumble DBV: corrida de obstáculos com até 10 jogadores. Cada partida tem 3 fases sorteadas entre 30
// (cada sorteio aparece numa roleta antes da apresentação da fase).
// Fase 1 e 2: os primeiros que cruzarem a chegada passam; quem sobra é eliminado. Fase 3 (final):
// quem chegar primeiro vence. O movimento roda em cada celular; o servidor controla o tempo,
// quem chegou e em que ordem.
import crypto from 'node:crypto';

export const STAGE_COUNT = 30;
const ROULETTE_MS = 3000; // sorteio da fase (roleta na tela) antes da apresentação
const INTRO_MS = 5000; // apresentação da pista + contagem 3, 2, 1
/** Tempo total entre o anúncio da fase e a largada. */
export const INTRO_TOTAL = ROULETTE_MS + INTRO_MS;
const RACE_MAX_S = 180; // nenhuma fase passa de 3 minutos
const RESULTS_MS = 4500;
const MIN_RACE_MS = 25000; // ninguém termina uma fase (~360 m ou mais) em menos que isso

export function qualifyCount(n, round) {
  if (round >= 2) return 1;
  let q = Math.max(2, Math.ceil(n * (round === 0 ? 0.7 : 0.6)));
  if (q >= n && n > 2) q = n - 1;
  return Math.min(q, n);
}

function pickStages() {
  const all = Array.from({ length: STAGE_COUNT }, (_, i) => i);
  for (let i = all.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, 3);
}

// Comprimento (m) de cada fase, da largada até a chegada (medido montando as fases de stages.js;
// o teste test/stumble.test.js monta as fases e confere estes números). Uma pessoa leva de 1 a 2 minutos.
export const STAGE_LEN = [372, 399, 373, 383, 430, 365, 361, 398, 382, 370, 387, 372, 396, 381, 386, 399, 419, 390, 363, 423, 383, 399, 404, 380, 400, 366, 392, 368, 401, 361];
const stageLen = (s) => STAGE_LEN[s.stages[s.round]] || 380;
/** Tempo máximo da fase (s): justo para quem cai algumas vezes, sem deixar a partida arrastada. */
export const raceSeconds = (len) => Math.min(RACE_MAX_S, Math.round(len / 3 + 25));
/** Depois disso (s) os robôs terminam mesmo que alguém ainda esteja correndo. */
export const botFreeAfter = (len) => len / 4 + 10;
/** Tempo que cada robô leva para fazer a fase (em segundos): nem rápido demais, nem lento. */
function botPlan(s) {
  const len = stageLen(s);
  // A pessoa corre a ~7 m/s; os robôs, entre 4,2 e 6 m/s (mais um tropeço ou outro).
  s.botT = Object.fromEntries(s.alive.filter((id) => id < 0).map((id) => [id, len / (4.2 + Math.random() * 1.8) + Math.random() * 4]));
}

export function start(ids, now = Date.now()) {
  const s = {
    players: [...ids], alive: [...ids], stages: pickStages(), round: 0, phase: 'intro',
    phaseEndsAt: now + INTRO_TOTAL, raceStartAt: now + INTRO_TOTAL, rouletteEndsAt: now + ROULETTE_MS, finished: [], progress: {},
    qualify: qualifyCount(ids.length, 0), eliminated: [], winner: null, done: false, seed: crypto.randomInt(1e9),
  };
  botPlan(s);
  return s;
}

/** Robôs: chegam no tempo deles, mas deixam as vagas (e a vitória da final) para as pessoas. */
export function bot(s, now = Date.now()) {
  if (s.phase !== 'race') return false;
  const el = (now - s.raceStartAt) / 1000;
  let changed = false;
  for (const id of s.alive) {
    if (id > 0 || s.finished.includes(id)) continue;
    const T = s.botT?.[id] || 40;
    s.progress[id] = Math.min(0.99, el / T);
    if (el < T) continue;
    const humansLeft = s.alive.filter((x) => x > 0 && !s.finished.includes(x)).length;
    const slots = s.qualify - s.finished.length;
    const free = el > botFreeAfter(stageLen(s)) || (s.round >= 2 ? humansLeft === 0 : slots > humansLeft);
    if (!free) continue;
    s.finished.push(id);
    s.progress[id] = 1;
    changed = true;
    if (s.round >= 2) { toResults(s, now); return true; }
  }
  if (changed) tick(s, now);
  return changed;
}

function toResults(s, now) {
  // Faltou gente para completar as vagas: passam os que foram mais longe.
  if (s.finished.length < s.qualify) {
    const rest = s.alive.filter((id) => !s.finished.includes(id)).sort((a, b) => (s.progress[b] || 0) - (s.progress[a] || 0));
    if (s.round < 2) s.finished.push(...rest.slice(0, s.qualify - s.finished.length));
  }
  const passed = s.finished.slice(0, s.qualify);
  s.eliminated = s.alive.filter((id) => !passed.includes(id));
  s.alive = passed;
  s.phase = 'results';
  s.phaseEndsAt = now + RESULTS_MS;
  if (s.round >= 2 || s.alive.length <= 1) s.winner = s.alive[0] || null;
}

/** Avança as fases com o tempo. Devolve true quando algo mudou. */
export function tick(s, now = Date.now()) {
  if (s.done) return false;
  if (s.phase === 'intro' && now >= s.phaseEndsAt) {
    s.phase = 'race';
    s.raceStartAt = s.phaseEndsAt;
    s.phaseEndsAt = s.raceStartAt + raceSeconds(stageLen(s)) * 1000;
    return true;
  }
  if (s.phase === 'race') {
    const allIn = s.alive.every((id) => s.finished.includes(id));
    if (s.finished.length >= s.qualify || allIn || now >= s.phaseEndsAt || !s.alive.length) { toResults(s, now); return true; }
  }
  if (s.phase === 'results' && now >= s.phaseEndsAt) {
    if (s.winner || s.alive.length <= 1 || s.round >= 2) {
      s.winner = s.winner || s.alive[0] || null;
      s.done = true;
      s.phase = 'over';
      return true;
    }
    s.round++;
    s.phase = 'intro';
    s.finished = [];
    s.progress = {};
    s.eliminated = [];
    s.qualify = qualifyCount(s.alive.length, s.round);
    s.phaseEndsAt = now + INTRO_TOTAL;
    s.raceStartAt = s.phaseEndsAt;
    s.rouletteEndsAt = now + ROULETTE_MS;
    botPlan(s);
    return true;
  }
  return false;
}

export function act(s, id, a, _names, now = Date.now()) {
  if (!s.alive.includes(id)) return { error: 'Você foi eliminado nesta partida' };
  if (s.phase !== 'race') return { ok: true, quiet: true };
  if (a.type === 'progress') {
    const p = Number(a.p);
    if (Number.isFinite(p)) s.progress[id] = Math.max(s.progress[id] || 0, Math.min(1, p));
    return { ok: true, quiet: true };
  }
  if (a.type === 'finish') {
    if (s.finished.includes(id)) return { ok: true, quiet: true };
    if (now - s.raceStartAt < MIN_RACE_MS) return { error: 'Chegada inválida' };
    s.finished.push(id);
    s.progress[id] = 1;
    if (s.round >= 2 && s.finished.length === 1) toResults(s, now);
    else tick(s, now);
    return { ok: true };
  }
  return { error: 'Ação inválida' };
}

export function removePlayer(s, id) {
  s.alive = s.alive.filter((x) => x !== id);
  if (!s.alive.length) { s.done = true; s.phase = 'over'; }
  else if (s.alive.length === 1 && s.phase !== 'over') { s.winner = s.alive[0]; s.phase = 'results'; s.phaseEndsAt = Date.now() + RESULTS_MS; }
}

export function view(s) {
  return {
    stage: s.stages[s.round], stages: s.stages, round: s.round, phase: s.phase, phaseEndsAt: s.phaseEndsAt,
    raceStartAt: s.raceStartAt, rouletteEndsAt: s.rouletteEndsAt || 0, rouletteMs: ROULETTE_MS, alive: s.alive, finished: s.finished, qualify: s.qualify, eliminated: s.eliminated,
    winner: s.winner, now: Date.now(), seed: s.seed + s.round, botT: s.botT || {}, stageLen: stageLen(s),
  };
}
