// Jogos dos membros (jogos grandes + mini-jogos): lista de jogos, tela de cada jogo e ranking geral de cada um.
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Flag, Gamepad2, Keyboard, Layers, Lightbulb, Smartphone, Target, PersonStanding, Shirt, Play, RotateCcw, Trophy, Volume2, VolumeX } from 'lucide-react';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Button, Card, Loading, PageHeader, Section, Spinner, Tabs, useLoad } from '../../ui.jsx';
import { RankingTable } from '../Ranking.jsx';
import { GAMES, gameById, gameComponent } from './games.js';
import { isMuted, onMuteChange, setMuted, sfx, startMusic, stopMusic, unlockAudio } from './audio.js';
import { useOnline } from '../../offline.js';
import TUTORIALS from './tutorials.json';
import './games.css';

const SkinPage = lazy(() => import('../online/avatar/SkinPage.jsx'));

const valueLabel = (g) => (g.mode === 'sum' ? 'Total de pontos' : 'Recorde');

function GameRanking({ game, base, limit }) {
  const { actor } = useAuth();
  const state = useLoad(() => api.get(`/jogos/${game.id}/ranking`), [game.id]);
  return (
    <Loading {...state}>
      {(d) => (
        <>
          {d.me && <Card className="small center"><b>Você:</b> {d.me.position}º lugar · {d.me.value} pts · {d.me.plays} partida{d.me.plays > 1 ? 's' : ''}</Card>}
          <RankingTable
            rows={d.rows.slice(0, limit || 50).map((r) => ({ ...r, points: r.value }))}
            highlight={actor.id}
            sub={(r) => r.club_name}
            link={(r) => `${base}/ver/membro/${r.code}`}
            avatarSquare={false}
          />
        </>
      )}
    </Loading>
  );
}

/** Jogos grandes (online). Ficam "em breve" até cada um ficar pronto. */
export const BIG_GAMES = [
  { id: 'uno', name: 'Uno DBV', logo: ['UNO', 'DBV'], theme: 'uno', hint: 'Uno de verdade na mesa, de 2 a 6 jogadores, com chat de voz. Celular em pé.', icon: Layers, ranks: [['uno', 'Vitórias']], ready: true },
  { id: 'stumble', name: 'Stumble DBV', logo: ['STUMBLE', 'DBV'], theme: 'stumble', hint: 'Até 10 jogadores em fases malucas de obstáculos. Só o 1º vence. Celular deitado.', icon: PersonStanding, ranks: [['stumble', 'Vitórias']], ready: true },
  { id: 'play', name: 'Desbrava Play', logo: ['DESBRAVA', 'PLAY'], theme: 'play', hint: 'Um jogo novo dos Desbravadores está sendo preparado.', icon: Gamepad2, ranks: [], ready: false },
];

function BigGames({ base, onSkin }) {
  return (
    <div className="big-games">
      {BIG_GAMES.map((g) => {
        const body = (
          <>
            <span className={'big-game-logo ' + g.theme}>
              <img src="/marca/logo.svg?v=4" alt="" />
              <b>{g.logo[0]}</b>
              <i>{g.logo[1]}</i>
            </span>
            <div className="grow">
              <b>{g.name}</b>
              <small>{g.hint}</small>
            </div>
            {g.ready ? <Play size={26} /> : <span className="chip">Em breve</span>}
          </>
        );
        return g.ready
          ? <Link key={g.id} to={`${base}/jogos/${g.id}`} className={'big-game ' + g.theme}>{body}</Link>
          : <div key={g.id} className={'big-game soon ' + g.theme} aria-disabled="true">{body}</div>;
      })}
      <button type="button" onClick={onSkin} className="big-game skin-link">
        <span className="big-game-ico"><Shirt size={34} /></span>
        <div className="grow">
          <b>Meu personagem</b>
          <small>Monte o seu: pele, cabelo, chapéu, camisa, calça ou saia, calçado e o lenço. Vale para todos os jogos</small>
        </div>
        <Play size={26} />
      </button>
      <p className="small muted center">O Uno DBV e o Stumble DBV precisam de internet.</p>
    </div>
  );
}

