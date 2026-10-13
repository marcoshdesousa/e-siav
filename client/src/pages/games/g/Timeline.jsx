// Linha do tempo: toque nas histórias da Bíblia na ordem em que aconteceram. 3 rodadas erradas encerram.
import { useEffect, useRef, useState } from 'react';
import { shuffle } from '../kit.js';
import { sfx } from '../audio.js';
import './Timeline.css';

// Em ordem cronológica (o índice no vetor é a ordem).
const EVENTS = [
  ['🌍', 'Criação do mundo'],
  ['🍎', 'Adão e Eva saem do Éden'],
  ['🐑', 'Caim e Abel'],
  ['🌊', 'Dilúvio e a arca de Noé'],
  ['🧱', 'Torre de Babel'],
  ['⭐', 'Chamado de Abraão'],
  ['🔥', 'Destruição de Sodoma e Gomorra'],
  ['👶', 'Nascimento de Isaque'],
  ['⛰️', 'Abraão leva Isaque ao monte Moriá'],
  ['🍲', 'Esaú vende a primogenitura a Jacó'],
  ['🪜', 'Sonho de Jacó com a escada'],
  ['🧥', 'José é vendido pelos irmãos'],
  ['🌾', 'José governa o Egito'],
  ['🧺', 'Nascimento de Moisés'],
  ['🌿', 'Moisés e a sarça ardente'],
  ['🐸', 'As dez pragas do Egito'],
  ['🌊', 'Travessia do Mar Vermelho'],
  ['📜', 'Os Dez Mandamentos no Sinai'],
  ['🐂', 'O bezerro de ouro'],
  ['🍇', 'Os doze espias em Canaã'],
  ['🐍', 'A serpente de bronze'],
  ['🏞️', 'Travessia do rio Jordão'],
  ['🎺', 'Queda de Jericó'],
  ['🏺', 'Gideão e os 300'],
  ['🕯️', 'Deus chama o menino Samuel'],
  ['👑', 'Saul é ungido rei'],
  ['🪨', 'Davi e Golias'],
  ['🎶', 'Davi se torna rei de Israel'],
  ['🏛️', 'Construção do Templo de Salomão'],
  ['💔', 'Divisão do reino de Israel'],
  ['🔥', 'Elias no monte Carmelo'],
  ['🐎', 'Elias sobe ao céu num carro de fogo'],
  ['💧', 'Naamã é curado no Jordão'],
  ['⛓️', 'Jerusalém é destruída e o povo vai para a Babilônia'],
  ['✍️', 'Daniel lê a escrita na parede'],
  ['🦁', 'Daniel na cova dos leões'],
  ['👸', 'Ester se torna rainha'],
  ['🧱', 'Neemias reconstrói os muros de Jerusalém'],
  ['👼', 'O anjo Gabriel visita Maria'],
  ['⭐', 'Nascimento de Jesus'],
  ['🎁', 'Visita dos magos'],
  ['🏛️', 'Jesus aos 12 anos no templo'],
  ['🕊️', 'Batismo de Jesus'],
  ['🏜️', 'Tentação de Jesus no deserto'],
  ['🍷', 'Bodas de Caná'],
  ['⛰️', 'Sermão do Monte'],
  ['🐟', 'Multiplicação dos pães para 5 mil'],
  ['✨', 'Transfiguração de Jesus'],
  ['🪦', 'Ressurreição de Lázaro'],
  ['🌴', 'Entrada triunfal em Jerusalém'],
  ['🍞', 'Última Ceia'],
  ['✝️', 'Crucificação de Jesus'],
  ['🌅', 'Ressurreição de Jesus'],
  ['☁️', 'Ascensão de Jesus'],
  ['🔥', 'Pentecostes'],
  ['🪨', 'Estêvão é apedrejado'],
  ['💡', 'Conversão de Paulo'],
  ['🏠', 'Pedro na casa de Cornélio'],
  ['⛵', 'Primeira viagem missionária de Paulo'],
  ['🗣️', 'Concílio de Jerusalém'],
  ['🌊', 'Paulo naufraga perto de Malta'],
  ['🏝️', 'João recebe o Apocalipse em Patmos'],
].map(([icon, text], order) => ({ icon, text, order }));
const MAX_ERR = 3;

function makeRound(n) {
  const size = n < 3 ? 4 : 5;
  const gap = Math.max(1, 8 - n); // começa com histórias bem separadas no tempo
  for (let t = 0; t < 200; t++) {
    const pick = shuffle(EVENTS).slice(0, size).sort((a, b) => a.order - b.order);
    let ok = true;
    for (let i = 1; i < pick.length; i++) if (pick[i].order - pick[i - 1].order < gap) ok = false;
    if (ok || t > 150) {
      let cards = shuffle(pick);
      while (cards.every((c, i) => c === pick[i])) cards = shuffle(pick);
      return { cards, size, start: Date.now() };
    }
  }
  return null;
}

