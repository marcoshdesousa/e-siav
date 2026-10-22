import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [actor, setActor] = useState(undefined); // undefined = carregando
  const [meta, setMeta] = useState({ cargos: { desbravador: [], lideranca: [] }, districts: [] });

  // O app só funciona com internet: sem internet a conta não abre (aparece o aviso para conectar).
  const refresh = useCallback(async () => {
    try {
      const { actor } = await api.get('/auth/me');
      setActor(actor);
    } catch {
      setActor(null);
    }
  }, []);

  const refreshMeta = useCallback(() => api.get('/meta').then(setMeta).catch(() => {}), []);

  useEffect(() => {
    refresh();
    refreshMeta();
  }, [refresh, refreshMeta]);
  // A internet voltou: confere a conta de novo.
  useEffect(() => {
    const back = () => refresh();
    window.addEventListener('online', back);
    return () => window.removeEventListener('online', back);
  }, [refresh]);

  const login = async (mode, username, password) => {
    try {
      const { actor } = await api.post('/auth/login', { mode, username, password });
      setActor(actor);
      return actor;
    } catch (e) {
      if (e.offline) throw new Error('Sem internet. O App do DBV precisa de internet para funcionar.');
      throw e;
    }
  };
  const logout = async () => {
    await api.post('/auth/logout').catch(() => {});
    setActor(null);
  };

  return <AuthCtx.Provider value={{ actor, setActor, refresh, login, logout, meta, refreshMeta }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

export const homeFor = (actor) => ({ admin: '/admin', club: '/clube', unit: '/unidade', member: '/membro' })[actor?.type] || '/entrar';