/** Ranking dos mini-jogos (fica dentro da aba Mini-jogos). */
function MiniRankings({ base, online, initial }) {
  const [rankGame, setRankGame] = useState(GAMES.some((g) => g.id === initial) ? initial : GAMES[0].id);
  return (
    <>
      <select value={rankGame} onChange={(e) => setRankGame(e.target.value)} aria-label="Jogo">
        {GAMES.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>
      <p className="small muted">{gameById(rankGame).mode === 'sum' ? 'Os pontos de todas as partidas vão somando.' : 'Vale a melhor partida de cada um.'} Ranking geral de todos os membros.</p>
      {online ? <GameRanking key={rankGame} game={gameById(rankGame)} base={base} /> : <Card className="small center">Os rankings precisam de internet. Sem internet, dá para jogar, mas as partidas não entram no ranking.</Card>}
    </>
  );
}

/** Ranking dos jogos grandes (fica dentro da aba Jogos). */
function BigRankings({ base, online, initial }) {
  const ranked = BIG_GAMES.filter((g) => g.ranks.length);
  const initialBig = ranked.find((g) => g.ranks.some((r) => r[0] === initial));
  const [big, setBig] = useState(initialBig?.id || ranked[0].id);
  const bigGame = ranked.find((g) => g.id === big);
  const [board, setBoard] = useState(initialBig ? initial : bigGame.ranks[0][0]);
  const boardId = bigGame.ranks.some((r) => r[0] === board) ? board : bigGame.ranks[0][0];
  return (
    <>
      <select value={big} onChange={(e) => setBig(e.target.value)} aria-label="Jogo">
        {ranked.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>
      {bigGame.ranks.length > 1 && (
        <div className="seg games-rank-kind" role="tablist">
          {bigGame.ranks.map(([id, label]) => <button key={id} type="button" className={boardId === id ? 'active' : ''} onClick={() => setBoard(id)}>{label}</button>)}
        </div>
      )}
      {online ? <><p className="small muted">{bigGame.ranks.find((r) => r[0] === boardId)[1]} · ranking geral de todos os membros.</p><GameRanking key={boardId} game={{ id: boardId, mode: 'sum' }} base={base} /></>
        : <Card className="small center">Os rankings precisam de internet.</Card>}
    </>
  );
}

const isBigRank = (id) => BIG_GAMES.some((g) => g.ranks.some((r) => r[0] === id));

/** Aba Jogos: duas abas (Jogos e Mini-jogos), cada uma com o seu ranking dentro. */
export function GamesHub({ base }) {
  const [params] = useSearchParams();
  const wantRank = params.get('aba') === 'ranking';
  const rankOf = params.get('jogo');
  const [tab, setTab] = useState(() => {
    if (wantRank) return isBigRank(rankOf) ? 'jogos' : 'mini';
    if (params.get('aba') === 'skin') return 'jogos';
    try { const t = window.sessionStorage.getItem('dbv-games-tab'); return ['jogos', 'mini'].includes(t) ? t : 'mini'; } catch { return 'mini'; }
  });
  // Dentro da aba Jogos: jogar, skin (vale para os jogos) e ranking; nos Mini-jogos: jogar e ranking
  const [sub, setSub] = useState(() => (params.get('aba') === 'skin' ? 'skin' : wantRank && isBigRank(rankOf) ? 'ranking' : 'jogar'));
  const [miniSub, setMiniSub] = useState(() => (wantRank && !isBigRank(rankOf) ? 'ranking' : 'jogar'));
  const pick = (t) => { setTab(t); try { window.sessionStorage.setItem('dbv-games-tab', t); } catch { /* sem armazenamento */ } };
  const mine = useLoad(() => api.get('/jogos/meus'));
  const my = mine.data || {};
  const online = useOnline();
  return (
    <>
      <PageHeader title="Jogos" subtitle={`Jogos online e ${GAMES.length} mini-jogos para fazer pontos e subir no ranking. Sem anúncios!`} />
      <Tabs tabs={[['jogos', 'Jogos'], ['mini', 'Mini-jogos']]} value={tab} onChange={pick} />
      {tab === 'jogos' && (
        <>
          <div className="seg games-sub" role="tablist">
            <button type="button" className={sub === 'jogar' ? 'active' : ''} onClick={() => setSub('jogar')}><Play size={14} /> Jogar</button>
            <button type="button" className={sub === 'skin' ? 'active' : ''} onClick={() => setSub('skin')}><Shirt size={14} /> Personagem</button>
            <button type="button" className={sub === 'ranking' ? 'active' : ''} onClick={() => setSub('ranking')}><Trophy size={14} /> Ranking</button>
          </div>
          {sub === 'jogar' && <BigGames base={base} onSkin={() => setSub('skin')} />}
          {sub === 'skin' && <Suspense fallback={<Spinner />}><SkinPage /></Suspense>}
          {sub === 'ranking' && <BigRankings base={base} online={online} initial={rankOf} />}
        </>
      )}
      {tab === 'mini' && (
        <>
          <div className="seg games-sub" role="tablist">
            <button type="button" className={miniSub === 'jogar' ? 'active' : ''} onClick={() => setMiniSub('jogar')}><Play size={14} /> Jogar</button>
            <button type="button" className={miniSub === 'ranking' ? 'active' : ''} onClick={() => setMiniSub('ranking')}><Trophy size={14} /> Ranking</button>
          </div>
          {miniSub === 'jogar' ? (
            <div className="games-grid">
              {GAMES.map((g) => (
                <Link key={g.id} to={`${base}/jogos/${g.id}`} className="game-tile">
                  <span className="game-ico"><g.icon size={26} /></span>
                  <b>{g.name}</b>
                  <small>{my[g.id]?.value ? `${my[g.id].value} pts${my[g.id].position ? ` · ${my[g.id].position}º` : ''}` : 'Jogar'}</small>
                </Link>
              ))}
            </div>
          ) : <MiniRankings base={base} online={online} initial={rankOf} />}
        </>
      )}
    </>
  );
}

/** Tutorial do jogo: objetivo, controles no celular e no computador, pontos e dicas. */
function Tutorial({ game }) {
  const t = TUTORIALS[game.id];
  if (!t) return <p>{game.how}</p>;
  return (
    <div className="tutorial">
      <h3><Target size={16} /> Objetivo</h3>
      <p>{t.objetivo}</p>
      {t.celular?.length > 0 && <><h3><Smartphone size={16} /> No celular</h3><ul>{t.celular.map((x) => <li key={x}>{x}</li>)}</ul></>}
      {t.computador?.length > 0 && <><h3><Keyboard size={16} /> No computador</h3><ul>{t.computador.map((x) => <li key={x}>{x}</li>)}</ul></>}
      {t.pontos && <><h3><Trophy size={16} /> Pontos</h3><p>{t.pontos}</p></>}
      {t.dicas?.length > 0 && <><h3><Lightbulb size={16} /> Dicas</h3><ul>{t.dicas.map((x) => <li key={x}>{x}</li>)}</ul></>}
    </div>
  );
}

/** Salva a pontuação mesmo se a pessoa sair da tela ou fechar o app no meio da partida. */
function saveQuietly(id, score) {
  try {
    fetch(`/api/jogos/${id}/pontos`, {
      method: 'POST', credentials: 'same-origin', keepalive: true,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ score }),
    }).catch(() => {});
  } catch { /* sem rede */ }
}

