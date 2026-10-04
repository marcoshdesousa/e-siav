import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Camera, Compass, Medal, Share2, X } from 'lucide-react';
import { AppIcon, ICONS } from './icons.jsx';

// ---------- Marca ----------
export const LogoIcon = ({ size = 40 }) => <img src="/logo.svg" width={size} height={size} alt="" className="logo-icon" />;

export function LogoHorizontal({ light = false, size = 36 }) {
  return (
    <span className={'logo-h' + (light ? ' light' : '')}>
      <LogoIcon size={size} />
      <span className="logo-text">
        <small>App do</small>
        <b>DBV</b>
      </span>
    </span>
  );
}

// ---------- Avisos rápidos ----------
export function notify(text, kind = 'ok') {
  window.dispatchEvent(new CustomEvent('dbv-notice', { detail: { text, kind, id: Math.random() } }));
}

export function Notices() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const on = (e) => {
      setItems((x) => [...x, e.detail]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== e.detail.id)), 3500);
    };
    window.addEventListener('dbv-notice', on);
    return () => window.removeEventListener('dbv-notice', on);
  }, []);
  return (
    <div className="notices" aria-live="polite">
      {items.map((i) => (
        <div key={i.id} className={'notice ' + i.kind}>{i.text}</div>
      ))}
    </div>
  );
}

// ---------- Dados ----------
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await fnRef.current();
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error });
    }
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, deps);
  return { ...state, reload, setData: (d) => setState((s) => ({ ...s, data: typeof d === 'function' ? d(s.data) : d })) };
}

export function Loading({ data, loading, error, children, empty }) {
  if (error) return <div className="empty error">{error.message}</div>;
  if (loading && !data) return <Spinner />;
  if (empty && (!data || (Array.isArray(data) && !data.length))) return <Empty>{empty}</Empty>;
  return children(data);
}

export const Spinner = () => <div className="spinner" aria-label="Carregando" />;
/** icon: chave de ICONS (ex.: "medal") ou componente Lucide. */
export const Empty = ({ children, icon = Compass }) => {
  const Cmp = typeof icon === 'string' ? ICONS[icon]?.[0] || Compass : icon;
  return (
  <div className="empty">
    <div className="empty-icon"><Cmp size={30} strokeWidth={1.75} /></div>
    <div>{children}</div>
  </div>
  );
};

// ---------- Formulários ----------
export function Button({ variant = 'primary', small, block, busy, children, ...p }) {
  return (
    <button className={`btn btn-${variant}${small ? ' btn-sm' : ''}${block ? ' btn-block' : ''}`} disabled={busy || p.disabled} {...p}>
      {busy ? <span className="btn-spin" /> : null}
      {children}
    </button>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      {label && <span className="field-label">{label}</span>}
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function useAsync() {
  const [busy, setBusy] = useState(false);
  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      const r = await fn();
      if (okMsg) notify(okMsg);
      return r;
    } catch (e) {
      notify(e.message, 'error');
      throw e;
    } finally {
      setBusy(false);
    }
  };
  return [busy, run];
}

export function ImagePicker({ value, onChange, label = 'Foto', round = true, name }) {
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (value instanceof File) {
      const u = URL.createObjectURL(value);
      setPreview(u);
      return () => URL.revokeObjectURL(u);
    }
    setPreview(typeof value === 'string' ? value : null);
  }, [value]);
  return (
    <label className="image-picker">
      <span className={'image-picker-preview' + (round ? ' round' : '')}>
        {preview ? <img src={preview} alt="" /> : <span>{name ? initials(name) : <Camera size={26} />}</span>}
      </span>
      <span className="image-picker-label">{label}<small>Toque para escolher</small></span>
      <input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && onChange(e.target.files[0])} />
    </label>
  );
}

