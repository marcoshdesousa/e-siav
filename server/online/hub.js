// Jogos online (Uno DBV e os próximos): salas pelo WebSocket /ws/online.
// - Partida rápida: entra numa sala aberta do mesmo tamanho (ou cria uma); começa sozinha quando enche.
// - Criar sala: pública ou privada, com código de 4 números; o dono expulsa e começa a partida.
// - Entrar com o código ou numa sala pública da lista.
// - Chat de voz: o servidor só repassa os sinais do WebRTC entre os jogadores da mesma sala.
import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';
import { actorFromToken, COOKIE } from '../auth.js';
import { run } from '../db.js';
import * as uno from './uno.js';

/** Jogos com sala. size: tamanhos de sala; quick: tamanhos da partida rápida; min: mínimo para começar. */
const GAMES = {
  uno: { name: 'Uno DBV', sizes: [2, 4, 6], quick: [2, 4], min: 2, logic: uno },
};

const rooms = new Map(); // id -> sala
const byCode = new Map(); // código -> sala
const memberRoom = new Map(); // membro -> id da sala
const conns = new Map(); // membro -> { ws, actor, lobby }
const LEAVE_WAITING_MS = 20_000; // caiu na sala de espera: sai se não voltar
const LEAVE_PLAYING_MS = 90_000; // caiu no meio da partida: as cartas voltam para o monte

const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || 'Jogador';

function newCode() {
  for (;;) {
    const c = String(crypto.randomInt(1000, 10000));
    if (!byCode.has(c)) return c;
  }
}

function send(memberId, msg) {
  const c = conns.get(memberId);
  if (c?.ws.readyState === 1) c.ws.send(JSON.stringify(msg));
}

const names = (room) => Object.fromEntries([...room.players.values()].map((p) => [p.id, p.name]));

function roomInfo(room) {
  return {
    id: room.id, game: room.game, code: room.code, public: room.public, quick: room.quick, size: room.size,
    owner: room.owner, status: room.status, min: GAMES[room.game].min,
    players: [...room.players.values()].map((p) => ({ id: p.id, name: p.name, photo: p.photo, connected: p.connected })),
    result: room.result || null,
  };
}

function broadcast(room) {
  const info = roomInfo(room);
  for (const p of room.players.values()) {
    send(p.id, { t: 'room', room: info, me: p.id, game: room.state ? GAMES[room.game].logic.view(room.state, p.id) : null });
  }
  if (room.public || room.quick) lobbyUpdate(room.game);
}

function lobbyList(game) {
  return [...rooms.values()]
    .filter((r) => r.game === game && r.public && !r.quick && r.status === 'waiting' && r.players.size < r.size)
    .map((r) => ({ code: r.code, size: r.size, count: r.players.size, owner: r.players.get(r.owner)?.name || '' }));
}
function online(game) {
  let n = 0;
  for (const c of conns.values()) if (c.lobby === game || rooms.get(memberRoom.get(c.actor.id))?.game === game) n++;
  return n;
}
let lobbyTimer = null;
function lobbyUpdate() {
  // Junta várias mudanças seguidas num aviso só.
  if (lobbyTimer) return;
  lobbyTimer = setTimeout(() => {
    lobbyTimer = null;
    for (const c of conns.values()) if (c.lobby) send(c.actor.id, { t: 'lobby', game: c.lobby, rooms: lobbyList(c.lobby), online: online(c.lobby) });
  }, 300);
}

function createRoom(game, { size, isPublic, quick, owner }) {
  const room = {
    id: crypto.randomUUID(), game, code: newCode(), public: !!isPublic, quick: !!quick, size,
    owner, status: 'waiting', players: new Map(), state: null, createdAt: Date.now(),
  };
  rooms.set(room.id, room);
  byCode.set(room.code, room);
  return room;
}

function closeRoom(room) {
  rooms.delete(room.id);
  byCode.delete(room.code);
  for (const id of room.players.keys()) if (memberRoom.get(id) === room.id) memberRoom.delete(id);
  lobbyUpdate();
}

function addPlayer(room, actor) {
  leaveRoom(actor.id, { silent: true });
  room.players.set(actor.id, { id: actor.id, name: firstName(actor.name), photo: actor.photo || null, connected: true, goneAt: null });
  memberRoom.set(actor.id, room.id);
  if (room.quick && room.status === 'waiting' && room.players.size >= room.size) startGame(room);
  else broadcast(room);
}

