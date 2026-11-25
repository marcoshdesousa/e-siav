// Molduras da foto de perfil (desenhadas em SVG por cima da foto). A conta ganha molduras (álbum
// completo, mini-jogo do mês, ranking finalizado, requisito) e escolhe uma para usar.
import { useId, useState } from 'react';
import { Check, Frame as FrameIcon } from 'lucide-react';
import { api } from './api.js';
import { Avatar, Empty, Field, Loading, PageHeader, Section, notify, useLoad } from './ui.jsx';

// Cores: [claro, meio, escuro].
export const FRAME_PAL = {
  ouro: ['#fef3c7', '#f59e0b', '#92400e'],
  prata: ['#f8fafc', '#94a3b8', '#334155'],
  bronze: ['#ffedd5', '#c2410c', '#7c2d12'],
  azul: ['#bfdbfe', '#2563eb', '#1e3a8a'],
  vermelho: ['#fecaca', '#dc2626', '#7f1d1d'],
  verde: ['#bbf7d0', '#16a34a', '#14532d'],
  roxo: ['#e9d5ff', '#7c3aed', '#4c1d95'],
  rosa: ['#fbcfe8', '#db2777', '#831843'],
  laranja: ['#fed7aa', '#ea580c', '#7c2d12'],
  turquesa: ['#99f6e4', '#0d9488', '#134e4a'],
  noite: ['#c7d2fe', '#312e81', '#020617'],
  arco: ['#fde68a', '#8b5cf6', '#1e1b4b'],
};
export const FRAME_COLORS = [
  ['ouro', 'Ouro'], ['prata', 'Prata'], ['bronze', 'Bronze'], ['azul', 'Azul'], ['vermelho', 'Vermelho'], ['verde', 'Verde'],
  ['roxo', 'Roxo'], ['rosa', 'Rosa'], ['laranja', 'Laranja'], ['turquesa', 'Turquesa'], ['noite', 'Noite'], ['arco', 'Arco-íris'],
];
export const FRAME_STYLES = [['classica', 'Clássica'], ['louros', 'Louros'], ['estrelas', 'Estrelas'], ['joias', 'Joias'], ['chamas', 'Chamas']];
const RAINBOW = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

const C = 64; // centro do desenho (viewBox 128)
const R = 55; // raio do aro
const polar = (deg, r = R) => [C + r * Math.cos((deg - 90) * Math.PI / 180), C + r * Math.sin((deg - 90) * Math.PI / 180)];
const star = (x, y, r) => Array.from({ length: 10 }, (_, i) => {
  const a = (i * 36 - 90) * Math.PI / 180;
  const rr = i % 2 ? r * 0.45 : r;
  return `${(x + rr * Math.cos(a)).toFixed(2)},${(y + rr * Math.sin(a)).toFixed(2)}`;
}).join(' ');

function Decor({ style, pal, id }) {
  const [light, mid, dark] = pal;
  if (style === 'estrelas') {
    return Array.from({ length: 8 }, (_, i) => { const [x, y] = polar(i * 45 + 22.5); return <polygon key={i} points={star(x, y, 6.2)} fill={light} stroke={dark} strokeWidth="1" />; });
  }
  if (style === 'joias') {
    return Array.from({ length: 12 }, (_, i) => {
      const [x, y] = polar(i * 30);
      return <rect key={i} x={x - 3.6} y={y - 3.6} width="7.2" height="7.2" transform={`rotate(45 ${x} ${y})`} fill={i % 2 ? light : `url(#${id}g)`} stroke={dark} strokeWidth="1" />;
    });
  }
  if (style === 'chamas') {
    return Array.from({ length: 14 }, (_, i) => {
      const deg = -78 + i * 12;
      const [x1, y1] = polar(deg - 5, R + 3);
      const [x2, y2] = polar(deg + 5, R + 3);
      const [tx, ty] = polar(deg, R + 12 + (i % 2 ? 0 : 4));
      return <path key={i} d={`M${x1},${y1} Q${tx},${ty} ${tx},${ty} Q${tx},${ty} ${x2},${y2} Z`} fill={i % 2 ? mid : light} stroke={dark} strokeWidth=".8" strokeLinejoin="round" />;
    });
  }
  if (style === 'louros' || style === 'dbv') {
    const leaves = [];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 7; i++) {
        const deg = 180 + side * (32 + i * 17);
        const [x, y] = polar(deg, R + 2);
        leaves.push(<ellipse key={`${side}${i}`} cx={x} cy={y} rx="7" ry="3.2" transform={`rotate(${deg + side * 55} ${x} ${y})`} fill={i % 2 ? mid : light} stroke={dark} strokeWidth=".9" />);
      }
    }
    return leaves;
  }
  // Clássica: 4 pontos.
  return [0, 90, 180, 270].map((d) => { const [x, y] = polar(d); return <circle key={d} cx={x} cy={y} r="3.6" fill={light} stroke={dark} strokeWidth="1" />; });
}

