// Conexão com as salas online (/ws/online). Reconecta sozinha se a internet cair.
import { useCallback, useEffect, useRef, useState } from 'react';

export function useOnline(game) {
  const [state, setState] = useState({ connected: false, me: null, room: null, game: null, lobby: null, error: null, kicked: false });
  const wsRef = useRef(null);
  const handlers = useRef(new Set());
  const queue = useRef([]);

  useEffect(() => {
    let closed = false;
    let retry = 0;
    let timer = null;
    const connect = () => {
      const url = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/online`;
      const ws = new window.WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => {
        retry = 0;
        ws.send(JSON.stringify({ t: 'lobby', game }));
        for (const m of queue.current.splice(0)) ws.send(JSON.stringify(m));
      };
      ws.onmessage = (ev) => {
        let m;
        try { m = JSON.parse(ev.data); } catch { return; }
        for (const h of handlers.current) h(m);
        setState((s) => {
          switch (m.t) {
            case 'hello': return { ...s, connected: true, me: m.me, myName: m.name, error: null };
            case 'room': return { ...s, room: m.room, game: m.game, kicked: false };
            case 'left': return { ...s, room: null, game: null };
            case 'kicked': return { ...s, room: null, game: null, kicked: true };
            case 'lobby': return { ...s, lobby: m };
            case 'error': return { ...s, error: { msg: m.msg, at: Date.now() } };
            default: return s;
          }
        });
      };
      ws.onclose = (ev) => {
        setState((s) => ({ ...s, connected: false }));
        if (closed || ev.code === 4000) return;
        timer = setTimeout(connect, Math.min(8000, 800 * 2 ** retry++));
      };
    };
    connect();
    return () => { closed = true; clearTimeout(timer); wsRef.current?.close(); };
  }, [game]);

  const send = useCallback((m) => {
    const ws = wsRef.current;
    if (ws?.readyState === 1) ws.send(JSON.stringify(m));
    else queue.current.push(m);
  }, []);
  const listen = useCallback((h) => { handlers.current.add(h); return () => handlers.current.delete(h); }, []);
  return { ...state, send, listen };
}
