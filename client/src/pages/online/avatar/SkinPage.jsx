// Aba Skin dos jogos: 10 personagens de menino, 10 de menina e 30 skates. A prévia mostra
// como fica no Surf DBV (adolescente) e no Stumble DBV (bonequinho), girando, correndo e pulando.
import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { api } from '../../../api.js';
import { BOARDS, SKINS, boardById, readChoice, saveChoice, skinById, syncChoice } from './skins.js';
import SkinPreview from './SkinPreview.jsx';
import SkinThumb from './SkinThumb.jsx';
import './skin.css';

export default function SkinPage() {
  const [choice, setChoice] = useState(readChoice);
  const [tab, setTab] = useState('personagem');
  const [g, setG] = useState(() => (readChoice().skin[0] === 'f' ? 'f' : 'm'));
  const [saved, setSaved] = useState(false);
  const timer = useRef(0);
  useEffect(() => { syncChoice().then((c) => { setChoice(c); setG(c.skin[0]); }); }, []);
  const pick = (patch) => {
    const c = { ...choice, ...patch };
    setChoice(c);
    saveChoice(c);
    setSaved(false);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => api.put('/jogos/skin', c).then(() => setSaved(true)).catch(() => {}), 500);
  };
  const skin = skinById(choice.skin);
  const board = boardById(choice.board);
  return (
    <div className="skin-page">
      <div className="skin-stages">
        <SkinPreview mode="surf" skin={choice.skin} board={choice.board} label="Surf DBV" />
        <SkinPreview mode="stumble" skin={choice.skin} board={choice.board} label="Stumble DBV" />
      </div>
      <div className="skin-now">
        <div>
          <b>{skin.name}</b>
          <small>Skate {board.name}</small>
        </div>
        <span className={'skin-saved' + (saved ? ' on' : '')}><Check size={14} /> {saved ? 'Salvo' : 'Vale para todos os jogos'}</span>
      </div>
      <div className="seg skin-tabs" role="tablist">
        <button type="button" className={tab === 'personagem' ? 'active' : ''} onClick={() => setTab('personagem')}>Personagens</button>
        <button type="button" className={tab === 'skate' ? 'active' : ''} onClick={() => setTab('skate')}>Skates</button>
      </div>
      {tab === 'personagem' ? (
        <>
          <div className="skin-gender">
            <button type="button" className={g === 'm' ? 'active m' : 'm'} onClick={() => setG('m')}>Meninos <small>{SKINS.filter((x) => x.g === 'm').length}</small></button>
            <button type="button" className={g === 'f' ? 'active f' : 'f'} onClick={() => setG('f')}>Meninas <small>{SKINS.filter((x) => x.g === 'f').length}</small></button>
          </div>
          <div className="skin-grid">
            {SKINS.filter((s) => s.g === g).map((s) => (
              <button key={s.id} type="button" className={'skin-card' + (choice.skin === s.id ? ' on' : '')} onClick={() => pick({ skin: s.id })} aria-pressed={choice.skin === s.id}>
                <span className="skin-thumb" style={{ '--c': s.top.color }}><SkinThumb kind="skin" id={s.id} /></span>
                <span className="skin-name">{s.name}</span>
                {choice.skin === s.id && <span className="skin-tick"><Check size={14} /></span>}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="skin-grid boards">
          {BOARDS.map((b) => (
            <button key={b.id} type="button" className={'skin-card' + (choice.board === b.id ? ' on' : '')} onClick={() => pick({ board: b.id })} aria-pressed={choice.board === b.id}>
              <span className="skin-thumb" style={{ '--c': b.glow }}><SkinThumb kind="board" id={b.id} /></span>
              <span className="skin-name">{b.name}</span>
              {choice.board === b.id && <span className="skin-tick"><Check size={14} /></span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
