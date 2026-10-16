// Aba Skin dos jogos: o membro monta o seu personagem peça por peça (pele, cabelo, chapéu, camisa,
// calça/bermuda/saia, calçado e lenço). A prévia mostra o personagem grande e o pequenininho (Stumble).
import { useEffect, useRef, useState } from 'react';
import { Check, Shuffle } from 'lucide-react';
import { api } from '../../../api.js';
import {
  BOTTOMS, HAIR_COLORS, HAIRS, HATS, PALETTE, PRESET_IDS, SHOES, SKIN_TONES, TOPS,
  decodeLook, encodeLook, readChoice, saveChoice, syncChoice,
} from './skins.js';
import SkinPreview from './SkinPreview.jsx';
import SkinThumb from './SkinThumb.jsx';
import './skin.css';

const TABS = [['pele', 'Pele'], ['cabelo', 'Cabelo'], ['chapeu', 'Chapéu'], ['camisa', 'Camisa'], ['calca', 'Calça e saia'], ['sapato', 'Calçado'], ['extras', 'Extras'], ['prontos', 'Prontos']];

function Swatch({ color, on, onClick, label }) {
  return (
    <button type="button" className={'look-swatch' + (on ? ' on' : '')} style={{ '--c': color }} onClick={onClick} aria-pressed={on} aria-label={label} title={label}>
      {on && <Check size={14} strokeWidth={3} />}
    </button>
  );
}
function Option({ on, onClick, color, color2, children }) {
  return (
    <button type="button" className={'look-opt' + (on ? ' on' : '')} onClick={onClick} aria-pressed={on}>
      {color && <span className="look-dot" style={{ '--c': color, '--c2': color2 || color }} />}
      <span>{children}</span>
      {on && <Check size={14} strokeWidth={3} className="look-check" />}
    </button>
  );
}

