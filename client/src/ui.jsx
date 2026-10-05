import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Camera, Check, ChevronDown, ChevronUp, Compass, ImagePlus, Medal, Share2, Trash2, X } from 'lucide-react';
import { AppIcon, ICONS } from './icons.jsx';

// ---------- Marca ----------
export const LogoIcon = ({ size = 40 }) => (
  <img src="/logo.svg" width={size} height={size} alt="App do DBV" className="logo-icon" />
);

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

/** group: para grupos de botões (o rótulo não fica preso ao primeiro botão). */
export function Field({ label, hint, children, group = false }) {
  const Tag = group ? 'div' : 'label';
  return (
    <Tag className="field" role={group ? 'group' : undefined} aria-label={group ? label : undefined}>
      {label && <span className="field-label">{label}</span>}
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </Tag>
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
    <span className={'avatar' + (square ? ' square' : '')} style={{ width: size, height: size, fontSize: size * 0.38, background: src ? 'var(--surface)' : color }}>
      {src ? <img src={src} alt="" /> : initials(name)}
    </span>
  );
}

export const MedalIcon = ({ icon, size = 30 }) => <AppIcon name={icon} size={size} fallback={Medal} strokeWidth={1.9} />;

/**
 * Seção que mostra os itens em uma única fileira; se não couberem,
 * aparece o botão "Ver mais" para abrir todos.
 */
export function RowSection({ title, items, render, empty, emptyIcon }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflow(open || el.scrollWidth > el.clientWidth + 2);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items, open]);
  const count = items?.length || 0;
  return (
    <Section
      title={`${title}${count ? ` (${count})` : ''}`}
      action={overflow ? (
        <button type="button" className="see-more" onClick={() => setOpen((o) => !o)}>
          {open ? <>Ver menos <ChevronUp size={14} /></> : <>Ver mais <ChevronDown size={14} /></>}
        </button>
      ) : null}
    >
      {count ? <div ref={ref} className={'one-row' + (open ? ' open' : overflow ? ' fade' : '')}>{items.map(render)}</div> : <Empty icon={emptyIcon}>{empty}</Empty>}
    </Section>
  );
}

export function MedalCard({ m }) {
  return (
    <div className={'medal ' + m.kind} title={m.description}>
      <span className="medal-icon"><MedalIcon icon={m.icon} /></span>
      <b>{m.name}</b>
      {m.note && <small>{m.note}</small>}
    </div>
  );
}

export const MedalList = ({ medals }) => (
  <RowSection title="Medalhas e troféus" items={medals} empty="Nenhuma medalha ou troféu ainda." emptyIcon="medal" render={(m) => <MedalCard key={m.id} m={m} />} />
);

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

// ---------- Formas de envio (relatório, foto, quiz) ----------
export const MODE_INFO = {
  texto: ['Relatório', 'Texto escrito pelo membro'],
  foto: ['Foto', 'Uma ou mais fotos'],
  quiz: ['Quiz', 'Perguntas de múltipla escolha'],
};

/** Escolha livre: qualquer combinação (nenhuma = só "marcar como feito", quando permitido). */
export function ModesPicker({ value, onChange, allowNone = false }) {
  const toggle = (m) => onChange(value.includes(m) ? value.filter((x) => x !== m) : ['texto', 'foto', 'quiz'].filter((x) => x === m || value.includes(x)));
  return (
    <div className="modes-picker">
      {Object.entries(MODE_INFO).map(([k, [label, hint]]) => (
        <button key={k} type="button" className={value.includes(k) ? 'on' : ''} onClick={() => toggle(k)} aria-pressed={value.includes(k)}>
          <span className="modes-check">{value.includes(k) ? <Check size={14} strokeWidth={3} /> : null}</span>
          <span><b>{label}</b><small>{hint}</small></span>
        </button>
      ))}
      {allowNone && !value.length && <p className="field-hint">Sem forma de envio: o membro só marca como feito.</p>}
    </div>
  );
}

export const modesLabel = (modes = []) => (modes.length ? modes.map((m) => MODE_INFO[m][0]).join(' + ') : 'Marcar como feito');

