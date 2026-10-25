// Aviso de ranking finalizado: a colocação de cada um e, para os 3 primeiros, o prêmio que ganhou.
import { useEffect, useState } from 'react';
import { Trophy, X } from 'lucide-react';
import { api } from '../api.js';
import { RankMedal } from '../rankMedal.jsx';
import { Button } from '../ui.jsx';

const WHERE = { club: 'do clube', district: 'do distrito', brasil: 'do Brasil' };

function Place({ p }) {
  const you = p.who === 'Você';
  const subject = you ? 'Você ficou' : `${p.who} ficou`;
  return (
    <div className={'rf-place' + (p.prize ? ' won' : '')}>
      {p.prize
        ? <RankMedal icon={p.prize.icon} year={p.prize.year} size={p.who === 'Você' ? 92 : 70} />
        : <span className="rf-num">{p.position}º</span>}
      <div className="rf-text">
        <b>{subject} em {p.position}º lugar</b>
        <span>Ranking de {p.table.toLowerCase()} · {p.points} pts</span>
        {p.prize
          ? <span className="rf-prize">Ganhou {p.prize.kind === 'trofeu' ? 'o troféu' : 'a medalha'} <b>{p.prize.name}</b></span>
          : <span className="rf-next">Um novo ranking já começou. Bora para o pódio!</span>}
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
          <h2>Ranking {f.scope === 'brasil' ? 'do Brasil' : `${WHERE[f.scope]}: ${f.label}`}</h2>
          <span className="rf-year">Temporada {f.year}</span>
          {won && <p>Parabéns! Esforço, estudo e fidelidade que chegaram ao pódio.</p>}
        </div>
        <div className="rf-list">
          {f.places.map((p) => <Place key={p.kind + p.who} p={p} />)}
        </div>
        {won && <p className="small muted center" style={{ margin: '0 1rem .6rem' }}>O prêmio já está no perfil, em Medalhas e troféus.</p>}
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
