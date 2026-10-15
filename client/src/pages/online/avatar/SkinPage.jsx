// Aba Skin dos jogos: 30 personagens de menino, 30 de menina e 30 skates. A prévia mostra
// como fica no Surf DBV (adolescente) e no Stumble DBV (bonequinho), girando, correndo e pulando.
import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { api } from '../../../api.js';
import { BOARDS, SKINS, boardById, readChoice, saveChoice, skinById } from './skins.js';
import { mountPreview } from './preview.js';
import { thumb } from './thumbs.js';
import './skin.css';

/** Lê a escolha salva no servidor (se houver) e guarda no aparelho. */
export async function syncChoice() {
  try {
    const r = await api.get('/jogos/skin');
    if (r?.skin) { const c = { skin: skinById(r.skin).id, board: boardById(r.board).id }; saveChoice(c); return c; }
  } catch { /* sem internet: fica a do aparelho */ }
  return readChoice();
}

function Preview({ mode, skin, board, label }) {
  const ref = useRef(null);
  const view = useRef(null);
  useEffect(() => {
    let v = null;
    try { v = mountPreview(ref.current, { mode }); } catch { /* sem WebGL */ }
    view.current = v;
    return () => { v?.dispose(); view.current = null; };
  }, [mode]);
  useEffect(() => { view.current?.set({ skin, board }); }, [skin, board, mode]);
  return (
    <div className={`skin-stage ${mode}`}>
      <canvas ref={ref} />
      <span className="skin-stage-tag">{label}</span>
    </div>
  );
}

function Thumb({ kind, id }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let live = true;
    thumb(kind, id).then((u) => live && setUrl(u)).catch(() => {});
    return () => { live = false; };
  }, [kind, id]);
  return url ? <img src={url} alt="" draggable={false} /> : <span className="skin-thumb-wait" />;
}

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
        <Preview mode="surf" skin={choice.skin} board={choice.board} label="Surf DBV" />
        <Preview mode="stumble" skin={choice.skin} board={choice.board} label="Stumble DBV" />
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
            <button type="button" className={g === 'm' ? 'active m' : 'm'} onClick={() => setG('m')}>Meninos <small>30</small></button>
            <button type="button" className={g === 'f' ? 'active f' : 'f'} onClick={() => setG('f')}>Meninas <small>30</small></button>
          </div>
          <div className="skin-grid">
            {SKINS.filter((s) => s.g === g).map((s) => (
              <button key={s.id} type="button" className={'skin-card' + (choice.skin === s.id ? ' on' : '')} onClick={() => pick({ skin: s.id })} aria-pressed={choice.skin === s.id}>
                <span className="skin-thumb" style={{ '--c': s.top.color }}><Thumb kind="skin" id={s.id} /></span>
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
              <span className="skin-thumb" style={{ '--c': b.glow }}><Thumb kind="board" id={b.id} /></span>
              <span className="skin-name">{b.name}</span>
              {choice.board === b.id && <span className="skin-tick"><Check size={14} /></span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
