import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { forgetActor, offlineLogin, rememberLogin, saveActor, savedActor } from './offline.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [actor, setActor] = useState(undefined); // undefined = carregando
  const [meta, setMeta] = useState({ cargos: { desbravador: [], lideranca: [] }, districts: [] });

  // Senha digitada no login sem internet (só na memória): quando a internet volta, entra de verdade.
  const pending = useRef(null);
  const actorRef = useRef(actor);
  actorRef.current = actor;
  const refresh = useCallback(async () => {
    try {
      const { actor } = await api.get('/auth/me');
      setActor(actor);
      saveActor(actor);
    } catch (e) {
      // Sem internet: abre com a última conta de membro deste aparelho.
      setActor(e.offline ? savedActor() : null);
    }
  }, []);

  const refreshMeta = useCallback(() => api.get('/meta').then(setMeta).catch(() => {}), []);

  useEffect(() => {
    refresh();
    refreshMeta();
  }, [refresh, refreshMeta]);

  // A internet voltou: se a pessoa entrou sem internet, entra de verdade (para sincronizar).
  useEffect(() => {
    const back = async () => {
      if (pending.current) {
        const { mode, username, password } = pending.current;
        try {
          const { actor } = await api.post('/auth/login', { mode, username, password });
          pending.current = null;
          setActor(actor);
          saveActor(actor);
          return;
        } catch { /* continua offline */ }
      }
      if (actorRef.current?.offline) {
        try { const { actor } = await api.get('/auth/me'); setActor(actor); saveActor(actor); } catch { /* continua offline */ }
      }
    };
    window.addEventListener('online', back);
    return () => window.removeEventListener('online', back);
  }, []);

  const login = async (mode, username, password) => {
    try {
      const { actor } = await api.post('/auth/login', { mode, username, password });
      setActor(actor);
      saveActor(actor);
      rememberLogin(mode, username, password, actor);
      return actor;
    } catch (e) {
      if (!e.offline) throw e;
      const local = await offlineLogin(mode, username, password);
      if (!local) {
        const err = new Error('Sem internet. Para entrar sem internet, você precisa já ter entrado uma vez neste aparelho com essa senha.');
        throw err;
      }
      pending.current = { mode, username, password };
      setActor(local);
      saveActor(local);
      return local;
    }
  };
  const logout = async () => {
    await api.post('/auth/logout').catch(() => {});
    pending.current = null;
    forgetActor();
    setActor(null);
  };

  return <AuthCtx.Provider value={{ actor, setActor, refresh, login, logout, meta, refreshMeta }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

export const homeFor = (actor) => ({ admin: '/admin', club: '/clube', unit: '/unidade', member: '/membro' })[actor?.type] || '/entrar';