/** A moldura sozinha (SVG), do tamanho da caixa onde for posta. */
export function FrameArt({ frame, square = false, compact = false }) {
  const raw = useId().replace(/:/g, '');
  const id = `fr${raw}`;
  const pal = FRAME_PAL[frame.color] || FRAME_PAL.ouro;
  const style = frame.style || 'classica';
  const [light, mid, dark] = style === 'dbv' ? ['#fde68a', '#d97706', '#7f1d1d'] : pal;
  const rainbow = frame.color === 'arco' && style !== 'dbv';
  const title = compact ? '' : frame.title;
  const sub = compact ? '' : frame.sub;
  const subW = Math.min(90, Math.max(42, (sub || '').length * 5.2 + 14));
  const fit = (t, max) => (t.length > max ? { textLength: max * 5.6, lengthAdjust: 'spacingAndGlyphs' } : {});
  const ring = square
    ? (w, stroke, extra = {}) => <rect x={C - R} y={C - R} width={R * 2} height={R * 2} rx="24" fill="none" stroke={stroke} strokeWidth={w} {...extra} />
    : (w, stroke, extra = {}) => <circle cx={C} cy={C} r={R} fill="none" stroke={stroke} strokeWidth={w} {...extra} />;
  return (
    <svg className="frame-art" viewBox="0 0 128 128" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          {rainbow ? RAINBOW.map((c, i) => <stop key={c} offset={i / (RAINBOW.length - 1)} stopColor={c} />)
            : <><stop offset="0" stopColor={light} /><stop offset=".45" stopColor={mid} /><stop offset="1" stopColor={dark} /></>}
        </linearGradient>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={style === 'dbv' ? '#dc2626' : mid} /><stop offset="1" stopColor={style === 'dbv' ? '#7f1d1d' : dark} />
        </linearGradient>
      </defs>
      {ring(11, dark)}
      {ring(8.5, `url(#${id}g)`)}
      {ring(1.4, light, { opacity: 0.85, strokeDasharray: style === 'joias' ? '2 3' : undefined })}
      {style === 'dbv' && !square && <circle cx={C} cy={C} r={R - 5.4} fill="none" stroke="#dc2626" strokeWidth="2.2" />}
      <Decor style={style} pal={[light, mid, dark]} id={id} />
      {style === 'dbv' && <polygon points={star(C, 9, 8)} fill="#fde047" stroke="#7f1d1d" strokeWidth="1.2" />}
      {title && (
        <g>
          <path d="M14,14 L24,10 L104,10 L114,14 L104,18 L104,27 L24,27 L24,18 Z" fill={`url(#${id}r)`} stroke={dark} strokeWidth="1" />
          <text x={C} y="21.6" textAnchor="middle" fontSize="8.6" fontWeight="800" fill="#fff" fontFamily="inherit" {...fit(title, 14)}>{title}</text>
        </g>
      )}
      {sub && (
        <g>
          <rect x={C - subW / 2} y="111" width={subW} height="14" rx="7" fill={`url(#${id}g)`} stroke={dark} strokeWidth="1.2" />
          <text x={C} y="121" textAnchor="middle" fontSize="8" fontWeight="800" fill={frame.color === 'noite' ? '#fff' : '#111827'} fontFamily="inherit" {...(sub.length > 15 ? { textLength: subW - 10, lengthAdjust: 'spacingAndGlyphs' } : {})}>{sub}</text>
        </g>
      )}
      {frame.place ? (
        <g>
          <circle cx="108" cy="104" r="9" fill={['#f59e0b', '#94a3b8', '#c2410c'][frame.place - 1] || mid} stroke="#fff" strokeWidth="1.6" />
          <text x="108" y="107.4" textAnchor="middle" fontSize="9.5" fontWeight="900" fill="#fff" fontFamily="inherit">{frame.place}</text>
        </g>
      ) : null}
    </svg>
  );
}

