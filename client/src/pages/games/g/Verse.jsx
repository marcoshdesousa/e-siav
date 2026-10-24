// Versículo embaralhado: toque nas palavras na ordem certa. 3 erros encerram o jogo.
import { useEffect, useRef, useState } from 'react';
import { shuffle } from '../kit.js';
import { sfx } from '../audio.js';
import { Hearts } from '../art.jsx';
import './Verse.css';

// Texto no estilo da tradução de João Ferreira de Almeida.
const VERSES = [
  ['João 3:16', 'Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.'],
  ['Salmos 23:1', 'O Senhor é o meu pastor; nada me faltará.'],
  ['Filipenses 4:13', 'Tudo posso naquele que me fortalece.'],
  ['Gênesis 1:1', 'No princípio, criou Deus os céus e a terra.'],
  ['Provérbios 3:5', 'Confia no Senhor de todo o teu coração e não te estribes no teu próprio entendimento.'],
  ['Mateus 28:20', 'E eis que eu estou convosco todos os dias, até à consumação dos séculos.'],
  ['João 14:6', 'Eu sou o caminho, e a verdade, e a vida; ninguém vem ao Pai senão por mim.'],
  ['Romanos 3:23', 'Porque todos pecaram e destituídos estão da glória de Deus.'],
  ['Romanos 6:23', 'Porque o salário do pecado é a morte, mas o dom gratuito de Deus é a vida eterna, por Cristo Jesus, nosso Senhor.'],
  ['Salmos 46:1', 'Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia.'],
  ['Isaías 41:10', 'Não temas, porque eu sou contigo; não te assombres, porque eu sou teu Deus.'],
  ['Josué 1:9', 'Esforça-te e tem bom ânimo; não pasmes, nem te espantes, porque o Senhor, teu Deus, é contigo por onde quer que andares.'],
  ['Mateus 6:33', 'Mas buscai primeiro o Reino de Deus, e a sua justiça, e todas essas coisas vos serão acrescentadas.'],
  ['Mateus 5:14', 'Vós sois a luz do mundo.'],
  ['Mateus 5:9', 'Bem-aventurados os pacificadores, porque eles serão chamados filhos de Deus.'],
  ['Mateus 5:8', 'Bem-aventurados os limpos de coração, porque eles verão a Deus.'],
  ['1 João 4:8', 'Aquele que não ama não conhece a Deus, porque Deus é amor.'],
  ['1 João 1:9', 'Se confessarmos os nossos pecados, ele é fiel e justo para nos perdoar os pecados e nos purificar de toda injustiça.'],
  ['Salmos 119:11', 'Escondi a tua palavra no meu coração, para eu não pecar contra ti.'],
  ['Provérbios 1:7', 'O temor do Senhor é o princípio da ciência.'],
  ['Eclesiastes 12:1', 'Lembra-te do teu Criador nos dias da tua mocidade.'],
  ['Êxodo 20:8', 'Lembra-te do dia do sábado, para o santificar.'],
  ['1 Pedro 5:7', 'Lançando sobre ele toda a vossa ansiedade, porque ele tem cuidado de vós.'],
  ['Hebreus 13:8', 'Jesus Cristo é o mesmo ontem, e hoje, e eternamente.'],
  ['Mateus 11:28', 'Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei.'],
  ['João 8:32', 'E conhecereis a verdade, e a verdade vos libertará.'],
  ['João 10:11', 'Eu sou o bom Pastor; o bom Pastor dá a sua vida pelas ovelhas.'],
  ['João 15:13', 'Ninguém tem maior amor do que este: de dar alguém a sua vida pelos seus amigos.'],
  ['Salmos 118:24', 'Este é o dia que fez o Senhor; regozijemo-nos e alegremo-nos nele.'],
  ['Salmos 37:5', 'Entrega o teu caminho ao Senhor; confia nele, e ele tudo fará.'],
  ['Salmos 121:2', 'O meu socorro vem do Senhor, que fez o céu e a terra.'],
  ['1 Tessalonicenses 5:17', 'Orai sem cessar.'],
  ['Filipenses 4:4', 'Regozijai-vos, sempre, no Senhor; outra vez digo: regozijai-vos.'],
  ['Romanos 12:21', 'Não te deixes vencer do mal, mas vence o mal com o bem.'],
  ['2 Timóteo 1:7', 'Porque Deus não nos deu o espírito de temor, mas de fortaleza, e de amor, e de moderação.'],
  ['Tiago 4:8', 'Chegai-vos a Deus, e ele se chegará a vós.'],
  ['Isaías 40:31', 'Mas os que esperam no Senhor renovarão as suas forças e subirão com asas como águias.'],
  ['Salmos 19:1', 'Os céus manifestam a glória de Deus e o firmamento anuncia a obra das suas mãos.'],
  ['Salmos 150:6', 'Tudo quanto tem fôlego louve ao Senhor. Louvai ao Senhor!'],
  ['João 1:1', 'No princípio, era o Verbo, e o Verbo estava com Deus, e o Verbo era Deus.'],
  ['Atos 16:31', 'Crê no Senhor Jesus Cristo e serás salvo, tu e a tua casa.'],
  ['Efésios 2:8', 'Porque pela graça sois salvos, por meio da fé; e isso não vem de vós; é dom de Deus.'],
  ['Provérbios 22:6', 'Instrui o menino no caminho em que deve andar, e, até quando envelhecer, não se desviará dele.'],
  ['Salmos 34:8', 'Provai e vede que o Senhor é bom.'],
  ['Marcos 16:15', 'Ide por todo o mundo, pregai o evangelho a toda criatura.'],
  ['1 Coríntios 10:31', 'Portanto, quer comais, quer bebais ou façais outra qualquer coisa, fazei tudo para glória de Deus.'],
  ['Hebreus 11:1', 'Ora, a fé é o firme fundamento das coisas que se esperam e a prova das coisas que se não veem.'],
];
const MAX_ERR = 3;

