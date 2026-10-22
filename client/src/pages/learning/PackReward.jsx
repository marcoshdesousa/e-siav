// Pacotinho ganho no estudo do dia: aparece com "Coletar". Coletando (ou não), ele já está guardado
// no Álbum Bíblico; o botão só leva até lá com uma animação.
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BookImage, Sparkles } from 'lucide-react';

export function PackReward({ packs = 1 }) {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [going, setGoing] = useState(false);
  const base = '/' + pathname.split('/')[1];
  const collect = () => {
    if (going) return;
    setGoing(true);
    setTimeout(() => nav(`${base}/albuns/biblico`), 750);
  };
  return (
    <div className={'pack-reward' + (going ? ' going' : '')}>
      <div className="pack-reward-glow" aria-hidden="true" />
      <div className="pack-reward-pack" aria-hidden="true">
        <span className="pack-reward-shine" />
        <img src="/marca/logo.svg" alt="" />
        <b>Álbum Bíblico</b>
        <small>{packs > 1 ? `${packs} pacotinhos` : '6 figurinhas'}</small>
      </div>
      <div className="pack-reward-text">
        <b><Sparkles size={16} /> Você ganhou {packs > 1 ? `${packs} pacotinhos` : '1 pacotinho'}!</b>
        <small>Se não coletar agora, ele vai sozinho para o seu álbum.</small>
      </div>
      <button type="button" className="pack-reward-btn" onClick={collect} disabled={going}>
        <BookImage size={18} /> {going ? 'Guardando no álbum…' : 'Coletar'}
      </button>
    </div>
  );
}
