// Stumble DBV: corrida de obstáculos com até 10 jogadores. Cada partida tem 3 fases sorteadas entre 20.
// Fase 1 e 2: os primeiros que cruzarem a chegada passam; quem sobra é eliminado. Fase 3 (final):
// quem chegar primeiro vence. O movimento roda em cada celular; o servidor controla o tempo,
// quem chegou e em que ordem.
import crypto from 'node:crypto';

export const STAGE_COUNT = 20;
const INTRO_MS = 5000;
const RACE_MS = 150_000;
const RESULTS_MS = 6000;
const MIN_RACE_MS = 9000; // ninguém termina uma fase em menos que isso

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

export function start(ids, now = Date.now()) {
  return {
    players: [...ids], alive: [...ids], stages: pickStages(), round: 0, phase: 'intro',
    phaseEndsAt: now + INTRO_MS, raceStartAt: now + INTRO_MS, finished: [], progress: {},
    qualify: qualifyCount(ids.length, 0), eliminated: [], winner: null, done: false, seed: crypto.randomInt(1e9),
  };
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
    s.phaseEndsAt = s.raceStartAt + RACE_MS;
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
    s.phaseEndsAt = now + INTRO_MS;
    s.raceStartAt = s.phaseEndsAt;
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
    raceStartAt: s.raceStartAt, alive: s.alive, finished: s.finished, qualify: s.qualify, eliminated: s.eliminated,
    winner: s.winner, now: Date.now(), seed: s.seed + s.round,
  };
}
