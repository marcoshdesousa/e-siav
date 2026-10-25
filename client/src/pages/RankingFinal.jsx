// Aviso de ranking finalizado: a colocação de cada um e, para os 3 primeiros, o prêmio que ganhou.
import { useEffect, useState } from 'react';
import { Trophy, X } from 'lucide-react';
import { api } from '../api.js';
import { RankMedal } from '../rankMedal.jsx';
import { Prize } from '../trophies.jsx';
import { gameById } from './games/games.js';
import { Button } from '../ui.jsx';

const WHERE = { club: 'do clube', district: 'do distrito', brasil: 'do Brasil' };

function Place({ p }) {
  const you = p.who === 'Você';
  const subject = you ? 'Você ficou' : `${p.who} ficou`;
  const game = p.game ? gameById(p.game) : null;
  return (
    <div className={'rf-place' + (p.prize ? ' won' : '')}>
      {p.prize
        ? (p.prize.design
          ? <Prize kind={p.prize.kind} design={p.prize.design} pos={p.position} size={you ? 80 : 64} />
          : <RankMedal icon={p.prize.icon} year={p.prize.year} size={you ? 92 : 70} />)
        : <span className="rf-num">{p.position}º</span>}
      <div className="rf-text">
        <b>{subject} em {p.position}º lugar</b>
        <span>{game ? `${game.name}` : p.game ? 'Mini-jogo' : `Ranking de ${p.table.toLowerCase()}`} · {p.points} pts</span>
        {p.prize
          ? <span className="rf-prize">Ganhou {p.prize.kind === 'trofeu' ? 'o troféu' : 'a medalha'} <b>{p.prize.name}</b></span>
          : <span className="rf-next">{p.game ? 'Os jogos recomeçaram do zero. Bora para o pódio!' : 'Continue firme: no próximo ranking o pódio pode ser seu!'}</span>}
      </div>
    </div>
  );
}

export function RankingFinalView({ f, onClose }) {
  const won = f.places.some((p) => p.prize);
  return (
    <div className="ann-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rf-card" role="dialog" aria-modal="true" aria-label="Ranking finalizado">
        <button type="button" className="ann-x" aria-label="Fechar" onClick={onClose}><X size={16} /></button>
        <div className={'rf-head' + (won ? ' won' : '')}>
          <Trophy size={26} />
          <span className="rf-kicker">Ranking finalizado</span>
          <h2>{f.kind === 'jogos' ? 'Ranking dos mini-jogos' : `Ranking ${f.scope === 'brasil' ? 'do Brasil' : `${WHERE[f.scope]}: ${f.label}`}`}</h2>
          <span className="rf-year">Temporada {f.year}</span>
          {won && <p>Parabéns! Esforço, estudo e fidelidade que chegaram ao pódio.</p>}
        </div>
        <div className="rf-list">
          {f.places.map((p) => <Place key={p.kind + p.who} p={p} />)}
        </div>
        {won && <p className="small muted center" style={{ margin: '0 1rem .6rem' }}>{f.kind === 'jogos' ? 'A medalha já está no seu perfil, em Medalhas.' : f.places.some((p) => p.prize && p.who === 'Você') ? 'O troféu já está no seu perfil, em Troféus, e o certificado em Downloads.' : 'O troféu já está no perfil, em Troféus. Toque nele para ver o certificado.'}</p>}
        <div style={{ padding: '0 1rem 1rem' }}><Button block onClick={onClose}>Continuar</Button></div>
      </div>
    </div>
  );
}

/** Mostra uma vez cada ranking finalizado em que a pessoa (ou a unidade/clube dela) aparece. */
export default function RankingFinalPopup() {
  const [queue, setQueue] = useState([]);
  useEffect(() => { api.get('/rankings/finais?novos=1').then(setQueue).catch(() => {}); }, []);
  const cur = queue[0];
  if (!cur) return null;
  return <RankingFinalView key={cur.id} f={cur} onClose={() => { api.post(`/rankings/finais/${cur.id}/visto`).catch(() => {}); setQueue((q) => q.slice(1)); }} />;
}