export default function Game({ onScore, onEnd }) {
  const cb = useRef({ onScore, onEnd });
  cb.current = { onScore, onEnd };
  const [roundNo, setRoundNo] = useState(0);
  const [round, setRound] = useState(() => makeRound(0));
  const [seq, setSeq] = useState([]); // ordem escolhida (índices das cartas)
  const [result, setResult] = useState(null); // null | { ok, pts }
  const [errors, setErrors] = useState(0);
  const [score, setScore] = useState(0);
  const st = useRef({ score: 0, errors: 0, over: false, lock: false });
  const timers = useRef([]);
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.current.push(t); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const check = (order) => {
    const s = st.current;
    s.lock = true;
    const ok = order.every((ci, i) => i === 0 || round.cards[ci].order > round.cards[order[i - 1]].order);
    let pts = 0;
    if (ok) {
      const secs = (Date.now() - round.start) / 1000;
      pts = round.size * 10 + Math.max(0, Math.round(20 - secs));
      s.score += pts;
      setScore(s.score);
      cb.current.onScore(s.score);
      sfx('win');
    } else {
      s.errors += 1;
      setErrors(s.errors);
      sfx('error');
    }
    setResult({ ok, pts });
    if (!ok && s.errors >= MAX_ERR) {
      s.over = true;
      later(() => sfx('lose'), 600);
      later(() => cb.current.onEnd(Math.max(0, s.score)), 2800);
      return;
    }
    later(() => {
      const nr = roundNo + 1;
      setRoundNo(nr);
      setRound(makeRound(nr));
      setSeq([]);
      setResult(null);
      s.lock = false;
    }, ok ? 1500 : 2800);
  };

  const tap = (ci) => {
    if (st.current.lock || st.current.over) return;
    const pos = seq.indexOf(ci);
    if (pos >= 0) { setSeq(seq.slice(0, pos)); sfx('move'); return; }
    const ns = [...seq, ci];
    setSeq(ns);
    sfx('tap');
    if (ns.length === round.cards.length) later(() => check(ns), 250);
  };

  // Ao conferir, mostra as cartas na ordem certa.
  const shown = result
    ? [...round.cards.keys()].sort((a, b) => round.cards[a].order - round.cards[b].order)
    : [...round.cards.keys()];
  const rank = (ci) => [...round.cards].sort((a, b) => a.order - b.order).indexOf(round.cards[ci]);

  return (
    <div className="timeline">
      <div className="timeline-hud">
        <span className="timeline-lives">{Array.from({ length: MAX_ERR }, (_, i) => <b key={i} className={i < MAX_ERR - errors ? '' : 'timeline-lost'}>❤</b>)}</span>
        <span>Rodada {roundNo + 1}</span>
        <span className="timeline-score">{score} pts</span>
      </div>
      <div className={'timeline-tip' + (result ? (result.ok ? ' timeline-tip-ok' : ' timeline-tip-bad') : '')}>
        {result
          ? result.ok ? 'Isso mesmo! +' + result.pts + ' pts' : st.current.over ? 'Fim de jogo! Esta era a ordem certa:' : 'Quase! Esta é a ordem certa:'
          : 'Toque da história mais antiga para a mais recente'}
      </div>
      <div className="timeline-list">
        {shown.map((ci) => {
          const c = round.cards[ci];
          const pos = seq.indexOf(ci);
          let cls = 'timeline-card';
          if (pos >= 0 && !result) cls += ' timeline-picked';
          if (result) cls += seq.indexOf(ci) === rank(ci) ? ' timeline-right' : ' timeline-wrong';
          return (
            <button key={c.text} type="button" className={cls} onClick={() => tap(ci)} disabled={!!result}>
              <span className="timeline-num">{result ? rank(ci) + 1 : pos >= 0 ? pos + 1 : ''}</span>
              <span className="timeline-icon" aria-hidden="true">{c.icon}</span>
              <span className="timeline-text">{c.text}</span>
              {result && seq.indexOf(ci) !== rank(ci) && <small className="timeline-yours">você: {seq.indexOf(ci) + 1}º</small>}
            </button>
          );
        })}
      </div>
      <div className="timeline-axis"><span>Mais antiga</span><i /><span>Mais recente</span></div>
    </div>
  );
}