/** Botão de som: liga/desliga a música e os efeitos de todos os jogos. */
function SoundButton() {
  const [mute, setMute] = useState(isMuted());
  useEffect(() => onMuteChange(setMute), []);
  return (
    <button type="button" className="icon-btn game-sound" aria-label={mute ? 'Ligar o som' : 'Desligar o som'} title={mute ? 'Ligar o som' : 'Desligar o som'}
      onClick={() => { unlockAudio(); setMuted(!mute); }}>
      {mute ? <VolumeX size={20} /> : <Volume2 size={20} />}
    </button>
  );
}

/**
 * Deixa o jogo inteiro (com os botões) dentro da tela, sem precisar rolar: se ficar mais alto
 * que o espaço livre, o jogo fica mais estreito (e, junto, mais baixo) até caber.
 */
function useFitToScreen(ref, active) {
  const [maxW, setMaxW] = useState(null);
  useLayoutEffect(() => {
    if (!active) { setMaxW(null); return undefined; }
    const el = ref.current;
    if (!el) return undefined;
    let frame = 0;
    const fit = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        if (!r.height || !r.width) return;
        // Espaço do topo do jogo (na página) até o fim da tela.
        const free = window.innerHeight - (r.top + window.scrollY) - 10;
        const parent = el.parentElement?.clientWidth || r.width;
        const full = Math.min(480, parent);
        let next = r.width * (free / r.height);
        next = Math.max(240, Math.min(full, next));
        setMaxW((cur) => (cur && Math.abs(cur - next) < 4 ? cur : Math.round(next)));
      });
    };
    fit();
    const ro = new window.ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener('resize', fit);
    return () => { window.cancelAnimationFrame(frame); ro.disconnect(); window.removeEventListener('resize', fit); };
  }, [active, ref]);
  return maxW;
}

