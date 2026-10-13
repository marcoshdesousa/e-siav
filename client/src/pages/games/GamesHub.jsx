// Mini jogos dos membros: lista de jogos, tela de cada jogo e ranking geral de cada um.
import { Suspense, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Play, RotateCcw, Trophy } from 'lucide-react';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Button, Card, Loading, PageHeader, Section, Spinner, Tabs, useLoad } from '../../ui.jsx';
import { RankingTable } from '../Ranking.jsx';
import { GAMES, gameById, gameComponent } from './games.js';
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

/** Lista de jogos + aba de rankings (cada jogo tem o seu). */
export function GamesHub({ base }) {
  const [tab, setTab] = useState('jogos');
  const [rankGame, setRankGame] = useState(GAMES[0].id);
  const mine = useLoad(() => api.get('/jogos/meus'));
  const my = mine.data || {};
  return (
    <>
      <PageHeader title="Mini jogos" subtitle="Jogue, faça pontos e suba no ranking de cada jogo. Sem anúncios!" />
      <Tabs tabs={[['jogos', 'Jogos'], ['ranking', 'Rankings']]} value={tab} onChange={setTab} />
      {tab === 'jogos' ? (
        <div className="games-grid">
          {GAMES.map((g) => (
            <Link key={g.id} to={`${base}/jogos/${g.id}`} className="game-tile">
              <span className="game-ico"><g.icon size={26} /></span>
              <b>{g.name}</b>
              <small>{my[g.id]?.value ? `${valueLabel(g)}: ${my[g.id].value}${my[g.id].position ? ` · ${my[g.id].position}º` : ''}` : 'Jogar'}</small>
            </Link>
          ))}
        </div>
      ) : (
        <>
          <select value={rankGame} onChange={(e) => setRankGame(e.target.value)} aria-label="Jogo">
            {GAMES.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <p className="small muted">{gameById(rankGame).mode === 'sum' ? 'Os pontos de todas as partidas vão somando.' : 'Vale a melhor partida de cada um.'} Ranking geral de todos os membros.</p>
          <GameRanking key={rankGame} game={gameById(rankGame)} base={base} />
        </>
      )}
    </>
  );
}

/** Tela de um jogo: instruções, partida e resultado. */
export function GamePage({ base }) {
  const { id } = useParams();
  const game = gameById(id);
  const Comp = useMemo(() => (game ? gameComponent(game) : null), [game]);
  const [phase, setPhase] = useState('intro');
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState(null);
  const [rankKey, setRankKey] = useState(0);
  // A partida em andamento: pontos e fim de partidas antigas (ou repetidos) são ignorados.
  const live = useRef(0);
  if (!game) return <Navigate to={`${base}/jogos`} replace />;
  const start = () => { setScore(0); setResult(null); live.current = round + 1; setRound(round + 1); setPhase('playing'); };
  const stop = () => { live.current = 0; setPhase('intro'); };
  const end = (final) => {
    live.current = 0;
    const pts = Math.max(0, Math.floor(Number(final) || 0));
    setScore(pts);
    setPhase('over');
    api.post(`/jogos/${game.id}/pontos`, { score: pts })
      .then((r) => { setResult(r); setRankKey((k) => k + 1); })
      .catch(() => setResult({ error: true }));
  };
  return (
    <>
      <div className="game-head">
        <span className="game-ico"><game.icon size={24} /></span>
        <div className="grow">
          <h1>{game.name}</h1>
          {phase !== 'intro' && <span className="game-score">{score} pts</span>}
        </div>
        {phase === 'playing' && <Button small variant="secondary" onClick={stop}>Sair</Button>}
      </div>

      {phase === 'intro' && (
        <Card className="game-intro">
          <p>{game.how}</p>
          <p className="small muted">{game.mode === 'sum' ? 'Cada partida soma pontos no seu total.' : 'Vale a sua melhor partida no ranking.'}</p>
          <Button block onClick={start}><Play size={18} /> Jogar</Button>
        </Card>
      )}

      {phase !== 'intro' && (
        <div className="game-stage">
          <Suspense fallback={<Spinner />}>
            <Comp
              key={round}
              onScore={(n) => live.current === round && setScore(Math.max(0, Math.floor(n) || 0))}
              onEnd={(n) => live.current === round && end(n)}
            />
          </Suspense>
          {phase === 'over' && (
            <div className="game-over">
              <div className="game-over-card">
                <Trophy size={36} />
                <h2>{score} pontos</h2>
                {!result && <p className="small muted">Salvando...</p>}
                {result?.error && <p className="small">Não deu para salvar a pontuação. Confira a internet.</p>}
                {result && !result.error && (
                  <p className="small">
                    {result.record ? <b>Novo recorde! </b> : null}
                    {game.mode === 'sum' ? `Total: ${result.total} pts` : `Seu recorde: ${result.best} pts`}
                    {result.position ? ` · ${result.position}º no ranking` : ''}
                  </p>
                )}
                <Button block onClick={start}><RotateCcw size={16} /> Jogar de novo</Button>
                <Button block variant="secondary" onClick={() => setPhase('intro')}>Ver ranking</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {phase === 'intro' && (
        <Section title={`Ranking · ${valueLabel(game)}`}>
          <GameRanking key={rankKey} game={game} base={base} limit={20} />
        </Section>
      )}
    </>
  );
}

/** Álbuns de figurinhas: por enquanto só o Palmares 27, em breve. */
export function AlbumsPage() {
  return (
    <>
      <PageHeader title="Álbuns de figurinhas" subtitle="Colecione as figurinhas dos desbravadores" />
      <div className="album-card">
        <div className="album-cover">
          <span className="album-year">27</span>
          <b>Palmares</b>
        </div>
        <div className="album-info">
          <h2>Álbum Palmares 27</h2>
          <span className="badge badge-yellow">Em breve</span>
          <p className="small">Figurinhas digitais com a foto dos membros. Você gira, ganha uma figurinha aleatória e ela vale no app e no álbum físico. Cada página completa vale um requisito.</p>
        </div>
      </div>
    </>
  );
}