export default function SkinPage() {
  const [look, setLook] = useState(() => decodeLook(readChoice().skin));
  const [tab, setTab] = useState('camisa');
  const [saved, setSaved] = useState(false);
  const timer = useRef(0);
  useEffect(() => { syncChoice().then((c) => setLook(decodeLook(c.skin))); }, []);
  const code = encodeLook(look);
  const pick = (patch) => {
    const next = { ...look, ...patch };
    if (next.g === 'm' && BOTTOMS[next.bottom].girls) next.bottom = 0;
    if (next.g === 'm' && next.hair === 4) next.hair = 0;
    setLook(next);
    const c = { skin: encodeLook(next) };
    saveChoice(c);
    setSaved(false);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => api.put('/jogos/skin', c).then(() => setSaved(true)).catch(() => {}), 600);
  };
  const random = () => {
    const r = (n) => Math.floor(Math.random() * n);
    const bottoms = BOTTOMS.map((b, i) => [b, i]).filter(([b]) => look.g === 'f' || !b.girls);
    pick({
      skin: r(SKIN_TONES.length), hair: r(look.g === 'f' ? HAIRS.length : 3), hairColor: r(HAIR_COLORS.length - 1), hat: Math.random() < 0.6 ? 0 : r(HATS.length),
      hatColor: r(PALETTE.length), top: r(TOPS.length), bottom: bottoms[r(bottoms.length)][1], shoes: r(SHOES.length), scarf: r(2),
    });
  };
  const top = TOPS[look.top];
  return (
    <div className="skin-page">
      <div className="skin-stages">
        <SkinPreview mode="surf" skin={code} label="Grande" />
        <SkinPreview mode="stumble" skin={code} label="Stumble DBV" />
      </div>
      <div className="skin-now">
        <div className="skin-gender">
          <button type="button" className={look.g === 'm' ? 'active m' : 'm'} onClick={() => pick({ g: 'm' })}>Menino</button>
          <button type="button" className={look.g === 'f' ? 'active f' : 'f'} onClick={() => pick({ g: 'f', beard: 0 })}>Menina</button>
        </div>
        <button type="button" className="look-random" onClick={random}><Shuffle size={16} /> Sortear</button>
        <span className={'skin-saved' + (saved ? ' on' : '')}><Check size={14} /> {saved ? 'Salvo' : 'Vale para todos os jogos'}</span>
      </div>
      <div className="look-tabs" role="tablist">
        {TABS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      <div className="look-panel">
        {tab === 'pele' && (
          <div className="look-swatches">{SKIN_TONES.map((c, i) => <Swatch key={c} color={c === '#ffffff' ? '#f6dccb' : c} on={look.skin === i} onClick={() => pick({ skin: i })} label={`Tom ${i + 1}`} />)}</div>
        )}
        {tab === 'cabelo' && (
          <>
            <div className="look-grid">
              {HAIRS.map((h, i) => (look.g === 'm' && h.id === 'raspado-f' ? null : <Option key={h.id} on={look.hair === i} onClick={() => pick({ hair: i })}>{h.name}</Option>))}
            </div>
            <p className="look-sub">Cor do cabelo</p>
            <div className="look-swatches">{HAIR_COLORS.map(([n, c], i) => <Swatch key={c} color={c} on={look.hairColor === i} onClick={() => pick({ hairColor: i })} label={n} />)}</div>
          </>
        )}
        {tab === 'chapeu' && (
          <>
            <div className="look-grid">{HATS.map((h, i) => <Option key={h.id} on={look.hat === i} onClick={() => pick({ hat: i, hatColor: h.id === 'chapeu' && look.hat !== i ? 12 : look.hatColor })}>{h.name}</Option>)}</div>
            {look.hat > 0 && (
              <>
                <p className="look-sub">Cor</p>
                <div className="look-swatches">{PALETTE.map(([n, c], i) => <Swatch key={c} color={c} on={look.hatColor === i} onClick={() => pick({ hatColor: i })} label={n} />)}</div>
              </>
            )}
          </>
        )}
        {tab === 'camisa' && (
          <div className="look-grid">{TOPS.map((t, i) => <Option key={t.id} on={look.top === i} color={t.color} color2={t.sleeve} onClick={() => pick({ top: i })}>{t.name}</Option>)}</div>
        )}
        {tab === 'calca' && (
          <div className="look-grid">
            {BOTTOMS.map((b, i) => (b.girls && look.g !== 'f' ? null : <Option key={b.id} on={look.bottom === i} color={b.color} onClick={() => pick({ bottom: i })}>{b.name}</Option>))}
          </div>
        )}
        {tab === 'sapato' && (
          <div className="look-grid">{SHOES.map((s, i) => <Option key={s.id} on={look.shoes === i} color={s.color} color2={s.sole} onClick={() => pick({ shoes: i })}>{s.name}</Option>)}</div>
        )}
        {tab === 'extras' && (
          <div className="look-grid">
            <Option on={!!look.scarf} color="#f5c518" onClick={() => pick({ scarf: look.scarf ? 0 : 1 })}>Lenço de desbravador</Option>
            {look.g === 'm' && <Option on={!!look.beard} onClick={() => pick({ beard: look.beard ? 0 : 1 })}>Barba</Option>}
            <p className="look-sub" style={{ gridColumn: '1 / -1' }}>{top.style === 'manga' ? 'Dica: camisa de gala caqui + calça azul-marinho + sapato social + lenço = uniforme de gala!' : 'O lenço amarelo combina com qualquer camisa.'}</p>
          </div>
        )}
        {tab === 'prontos' && (
          <div className="skin-grid">
            {PRESET_IDS.filter((id) => id[0] === look.g).map((id) => (
              <button key={id} type="button" className="skin-card" onClick={() => pick(decodeLook(id))}>
                <span className="skin-thumb" style={{ '--c': '#93c5fd' }}><SkinThumb id={id} /></span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
