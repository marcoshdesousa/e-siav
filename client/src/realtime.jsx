import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { api } from './api.js';
import { useAuth } from './auth.jsx';

// Mensagens em tempo real via WebSocket, contador de não lidas e aviso de mensagem nova.
const RtCtx = createContext(null);

export function RealtimeProvider({ children }) {
  const { actor } = useAuth();
  const listeners = useRef(new Set());
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState(null);
  const activeConv = useRef(null);
  const chatEnabled = actor && (actor.type === 'member' || actor.type === 'club');

  const refreshUnread = useCallback(() => {
    if (chatEnabled) api.get('/chat/unread').then((r) => setUnread(r.total)).catch(() => {});
  }, [chatEnabled]);

  useEffect(() => {
    if (!chatEnabled) return;
    refreshUnread();
    let ws;
    let stop = false;
    let retry = 1000;
    const connect = () => {
      ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
      ws.onopen = () => (retry = 1000);
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        listeners.current.forEach((fn) => fn(data));
        if (data.type === 'message') {
          const mine = data.message.sender_type === actor.type && data.message.sender_id === actor.id;
          if (!mine && activeConv.current !== data.conversation_id) {
            setUnread((n) => n + 1);
            const who = data.message.sender?.name || 'Nova mensagem';
            const text = data.message.kind === 'audio' ? '🎤 Áudio' : data.message.kind === 'foto' ? '📷 Foto' : data.message.body;
            setToast({ id: Date.now(), who, text, conversation_id: data.conversation_id });
            if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
              try { new Notification(who, { body: text, icon: '/icons/icon-192.png' }); } catch { /* ignora */ }
            }
          }
        }
      };
      ws.onclose = () => {
        if (!stop) setTimeout(connect, (retry = Math.min(retry * 2, 15000)));
      };
    };
    connect();
    return () => {
      stop = true;
      ws?.close();
    };
  }, [chatEnabled, actor?.type, actor?.id, refreshUnread]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const subscribe = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  const value = { subscribe, unread, refreshUnread, toast, setToast, setActiveConversation: (id) => (activeConv.current = id) };
  return <RtCtx.Provider value={value}>{children}</RtCtx.Provider>;
}

export const useRealtime = () => useContext(RtCtx);
