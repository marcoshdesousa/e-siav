// Jogos dos membros (jogos grandes + mini-jogos): lista de jogos, tela de cada jogo e ranking geral de cada um.
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Flag, Keyboard, Layers, Lightbulb, Smartphone, Target, Pickaxe, PersonStanding, Play, RotateCcw, TrainFront, Trophy, Volume2, VolumeX } from 'lucide-react';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Button, Card, Loading, PageHeader, Section, Spinner, Tabs, useLoad } from '../../ui.jsx';
import { RankingTable } from '../Ranking.jsx';
import { GAMES, gameById, gameComponent } from './games.js';
import { isMuted, onMuteChange, setMuted, sfx, startMusic, stopMusic, unlockAudio } from './audio.js';
import { useOnline } from '../../offline.js';
import TUTORIALS from './tutorials.json';
import './games.css';

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
  { id: 'uno', name: 'Uno DBV', hint: 'Cartas online, 2 a 6 jogadores, com chat de voz', icon: Layers, ranks: [['uno', 'Vitórias']], ready: true },
  { id: 'corrida', name: 'Corrida DBV', hint: 'Corra pelos trilhos, fuja do guarda e junte desbrava coins', icon: TrainFront, ranks: [['corrida-moedas', 'Mais moedas'], ['corrida-distancia', 'Maior distância']], ready: true },
  { id: 'stumble', name: 'Stumble DBV', hint: 'Até 10 jogadores em fases malucas. Só o 1º vence', icon: PersonStanding, ranks: [['stumble', 'Vitórias']], ready: true },
  { id: 'craft', name: 'DesbravaCraft', hint: 'Construa o seu mundo sozinho ou com até 10 amigos', icon: Pickaxe, ranks: [], ready: true },
];

function BigGames({ base }) {
  return (
    <div className="big-games">
      {BIG_GAMES.map((g) => {
        const body = (
          <>
            <span className="big-game-ico"><g.icon size={34} /></span>
            <div className="grow">
              <b>{g.name}</b>
              <small>{g.hint}</small>
            </div>
            {g.ready ? <Play size={26} /> : <span className="chip">Em breve</span>}
          </>
        );
        return g.ready
          ? <Link key={g.id} to={`${base}/jogos/${g.id}`} className="big-game">{body}</Link>
          : <div key={g.id} className="big-game soon">{body}</div>;
      })}
      <p className="small muted center">Os jogos grandes precisam de internet, menos o mundo offline do DesbravaCraft.</p>
    </div>
  );
}

/** Rankings: primeiro escolhe Mini-jogos ou Jogos, depois o jogo. */
function GamesRankings({ base, online, initial }) {
  const ranked = BIG_GAMES.filter((g) => g.ranks.length);
  const initialBig = ranked.find((g) => g.ranks.some((r) => r[0] === initial));
  const [kind, setKind] = useState(initialBig ? 'big' : 'mini');
  const [rankGame, setRankGame] = useState(GAMES.some((g) => g.id === initial) ? initial : GAMES[0].id);
  const [big, setBig] = useState(initialBig?.id || ranked[0].id);
  const bigGame = ranked.find((g) => g.id === big);
  const [board, setBoard] = useState(initialBig ? initial : bigGame.ranks[0][0]);
  const boardId = bigGame.ranks.some((r) => r[0] === board) ? board : bigGame.ranks[0][0];
  return (
    <>
      <div className="seg games-rank-kind" role="tablist">
        <button type="button" className={kind === 'mini' ? 'active' : ''} onClick={() => setKind('mini')}>Mini-jogos</button>
        <button type="button" className={kind === 'big' ? 'active' : ''} onClick={() => setKind('big')}>Jogos</button>
      </div>
      {kind === 'mini' ? (
        <>
          <select value={rankGame} onChange={(e) => setRankGame(e.target.value)} aria-label="Jogo">
            {GAMES.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <p className="small muted">{gameById(rankGame).mode === 'sum' ? 'Os pontos de todas as partidas vão somando.' : 'Vale a melhor partida de cada um.'} Ranking geral de todos os membros.</p>
          {online ? <GameRanking key={rankGame} game={gameById(rankGame)} base={base} /> : <Card className="small center">Os rankings precisam de internet. Sem internet, dá para jogar, mas as partidas não entram no ranking.</Card>}
        </>
      ) : (
        <>
          <select value={big} onChange={(e) => setBig(e.target.value)} aria-label="Jogo">
            {ranked.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          {bigGame.ranks.length > 1 && (
            <div className="seg games-rank-kind" role="tablist">
              {bigGame.ranks.map(([id, label]) => <button key={id} type="button" className={boardId === id ? 'active' : ''} onClick={() => setBoard(id)}>{label}</button>)}
            </div>
          )}
          {!bigGame.ready ? <Card className="small center">O ranking de {bigGame.name} começa quando o jogo for lançado.</Card>
            : online ? <><p className="small muted">{bigGame.ranks.find((r) => r[0] === boardId)[1]} · ranking geral de todos os membros.</p><GameRanking key={boardId} game={{ id: boardId, mode: 'sum' }} base={base} /></>
              : <Card className="small center">Os rankings precisam de internet.</Card>}
        </>
      )}
    </>
  );
}

/** Aba Jogos: jogos grandes, mini-jogos e rankings. */
export function GamesHub({ base }) {
  const [params] = useSearchParams();
  const [tab, setTab] = useState(() => { if (params.get('aba') === 'ranking') return 'ranking'; try { return window.sessionStorage.getItem('dbv-games-tab') || 'mini'; } catch { return 'mini'; } });
  const pick = (t) => { setTab(t); try { window.sessionStorage.setItem('dbv-games-tab', t); } catch { /* sem armazenamento */ } };
  const mine = useLoad(() => api.get('/jogos/meus'));
  const my = mine.data || {};
  const online = useOnline();
  return (
    <>
      <PageHeader title="Jogos" subtitle={`Jogos online e ${GAMES.length} mini-jogos para fazer pontos e subir no ranking. Sem anúncios!`} />
      <Tabs tabs={[['jogos', 'Jogos'], ['mini', 'Mini-jogos'], ['ranking', 'Rankings']]} value={tab} onChange={pick} />
      {tab === 'jogos' && <BigGames base={base} />}
      {tab === 'mini' && (
        <div className="games-grid">
          {GAMES.map((g) => (
            <Link key={g.id} to={`${base}/jogos/${g.id}`} className="game-tile">
              <span className="game-ico"><g.icon size={26} /></span>
              <b>{g.name}</b>
              <small>{my[g.id]?.value ? `${my[g.id].value} pts${my[g.id].position ? ` · ${my[g.id].position}º` : ''}` : 'Jogar'}</small>
            </Link>
          ))}
        </div>
      )}
      {tab === 'ranking' && <GamesRankings base={base} online={online} initial={params.get('jogo')} />}
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