// ---------- Layout ----------
export function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('modal-open');
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={22} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(([k, label, count]) => (
        <button key={k} role="tab" aria-selected={value === k} className={value === k ? 'active' : ''} onClick={() => onChange(k)}>
          {label}
          {count ? <span className="tab-count">{count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export const Card = ({ children, className = '', ...p }) => <div className={'card ' + className} {...p}>{children}</div>;

export function PageHeader({ title, subtitle, action, back }) {
  return (
    <div className="page-header">
      <div>
        {back && <Link to={back} className="back-link ico"><ArrowLeft size={16} /> Voltar</Link>}
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export const Section = ({ title, action, children }) => (
  <section className="section">
    {(title || action) && (
      <div className="section-head">
        <h2>{title}</h2>
        {action}
      </div>
    )}
    {children}
  </section>
);

export const Badge = ({ kind = 'neutral', children }) => <span className={'badge badge-' + kind}>{children}</span>;

const STATE_KIND = { pendente: 'blue', enviado: 'yellow', aprovado: 'green', recusado: 'red', fora_do_prazo: 'red' };
export function StateBadge({ state, late }) {
  const label = { pendente: 'Pendente', enviado: 'Enviado', aprovado: 'Aprovado', recusado: 'Recusado', fora_do_prazo: 'Fora do prazo' }[state];
  return (
    <span className="badges">
      <Badge kind={STATE_KIND[state]}>{label}</Badge>
      {late && state !== 'fora_do_prazo' ? <Badge kind="red">Fora do prazo</Badge> : null}
    </span>
  );
}

export const Stat = ({ icon: Ico, value, label, to, accent }) => {
  const inner = (
    <>
      <span className="stat-icon"><Ico size={22} /></span>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </>
  );
  return to ? <Link to={to} className={'stat' + (accent ? ' accent' : '')}>{inner}</Link> : <div className={'stat' + (accent ? ' accent' : '')}>{inner}</div>;
};

// ---------- Pessoas e conquistas ----------
export function initials(name = '') {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

const AVATAR_COLORS = ['#0B3D91', '#D62828', '#1F7A4D', '#7A3E9D', '#D9822B', '#146C94'];
export function Avatar({ src, name, size = 44, square = false }) {
  const color = AVATAR_COLORS[(name || '').length % AVATAR_COLORS.length];
  return (
    <span className={'avatar' + (square ? ' square' : '')} style={{ width: size, height: size, fontSize: size * 0.38, background: src ? '#fff' : color }}>
      {src ? <img src={src} alt="" /> : initials(name)}
    </span>
  );
}

export const MedalIcon = ({ icon, size = 30 }) => <AppIcon name={icon} size={size} fallback={Medal} strokeWidth={1.9} />;

export function MedalList({ medals }) {
  if (!medals?.length) return <Empty icon="medal">Nenhuma medalha ou troféu ainda.</Empty>;
  return (
    <div className="medal-grid">
      {medals.map((m) => (
        <div key={m.id} className={'medal ' + m.kind} title={m.description}>
          <span className="medal-icon"><MedalIcon icon={m.icon} /></span>
          <b>{m.name}</b>
          {m.note && <small>{m.note}</small>}
        </div>
      ))}
    </div>
  );
}

export function PositionBadge({ position, label, points }) {
  if (!position) return null;
  return (
    <div className={'position-badge' + (position <= 3 ? ' podium-' + position : '')}>
      <span className="pos">{position}º</span>
      <span className="pos-label">{label}<small>{points} pts</small></span>
    </div>
  );
}

export function ShareButton({ path, title }) {
  const url = location.origin + path;
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title, url }); return; } catch { /* cancelado */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      notify('Link copiado!');
    } catch {
      prompt('Copie o link do perfil:', url);
    }
  };
  return <Button variant="secondary" small onClick={share}><Share2 size={15} /> Compartilhar perfil</Button>;
}

export function Confirm({ text, onYes, children, variant = 'danger', small = true }) {
  return <Button variant={variant} small={small} onClick={() => confirm(text) && onYes()}>{children}</Button>;
}