function leaveRoom(memberId, { silent = false, kicked = false } = {}) {
  const room = rooms.get(memberRoom.get(memberId));
  if (!room) return;
  room.players.delete(memberId);
  memberRoom.delete(memberId);
  if (kicked) send(memberId, { t: 'kicked' });
  if (!silent) send(memberId, { t: 'left' });
  if (room.status === 'playing' && room.state) {
    const logic = GAMES[room.game].logic;
    logic.removePlayer(room.state, memberId);
    // Ficou um só: a partida acaba sem vencedor (ninguém ganha vitória porque os outros saíram).
    if (room.state.order.length < 2) finishGame(room, null);
  }
  if (!room.players.size) return closeRoom(room);
  if (room.owner === memberId) room.owner = room.players.keys().next().value;
  broadcast(room);
}

function startGame(room) {
  const ids = [...room.players.keys()];
  room.state = GAMES[room.game].logic.start(ids);
  room.status = 'playing';
  room.result = null;
  room.startedWith = ids;
  broadcast(room);
}

/** Fim de partida: vitória para o vencedor e uma partida a mais para todos (ranking por vitórias). */
function finishGame(room, winner) {
  room.status = 'over';
  room.result = { winner, winnerName: winner ? room.players.get(winner)?.name || '' : null, at: Date.now() };
  for (const id of room.startedWith || []) {
    const win = id === winner ? 1 : 0;
    try {
      run(`INSERT INTO game_scores (member_id, game, best, total, plays) VALUES (?, ?, ?, ?, 1)
        ON CONFLICT (member_id, game) DO UPDATE SET best = max(best, excluded.best), total = total + excluded.total,
          plays = plays + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`, id, room.game, win, win);
    } catch (e) {
      console.error('[online] placar:', e.message);
    }
  }
  broadcast(room);
}

function onAction(actor, room, msg) {
  if (room.status !== 'playing') return;
  const logic = GAMES[room.game].logic;
  const r = logic.act(room.state, actor.id, msg, names(room));
  if (r.error) return send(actor.id, { t: 'error', msg: r.error });
  if (room.state.winner) return finishGame(room, room.state.winner);
  broadcast(room);
}

function handle(actor, msg) {
  const id = actor.id;
  const room = rooms.get(memberRoom.get(id));
  switch (msg.t) {
    case 'lobby': {
      if (!GAMES[msg.game]) return;
      conns.get(id).lobby = msg.game;
      send(id, { t: 'lobby', game: msg.game, rooms: lobbyList(msg.game), online: online(msg.game) });
      if (room) broadcast(room);
      return lobbyUpdate();
    }
    case 'quick': {
      const g = GAMES[msg.game];
      const size = Number(msg.size);
      if (!g || !g.quick.includes(size)) return;
      if (room && room.game === msg.game && room.quick && room.size === size && room.status === 'waiting') return broadcast(room);
      let r = [...rooms.values()].find((x) => x.game === msg.game && x.quick && x.size === size && x.status === 'waiting' && x.players.size < x.size && !x.players.has(id));
      if (!r) r = createRoom(msg.game, { size, quick: true, owner: id });
      return addPlayer(r, actor);
    }
    case 'create': {
      const g = GAMES[msg.game];
      const size = Number(msg.size);
      if (!g || !g.sizes.includes(size)) return;
      return addPlayer(createRoom(msg.game, { size, isPublic: !!msg.public, owner: id }), actor);
    }
    case 'join': {
      const r = byCode.get(String(msg.code || '').trim());
      if (!r || r.quick) return send(id, { t: 'error', msg: 'Sala não encontrada. Confira o código.' });
      if (r.players.has(id)) return broadcast(r);
      if (r.status !== 'waiting') return send(id, { t: 'error', msg: 'Essa partida já começou' });
      if (r.players.size >= r.size) return send(id, { t: 'error', msg: 'A sala está cheia' });
      return addPlayer(r, actor);
    }
    case 'leave': return leaveRoom(id);
    case 'kick': {
      if (!room || room.owner !== id || room.status === 'playing') return;
      const target = Number(msg.member);
      if (target !== id && room.players.has(target)) leaveRoom(target, { silent: true, kicked: true });
      return;
    }
    case 'start': {
      if (!room || room.owner !== id || room.status === 'playing') return;
      if (room.players.size < GAMES[room.game].min) return send(id, { t: 'error', msg: `Precisa de pelo menos ${GAMES[room.game].min} jogadores` });
      return startGame(room);
    }
    case 'again': {
      // Depois do fim: volta para a sala de espera (a rápida recomeça sozinha quando todos voltarem).
      if (!room || room.status !== 'over') return;
      room.status = 'waiting';
      room.state = null;
      room.result = null;
      for (const [pid, p] of room.players) if (!p.connected) room.players.delete(pid);
      if (room.quick && room.players.size >= room.size) return startGame(room);
      return broadcast(room);
    }
    case 'act': return room && onAction(actor, room, msg.action || {});
    case 'rtc': {
      // Sinais da voz (oferta, resposta, candidatos) só entre jogadores da mesma sala.
      const to = Number(msg.to);
      if (room && room.players.has(to) && to !== id) send(to, { t: 'rtc', from: id, data: msg.data });
      return;
    }
    case 'voice': {
      // Avisa a sala quem está com o microfone ligado (para mostrar o ícone).
      if (!room) return;
      const p = room.players.get(id);
      if (p) p.mic = !!msg.on;
      for (const q of room.players.values()) if (q.id !== id) send(q.id, { t: 'voice', from: id, on: !!msg.on });
      return;
    }
    default:
  }
}

