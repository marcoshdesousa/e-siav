import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [actor, setActor] = useState(undefined); // undefined = carregando
  const [meta, setMeta] = useState({ cargos: { desbravador: [], lideranca: [] }, districts: [] });

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

  const login = async (mode, username, password) => {
    const { actor } = await api.post('/auth/login', { mode, username, password });
    setActor(actor);
    return actor;
  };
  const logout = async () => {
    await api.post('/auth/logout');
    setActor(null);
  };

  return <AuthCtx.Provider value={{ actor, setActor, refresh, login, logout, meta, refreshMeta }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

export const homeFor = (actor) => ({ admin: '/admin', club: '/clube', unit: '/unidade', member: '/membro' })[actor?.type] || '/entrar';
