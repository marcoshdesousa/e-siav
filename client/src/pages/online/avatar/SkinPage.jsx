// Aba Personagem dos jogos: por enquanto são só dois personagens padrão (menino e menina), sem bugs
// de roupa. As skins (roupas, cabelos, chapéus...) chegam depois: a parte de baixo mostra "em breve".
import { useEffect, useRef, useState } from 'react';
import { Check, Shirt } from 'lucide-react';
import { api } from '../../../api.js';
import { STANDARD, readChoice, saveChoice, syncChoice } from './skins.js';
import SkinPreview from './SkinPreview.jsx';
import './skin.css';

const genderOf = (code) => (String(code || '')[0] === 'f' ? 'f' : 'm');

export default function SkinPage() {
  const [g, setG] = useState(() => genderOf(readChoice().skin));
  const [saved, setSaved] = useState(false);
  const timer = useRef(0);
  useEffect(() => { syncChoice().then((c) => setG(genderOf(c.skin))); }, []);
  const pick = (next) => {
    setG(next);
    const c = { skin: STANDARD[next] };
    saveChoice(c);
    setSaved(false);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => api.put('/jogos/skin', c).then(() => setSaved(true)).catch(() => {}), 400);
  };
  const code = STANDARD[g];
  return (
    <div className="skin-page">
      <div className="skin-stages">
        <SkinPreview mode="surf" skin={code} label="Grande" />
        <SkinPreview mode="stumble" skin={code} label="Stumble DBV" />
      </div>
      <div className="skin-now">
        <div className="skin-gender">
          <button type="button" className={g === 'm' ? 'active m' : 'm'} onClick={() => pick('m')}>Menino</button>
          <button type="button" className={g === 'f' ? 'active f' : 'f'} onClick={() => pick('f')}>Menina</button>
        </div>
        <span className={'skin-saved' + (saved ? ' on' : '')}><Check size={14} /> {saved ? 'Salvo' : 'Vale para todos os jogos'}</span>
      </div>
      <div className="look-panel look-soon">
        <Shirt size={30} />
        <b>Skins — em breve</b>
        <p className="small muted">Roupas, cabelos, chapéus e novos visuais para o seu personagem vão chegar aqui.</p>
      </div>
    </div>
  );
}