// Relógio: vez que passou do tempo e jogadores que caíram e não voltaram.
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    for (const p of [...room.players.values()]) {
      if (p.connected || !p.goneAt) continue;
      const limit = room.status === 'playing' ? LEAVE_PLAYING_MS : LEAVE_WAITING_MS;
      if (now - p.goneAt > limit) leaveRoom(p.id, { silent: true });
    }
    if (room.status === 'playing' && room.state && !room.state.winner && now > room.state.turnEndsAt) {
      GAMES[room.game].logic.timeout(room.state, names(room));
      if (room.state.winner) finishGame(room, room.state.winner);
      else broadcast(room);
    }
    // Sala esquecida há mais de 6 horas some.
    if (now - room.createdAt > 6 * 3600_000 && room.status !== 'playing') closeRoom(room);
  }
}, 1000).unref();

export function attachOnline(server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  server.on('upgrade', (req, socket, head) => {
    if (!req.url.startsWith('/ws/online')) return;
    const cookies = Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((p) => p.length >= 2).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
    const actor = actorFromToken(cookies[COOKIE]);
    if (!actor || actor.type !== 'member' || actor.waiting) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      return socket.destroy();
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      // A mesma conta em outra aba: a conexão antiga é trocada pela nova.
      const old = conns.get(actor.id);
      if (old && old.ws !== ws) { old.replaced = true; old.ws.close(4000, 'outra aba'); }
      const conn = { ws, actor, lobby: null };
      conns.set(actor.id, conn);
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });
      let budget = 40;
      const refill = setInterval(() => { budget = 40; }, 1000);
      ws.on('message', (raw) => {
        if (--budget < 0) return; // mensagens demais por segundo
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }
        if (msg && typeof msg.t === 'string') {
          try { handle(actor, msg); } catch (e) { console.error('[online]', e); }
        }
      });
      ws.on('close', () => {
        clearInterval(refill);
        if (conns.get(actor.id) !== conn) return;
        conns.delete(actor.id);
        const room = rooms.get(memberRoom.get(actor.id));
        const p = room?.players.get(actor.id);
        if (p) { p.connected = false; p.goneAt = Date.now(); broadcast(room); }
        lobbyUpdate();
      });
      // Voltou depois de cair: retoma a mesma sala.
      const room = rooms.get(memberRoom.get(actor.id));
      const p = room?.players.get(actor.id);
      if (p) { p.connected = true; p.goneAt = null; broadcast(room); }
      ws.send(JSON.stringify({ t: 'hello', me: actor.id, name: firstName(actor.name), room: !!room }));
    });
  });
  const ping = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, 25_000);
  ping.unref();
  return wss;
}

export const onlineStats = () => ({ rooms: rooms.size, conns: conns.size });
