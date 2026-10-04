import { useEffect, useState } from 'react';
import { AtSign, Check, X } from 'lucide-react';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Button, LogoIcon, notify } from '../../ui.jsx';

const suggest = (name) => {
  const p = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/);
  return p.length > 1 ? `${p[0]}.${p[p.length - 1]}` : p[0] || '';
};

/** Campo do @ com verificação na hora (disponível / em uso). */
export function HandleField({ value, onChange, status }) {
  return (
    <div className={'handle-field ' + (status?.ok ? 'ok' : status ? 'bad' : '')}>
      <span className="handle-at"><AtSign size={20} /></span>
      <input value={value} onChange={(e) => onChange(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 20))} placeholder="seu.arroba" autoCapitalize="none" autoComplete="off" spellCheck={false} autoFocus />
      {status && <span className="handle-state">{status.ok ? <Check size={18} /> : <X size={18} />}</span>}
    </div>
  );
}

export function useHandleCheck(value) {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    if (value.length < 3) return setStatus(value ? { ok: false, error: 'Mínimo de 3 caracteres' } : null);
    const t = setTimeout(() => api.get('/me/handle/check?h=' + encodeURIComponent(value)).then(setStatus).catch(() => {}), 300);
    return () => clearTimeout(t);
  }, [value]);
  return status;
}

/** Primeiro acesso do membro: escolher o @ (é por ele que as pessoas mandam mensagem). */
export default function HandleSetup() {
  const { actor, refresh, logout } = useAuth();
  const [value, setValue] = useState(() => suggest(actor.name));
  const status = useHandleCheck(value);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api.put('/me/handle', { handle: value });
      notify('Pronto! Seu @ foi criado.');
      await refresh();
    } catch (e) {
      notify(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="handle-page">
      <div className="handle-card">
        <LogoIcon size={84} />
        <h1>Escolha o seu @</h1>
        <p className="muted">Olá, {actor.name.split(' ')[0]}! É pelo seu @ que os outros membros encontram você no chat. Ele aparece no seu perfil.</p>
        <HandleField value={value} onChange={setValue} status={status} />
        <p className={'handle-msg ' + (status?.ok ? 'ok' : '')}>{status ? (status.ok ? 'Disponível!' : status.error) : 'Letras minúsculas, números, ponto ou _'}</p>
        <Button block busy={busy} disabled={!status?.ok} onClick={save}>Continuar</Button>
        <button type="button" className="ig-link" style={{ marginTop: '1rem' }} onClick={logout}>Sair</button>
      </div>
    </div>
  );
}