/** Fotos de exemplo: mantém as já salvas (urls) e adiciona novas (arquivos). */
export function ImagesInput({ urls = [], files = [], onUrls, onFiles, label = 'Fotos de exemplo', max = 6 }) {
  const previews = files.map((f) => ({ f, url: URL.createObjectURL(f) }));
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)));
  const total = urls.length + files.length;
  return (
    <div className="images-input">
      <span className="field-label">{label}</span>
      <div className="thumbs">
        {urls.map((u) => (
          <span key={u} className="thumb"><img src={u} alt="" /><button type="button" aria-label="Remover" onClick={() => onUrls(urls.filter((x) => x !== u))}><X size={14} /></button></span>
        ))}
        {previews.map((p, i) => (
          <span key={i} className="thumb"><img src={p.url} alt="" /><button type="button" aria-label="Remover" onClick={() => onFiles(files.filter((x) => x !== p.f))}><X size={14} /></button></span>
        ))}
        {total < max && (
          <label className="thumb add">
            <ImagePlus size={22} />
            <input type="file" accept="image/*" multiple hidden onChange={(e) => { onFiles([...files, ...e.target.files].slice(0, max - urls.length)); e.target.value = ''; }} />
          </label>
        )}
      </div>
    </div>
  );
}

/** Galeria das fotos de exemplo, com ampliação ao tocar. */
export function Gallery({ images }) {
  const [open, setOpen] = useState(null);
  if (!images?.length) return null;
  return (
    <>
      <div className="gallery">{images.map((u) => <img key={u} src={u} alt="Exemplo" onClick={() => setOpen(u)} />)}</div>
      {open && <div className="lightbox" onClick={() => setOpen(null)}><img src={open} alt="" /></div>}
    </>
  );
}

/** Ícone de conteúdo: usa a imagem/insígnia enviada pelo admin ou o ícone escolhido. */
export function ContentIcon({ c, size = 26 }) {
  return c.image ? <img src={c.image} alt="" className="content-img" /> : <AppIcon name={c.icon} size={size} />;
}

export function QuizBuilder({ questions, setQuestions }) {
  const upd = (i, patch) => setQuestions(questions.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  return (
    <div className="stack">
      {questions.map((q, i) => (
        <div key={i} className="quiz-q stack">
          <div className="row between"><b>Pergunta {i + 1}</b><button type="button" className="icon-btn" aria-label="Remover pergunta" onClick={() => setQuestions(questions.filter((_, k) => k !== i))}><Trash2 size={18} /></button></div>
          <input placeholder="Enunciado" value={q.question} onChange={(e) => upd(i, { question: e.target.value })} />
          {q.options.map((o, j) => (
            <div key={j} className="row">
              <input type="radio" name={'c' + i + '-' + questions.length} checked={q.correct === j} onChange={() => upd(i, { correct: j })} title="Resposta correta" />
              <input placeholder={`Opção ${j + 1}`} value={o} onChange={(e) => upd(i, { options: q.options.map((x, k) => (k === j ? e.target.value : x)) })} />
              {q.options.length > 2 && <button type="button" className="icon-btn" aria-label="Remover opção" onClick={() => upd(i, { options: q.options.filter((_, k) => k !== j), correct: q.correct >= j && q.correct > 0 ? q.correct - 1 : q.correct })}><X size={16} /></button>}
            </div>
          ))}
          <div className="row">
            {q.options.length < 6 && <Button type="button" small variant="secondary" onClick={() => upd(i, { options: [...q.options, ''] })}>+ Opção</Button>}
            <span className="muted small">Marque a bolinha da resposta correta</span>
          </div>
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={() => setQuestions([...questions, { question: '', options: ['', ''], correct: 0 }])}>+ Adicionar pergunta</Button>
    </div>
  );
}

/** Responder um quiz (lista de perguntas com opções). */
export function QuizAnswer({ questions, answers, setAnswers }) {
  return questions.map((q, i) => (
    <div key={q.id ?? i} className="quiz-q">
      <h4>{i + 1}. {q.question}</h4>
      {q.options.map((o, j) => (
        <label key={j} className={'quiz-opt' + (answers[i] === j ? ' selected' : '')}>
          <input type="radio" name={'q' + (q.id ?? i)} checked={answers[i] === j} onChange={() => setAnswers(answers.map((x, k) => (k === i ? j : x)))} />
          {o}
        </label>
      ))}
    </div>
  ));
}
