import { WebSocketServer } from 'ws';
import { actorFromToken, COOKIE } from './auth.js';

// Conexões abertas por conta: "member:12", "club:3" ...
const sockets = new Map();

export function attachRealtime(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws, req) => {
    const cookies = Object.fromEntries(
      (req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((p) => p.length >= 2).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]),
    );
    const actor = actorFromToken(cookies[COOKIE]);
    if (!actor || !['member', 'club'].includes(actor.type)) return ws.close(4001, 'unauthorized');
    const key = `${actor.type}:${actor.id}`;
    if (!sockets.has(key)) sockets.set(key, new Set());
    sockets.get(key).add(ws);
    ws.isAlive = true;
    ws.on('pong', () => (ws.isAlive = true));
    ws.on('close', () => {
      sockets.get(key)?.delete(ws);
      if (!sockets.get(key)?.size) sockets.delete(key);
    });
    ws.send(JSON.stringify({ type: 'hello' }));
  });
  const ping = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) ws.terminate();
      ws.isAlive = false;
      ws.ping();
    }
  }, 30000);
  wss.on('close', () => clearInterval(ping));
}

export function pushTo(keys, payload) {
  const data = JSON.stringify(payload);
  for (const key of keys) for (const ws of sockets.get(key) || []) if (ws.readyState === 1) ws.send(data);
}