/** Tela de um jogo: instruções, partida (com Desistir) e resultado. */
export function GamePage({ base }) {
  const { id } = useParams();
  const nav = useNavigate();
  const game = gameById(id);
  const Comp = useMemo(() => (game ? gameComponent(game) : null), [game]);
  const [phase, setPhase] = useState('intro');
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState(null);
  const [rankKey, setRankKey] = useState(0);
  // Partida em andamento: pontos e fim de partidas antigas (ou repetidos) são ignorados.
  const live = useRef(0);
  const scoreRef = useRef(0);
  const online = useOnline();
  const rankRef = useRef(null);
  const stageRef = useRef(null);
  const fitW = useFitToScreen(stageRef, phase !== 'intro');

  // Saiu da tela (Voltar, outra aba do app) ou fechou o app no meio: os pontos contam.
  useEffect(() => {
    const leave = () => {
      if (live.current && scoreRef.current > 0) saveQuietly(id, scoreRef.current);
      live.current = 0;
    };
    window.addEventListener('pagehide', leave);
    return () => { window.removeEventListener('pagehide', leave); leave(); stopMusic(); };
  }, [id]);

  // Durante a partida, o "Voltar" do topo some: para sair, é o Desistir.
  useEffect(() => {
    document.body.classList.toggle('game-playing', phase === 'playing');
    return () => document.body.classList.remove('game-playing');
  }, [phase]);

  if (!game) return <Navigate to={`${base}/jogos`} replace />;

  const start = () => {
    unlockAudio();
    scoreRef.current = 0;
    setScore(0); setResult(null);
    live.current = round + 1; setRound(round + 1);
    setPhase('playing');
    window.scrollTo({ top: 0 });
    startMusic(game.id);
  };
  const end = (final) => {
    live.current = 0;
    stopMusic();
    const pts = Math.max(0, Math.floor(Number(final) || 0));
    scoreRef.current = pts;
    setScore(pts);
    setPhase('over');
    sfx(pts > 0 ? 'win' : 'lose');
    api.post(`/jogos/${game.id}/pontos`, { score: pts })
      .then((r) => { setResult(r); setRankKey((k) => k + 1); if (r.record) sfx('record'); })
      .catch((e) => setResult({ error: true, offline: !!e.offline }));
  };
  const seeRanking = () => {
    setPhase('intro');
    setTimeout(() => rankRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };
  return (
    <>
      <div className="game-head">
        <span className="game-ico"><game.icon size={24} /></span>
        <div className="grow">
          <h1>{game.name}</h1>
          {phase !== 'intro' && <span className="game-score">{score} pts</span>}
        </div>
        <SoundButton />
        {phase === 'playing' && <Button small variant="secondary" onClick={() => end(scoreRef.current)}><Flag size={14} /> Desistir</Button>}
      </div>

      {phase === 'intro' && (
        <Card className="game-intro">
          <Tutorial game={game} />
          {online
            ? <p className="small muted">{game.mode === 'sum' ? 'Cada partida soma pontos no seu total.' : 'Vale a sua melhor partida no ranking.'} Se desistir, os pontos que você fez contam.</p>
            : <p className="small offline-note">Sem internet: dá para jogar, mas a partida não entra no ranking.</p>}
          <div className="game-intro-actions">
            <Button variant="secondary" onClick={() => nav(`${base}/jogos`)}><ArrowLeft size={18} /> Voltar</Button>
            <Button onClick={start}><Play size={18} /> Iniciar</Button>
          </div>
        </Card>
      )}

      {phase !== 'intro' && (
        <div className="game-stage" ref={stageRef} style={fitW ? { maxWidth: fitW } : undefined}>
          <Suspense fallback={<Spinner />}>
            <Comp
              key={round}
              onScore={(n) => {
                if (live.current !== round) return;
                const v = Math.max(0, Math.floor(n) || 0);
                scoreRef.current = v;
                setScore(v);
              }}
              onEnd={(n) => live.current === round && end(n)}
            />
          </Suspense>
          {phase === 'over' && (
            <div className="game-over">
              <div className="game-over-card">
                <Trophy size={36} />
                <h2>{score} pontos</h2>
                {!result && <p className="small muted">Salvando...</p>}
                {result?.error && <p className="small">{result.offline ? 'Sem internet: esta partida não entra no ranking.' : 'Não deu para salvar a pontuação. Confira a internet.'}</p>}
                {result && !result.error && (
                  <p className="small">
                    {result.record ? <b>Novo recorde! </b> : null}
                    {game.mode === 'sum' ? `Total: ${result.total} pts` : `Seu recorde: ${result.best} pts`}
                    {result.position ? ` · ${result.position}º no ranking` : ''}
                  </p>
                )}
                <Button block onClick={start}><RotateCcw size={16} /> Jogar de novo</Button>
                <Button block variant="secondary" onClick={seeRanking}><Trophy size={16} /> Ver ranking</Button>
                <Button block variant="secondary" onClick={() => nav(`${base}/jogos`)}><ArrowLeft size={16} /> Voltar</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {phase === 'intro' && online && (
        <div ref={rankRef}>
          <Section title={`Ranking · ${valueLabel(game)}`}>
            <GameRanking key={rankKey} game={game} base={base} limit={20} />
          </Section>
        </div>
      )}
    </>
  );
}