function makeDeck() {
  // Começa pelos versículos curtos e vai aumentando (com um pouco de sorte no meio).
  return shuffle(VERSES)
    .map((v) => ({ v, k: v[1].split(' ').length + Math.random() * 8 }))
    .sort((a, b) => a.k - b.k)
    .map(({ v }) => v);
}

function makeRound(v) {
  const words = v[1].split(' ');
  let order = shuffle(words.map((w, id) => ({ w, id })));
  for (let i = 0; i < 10 && words.length > 1 && order.every((c, j) => c.w === words[j]); i++) order = shuffle(order);
  return { ref: v[0], words, chips: order, start: Date.now() };
}

export default function Game({ onScore, onEnd }) {
  const cb = useRef({ onScore, onEnd });
  cb.current = { onScore, onEnd };
  const [deck] = useState(makeDeck);
  const [idx, setIdx] = useState(0);
  const [round, setRound] = useState(() => makeRound(deck[0]));
  const [used, setUsed] = useState([]); // ids dos chips já colocados
  const [errors, setErrors] = useState(0);
  const [score, setScore] = useState(0);
  const [bad, setBad] = useState(null);
  const [phase, setPhase] = useState('play'); // play | done | over
  const [gain, setGain] = useState(null);
  const [now, setNow] = useState(Date.now());
  const st = useRef({ score: 0, errors: 0, over: false, lock: false });
  const timers = useRef([]);
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.current.push(t); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, []);

  const limit = 6 + round.words.length * 2; // segundos para ganhar bônus
  const elapsed = phase === 'play' ? (now - round.start) / 1000 : 0;
  const bonusLeft = Math.max(0, Math.ceil(limit - elapsed));

  const tap = (chip) => {
    const s = st.current;
    if (s.lock || s.over || used.includes(chip.id)) return;
    const expected = round.words[used.length];
    if (chip.w === expected) {
      const nu = [...used, chip.id];
      setUsed(nu);
      if (nu.length === round.words.length) {
        s.lock = true;
        const secs = (Date.now() - round.start) / 1000;
        const bonus = Math.max(0, Math.ceil(limit - secs));
        const pts = round.words.length * 5 + bonus;
        s.score += pts;
        setScore(s.score);
        cb.current.onScore(s.score);
        setGain({ pts, bonus });
        setPhase('done');
        sfx('win');
        later(() => {
          const ni = idx + 1;
          setIdx(ni);
          setRound(makeRound(deck[ni % deck.length]));
          setUsed([]);
          setGain(null);
          setPhase('play');
          s.lock = false;
        }, 1800);
      } else sfx('tap');
    } else {
      s.errors += 1;
      setErrors(s.errors);
      setBad({ id: chip.id, t: Date.now() });
      sfx('error');
      later(() => setBad(null), 400);
      if (s.errors >= MAX_ERR) {
        s.over = true; s.lock = true;
        setPhase('over');
        later(() => sfx('lose'), 300);
        later(() => cb.current.onEnd(Math.max(0, s.score)), 2200);
      }
    }
  };

  const placed = used.map((id) => round.chips.find((c) => c.id === id).w);

  return (
    <div className="verse">
      <div className="verse-hud">
        <span className="verse-lives" aria-label={'Erros: ' + errors + ' de ' + MAX_ERR}>
          <Hearts n={MAX_ERR - errors} max={MAX_ERR} />
        </span>
        <span className="verse-bonus">{phase === 'play' ? 'Bônus: ' + bonusLeft : ' '}</span>
        <span className="verse-score">{score} pts</span>
      </div>
      <div className="verse-ref">{round.ref}</div>
      <div className={'verse-text' + (phase === 'done' ? ' verse-ok' : '') + (phase === 'over' ? ' verse-fail' : '')}>
        {phase === 'over'
          ? round.words.map((w, i) => <span key={i} className={i < used.length ? '' : 'verse-missing'}>{w} </span>)
          : placed.length ? placed.map((w, i) => <span key={i} className="verse-in">{w} </span>) : <em>Toque nas palavras na ordem…</em>}
        {gain && <div className="verse-gain">+{gain.pts} pts{gain.bonus ? ' (bônus ' + gain.bonus + ')' : ''}</div>}
      </div>
      <div className="verse-chips">
        {round.chips.map((c) => (
          <button key={c.id} type="button"
            className={'verse-chip' + (used.includes(c.id) ? ' verse-used' : '') + (bad?.id === c.id ? ' verse-shake' : '')}
            disabled={used.includes(c.id) || phase !== 'play'}
            onPointerDown={(e) => { e.preventDefault(); tap(c); }}>
            {c.w}
          </button>
        ))}
      </div>
      {phase === 'over' && <div className="verse-over">Fim de jogo! Veja o versículo completo acima.</div>}
    </div>
  );
}