/** Foto de perfil com a moldura (se tiver). */
export function FramedAvatar({ frame, src, name, size = 104, square = false }) {
  if (!frame) return <Avatar src={src} name={name} size={size} square={square} />;
  return (
    <span className="framed" style={{ width: size, height: size, margin: `${size * 0.16}px ${size * 0.14}px ${size * 0.12}px` }}>
      <Avatar src={src} name={name} size={size} square={square} />
      <FrameArt frame={frame} square={square} compact={size < 70} />
    </span>
  );
}

const SOURCE = { album: 'Álbum completo', jogo: 'Mini-jogo do mês', ranking: 'Ranking', requisito: 'Requisito' };

/** Minhas molduras: escolher qual usar (ou nenhuma). */
export function FramesPage({ photo, name, square = false }) {
  const state = useLoad(() => api.get('/me/molduras'));
  const [busy, setBusy] = useState(null);
  const choose = async (id) => {
    setBusy(id ?? 0);
    try {
      await api.put('/me/moldura', { id });
      notify(id ? 'Moldura colocada!' : 'Moldura retirada');
      state.reload();
    } catch (e) { notify(e.message, 'error'); } finally { setBusy(null); }
  };
  return (
    <>
      <PageHeader title="Molduras" subtitle="Ganhe molduras nos rankings, nos mini-jogos do mês, em requisitos e completando o álbum" />
      <Loading {...state}>
        {(d) => (
          <>
            <div className="frame-hero"><FramedAvatar frame={d.current} src={photo} name={name} size={120} square={square} /></div>
            {!d.frames.length ? <Empty icon={FrameIcon}>Você ainda não ganhou molduras. Complete o álbum, vença um mini-jogo do mês ou fique no pódio de um ranking!</Empty> : (
              <Section title={`Suas molduras (${d.frames.length})`}>
                <div className="frame-grid">
                  <button type="button" className={'frame-pick' + (!d.current ? ' on' : '')} onClick={() => choose(null)} disabled={busy != null}>
                    <span className="frame-pick-art"><Avatar src={photo} name={name} size={64} square={square} /></span>
                    <b>Sem moldura</b>
                    {!d.current && <i><Check size={14} /></i>}
                  </button>
                  {d.frames.map((f) => (
                    <button key={f.id} type="button" className={'frame-pick' + (d.current?.id === f.id ? ' on' : '')} onClick={() => choose(f.id)} disabled={busy != null}>
                      <span className="frame-pick-art"><FramedAvatar frame={f} src={photo} name={name} size={64} square={square} /></span>
                      <b>{f.title || SOURCE[f.source]}</b>
                      <small>{[f.sub, f.note || SOURCE[f.source]].filter(Boolean).join(' · ')}</small>
                      {d.current?.id === f.id && <i><Check size={14} /></i>}
                    </button>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </Loading>
    </>
  );
}

/** Estúdio da moldura: quem entrega (clube, distrito, app) escolhe o estilo, a cor e os textos. */
export function FrameStudio({ value, onChange, sample = 'Desbravador' }) {
  const f = value;
  const set = (patch) => onChange({ ...f, ...patch });
  return (
    <div className="frame-studio">
      <div className="frame-hero small"><FramedAvatar frame={f} name={sample} size={92} /></div>
      <Field group label="Estilo">
        <div className="chip-pick">
          {FRAME_STYLES.map(([k, l]) => <button key={k} type="button" className={f.style === k ? 'on' : ''} onClick={() => set({ style: k })}>{l}</button>)}
        </div>
      </Field>
      <Field group label="Cor">
        <div className="frame-colors">
          {FRAME_COLORS.map(([k, l]) => {
            const p = FRAME_PAL[k];
            const bg = k === 'arco' ? `conic-gradient(${RAINBOW.join(',')}, ${RAINBOW[0]})` : `linear-gradient(135deg, ${p[0]}, ${p[1]} 50%, ${p[2]})`;
            return <button key={k} type="button" title={l} aria-label={l} className={f.color === k ? 'on' : ''} style={{ background: bg }} onClick={() => set({ color: k })} />;
          })}
        </div>
      </Field>
      <Field label="Texto em cima" hint="Até 22 letras"><input value={f.title} maxLength={22} onChange={(e) => set({ title: e.target.value })} placeholder="Ex.: Campeões 2027" /></Field>
      <Field label="Texto embaixo" hint="Até 12 letras (ex.: o ano)"><input value={f.sub} maxLength={12} onChange={(e) => set({ sub: e.target.value })} placeholder="Ex.: 2027" /></Field>
    </div>
  );
}

export const newFrame = (title = '', sub = String(new Date().getFullYear())) => ({ style: 'louros', color: 'ouro', title, sub });

