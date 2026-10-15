// Surf DBV: tela do jogo (menu com a skin escolhida, partida em 3D e fim de corrida).
// Funciona sem internet; o ranking só vale quando a corrida termina com internet.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronsUp, Coins, Flag, Footprints, Magnet, Play, Rocket, RotateCcw, Shirt, Star, Trophy, Volume2, VolumeX, WifiOff } from 'lucide-react';
import { api } from '../../../api.js';
import { Button, Spinner } from '../../../ui.jsx';
import { useOnline as useInternet } from '../../../offline.js';
import { isMuted, onMuteChange, setMuted, sfx, startMusic, stopMusic, unlockAudio } from '../../games/audio.js';
import { createRunner, SKATE_TIME, SKATE_WAIT } from './engine.js';
import { POWERS } from './powerups.js';
import { boardById, readChoice, skinById, syncChoice } from '../avatar/skins.js';
import './corrida.css';

/** Botão do skate: mostra o tempo que falta ou a espera para usar de novo. */
function SkateButton({ skate, wait, onUse }) {
  const active = skate > 0;
  const k = active ? skate / SKATE_TIME : wait > 0 ? 1 - wait / SKATE_WAIT : 1;
  return (
    <button type="button" className={'corrida-skate' + (active ? ' on' : wait > 0 ? ' wait' : ' ready')} onPointerDown={(e) => { e.stopPropagation(); onUse(); }} aria-label="Usar o skate">
      <svg viewBox="0 0 64 64" className="ring" aria-hidden="true">
        <defs><linearGradient id="skring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#67e8f9" /><stop offset="1" stopColor="#a78bfa" /></linearGradient></defs>
        <circle cx="32" cy="32" r="29" className="bg" />
        <circle cx="32" cy="32" r="29" pathLength="100" strokeDasharray={`${k * 100} 100`} className="fg" />
      </svg>
      <svg viewBox="0 0 64 64" width="40" height="40" aria-hidden="true" className="board">
        <path d="M6 30 Q6 24 12 25 L52 25 Q58 24 58 30 Q58 35 52 34 L12 34 Q6 35 6 30Z" fill="#1d4ed8" stroke="#0b1f4d" strokeWidth="2" />
        <path d="M13 28 L51 28" stroke="#facc15" strokeWidth="3" strokeLinecap="round" />
        <circle cx="18" cy="41" r="5" fill="#22d3ee" stroke="#0b1f4d" strokeWidth="2" /><circle cx="46" cy="41" r="5" fill="#22d3ee" stroke="#0b1f4d" strokeWidth="2" />
      </svg>
      <small>{active ? `${Math.ceil(skate)}s` : wait > 0 ? `${Math.ceil(wait)}s` : 'Skate'}</small>
    </button>
  );
}

const POWER_ICON = { ima: Magnet, estrela: Star, foguete: Rocket, pulapula: ChevronsUp };
/** Poderes ativos, com a barrinha do tempo que falta. */
function PowerBar({ power }) {
  const on = Object.entries(power || {}).filter(([, v]) => v > 0);
  if (!on.length) return null;
  return (
    <div className="corrida-powers">
      {on.map(([k, v]) => {
        const Icon = POWER_ICON[k];
        return (
          <span key={k} className={'corrida-power p-' + k + (v < 2 ? ' ending' : '')}>
            <Icon size={16} />
            <i style={{ width: `${(v / POWERS[k].time) * 100}%` }} />
          </span>
        );
      })}
    </div>
  );
}

export default function CorridaPage({ base }) {
  const nav = useNavigate();
  const internet = useInternet();
  const canvasRef = useRef(null);
  const game = useRef(null);
  const [look, setLook] = useState(readChoice);
  const [phase, setPhase] = useState('menu'); // menu | story | run | over
  const [hud, setHud] = useState({ coins: 0, dist: 0, skate: 0, skateWait: 0 });
  const [warn, setWarn] = useState(null);
  const [result, setResult] = useState(null);
  const [mine, setMine] = useState(null);
  const [round, setRound] = useState(0);
  const [ready, setReady] = useState(false);
  const [mute, setMute] = useState(isMuted());
  useEffect(() => onMuteChange(setMute), []);

  const loadMine = () => api.get('/jogos/meus').then((m) => setMine(m)).catch(() => {});
  useEffect(() => { loadMine(); syncChoice().then((c) => { setLook(c); game.current?.setLook(c.skin, c.board); }); }, []);

  // Cria o mundo 3D (de novo a cada partida)
  useEffect(() => {
    if (!canvasRef.current) return undefined;
    const c = readChoice();
    const g = createRunner(canvasRef.current, {
      skin: c.skin,
      board: c.board,
      onHud: (h) => {
        if (h.warn) { setWarn({ text: h.warn, good: !!h.good, id: Date.now() }); setTimeout(() => setWarn((w) => (w && Date.now() - w.id >= 1500 ? null : w)), 1600); return; }
        setHud(h);
      },
      onSound: (n) => sfx(n),
      onEnd: async (r) => {
        stopMusic();
        setPhase('over');
        if (!window.navigator.onLine) { setResult({ ...r, offline: true }); return; }
        setResult({ ...r, saving: true });
        try {
          const [a, b] = await Promise.all([
            api.post('/jogos/corrida-moedas/pontos', { score: r.coins }),
            api.post('/jogos/corrida-distancia/pontos', { score: r.dist }),
          ]);
          setResult({ ...r, coinsRec: a, distRec: b });
          if (a.record || b.record) sfx('record');
          loadMine();
        } catch (e) {
          setResult({ ...r, offline: !!e.offline, error: e.offline ? null : 'Não deu para salvar.' });
        }
      },
    });
    game.current = g;
    setReady(true);
    return () => { g.dispose(); game.current = null; stopMusic(); };
  }, [round]);

  useEffect(() => {
    document.body.classList.toggle('corrida-playing', phase === 'run' || phase === 'story');
    return () => document.body.classList.remove('corrida-playing');
  }, [phase]);

  // Teclado
  useEffect(() => {
    const k = (e) => {
      const g = game.current;
      if (!g || phase !== 'run') return;
      const map = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ' ': 'up', ArrowDown: 'down', s: 'down' };
      if (e.key === 'e' || e.key === 'Shift') { g.useSkate(); return; }
      const a = map[e.key];
      if (a) { e.preventDefault(); g.input[a](); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [phase]);

  // Deslizar o dedo; dois toques rápidos = skate
  const touch = useRef(null);
  const lastTap = useRef(0);
  const onDown = (e) => { touch.current = { x: e.clientX, y: e.clientY, done: false, t: Date.now() }; };
  const onMove = (e) => {
    const t = touch.current;
    if (!t || t.done || phase !== 'run') return;
    const dx = e.clientX - t.x;
    const dy = e.clientY - t.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 26) return;
    t.done = true;
    const g = game.current;
    if (Math.abs(dx) > Math.abs(dy)) g?.input[dx < 0 ? 'left' : 'right']();
    else g?.input[dy < 0 ? 'up' : 'down']();
  };
  const onUp = () => {
    const t = touch.current;
    touch.current = null;
    if (!t || t.done || phase !== 'run' || Date.now() - t.t > 250) return;
    if (Date.now() - lastTap.current < 320) game.current?.useSkate();
    lastTap.current = Date.now();
  };

  const play = () => {
    unlockAudio();
    setResult(null);
    setHud({ coins: 0, dist: 0, skate: 0, skateWait: 0 });
    setPhase('story');
    game.current?.story();
    setTimeout(() => { setPhase('run'); game.current?.start(); startMusic('corrida'); }, 2700);
  };
  const again = () => { setReady(false); setRound((r) => r + 1); setPhase('menu'); setTimeout(play, 120); };

  const wallet = mine?.['corrida-moedas']?.total || 0;
  const bestCoins = mine?.['corrida-moedas']?.best || 0;
  const bestDist = mine?.['corrida-distancia']?.best || 0;

  return (
    <div className={'corrida ' + phase}>
      <div className="corrida-stage" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { touch.current = null; }}>
        <canvas key={round} ref={canvasRef} className="corrida-canvas" />
        {!ready && <div className="corrida-loading"><Spinner /></div>}

        {(phase === 'run' || phase === 'story') && (
          <div className="corrida-hud">
            <span className="corrida-pill gold"><Coins size={16} /> {hud.coins}{hud.power?.estrela > 0 && <b className="corrida-x2">x2</b>}</span>
            <span className="corrida-pill"><Footprints size={16} /> {hud.dist} m</span>
            <span className="grow" />
            <button type="button" className="corrida-btn" onPointerDown={(e) => e.stopPropagation()} onClick={() => { unlockAudio(); setMuted(!mute); }} aria-label="Som">{mute ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
            <button type="button" className="corrida-btn" onPointerDown={(e) => e.stopPropagation()} onClick={() => game.current?.giveUp()}><Flag size={16} /> Desistir</button>
          </div>
        )}
        {phase === 'run' && <SkateButton skate={hud.skate} wait={hud.skateWait} onUse={() => game.current?.useSkate()} />}
        {phase === 'run' && hud.close && !warn && <div className="corrida-police">O guarda está perto!</div>}
        {warn && <div key={warn.id} className={'corrida-warn' + (warn.good ? ' good' : '')}>{warn.text}</div>}
        {phase === 'run' && <PowerBar power={hud.power} />}

        {phase === 'story' && (
          <div className="corrida-story">
            <p>Você terminou de pintar o símbolo dos Desbravadores no trem...</p>
            <b>O guarda viu! CORRA!</b>
          </div>
        )}

        {phase === 'menu' && (
          <div className="corrida-menu">
            <h1><span>Surf</span> DBV</h1>
            <button type="button" className="corrida-look" onClick={() => nav(`${base}/jogos?aba=skin`)}>
              <Shirt size={20} />
              <span className="grow"><b>{skinById(look.skin).name}</b><small>Skate {boardById(look.board).name}</small></span>
              <span className="chip">Trocar skin</span>
            </button>
            <div className="corrida-stats">
              <span><Coins size={14} /> {wallet} desbrava coins</span>
              <span><Trophy size={14} /> Recordes: {bestCoins} moedas · {bestDist} m</span>
              {!internet && <span className="off"><WifiOff size={14} /> Sem internet: dá para jogar, mas não vale para o ranking.</span>}
            </div>
            <button type="button" className="corrida-go" onClick={play} disabled={!ready}><Play size={22} /> Correr</button>
            <p className="small corrida-help">Deslize: ← → troca de trilho · ↑ pula · ↓ rola · dois toques = skate. Pegue os poderes: ímã, estrela x2, foguete e pula-pula! No computador: setas ou W A S D e E para o skate.</p>
            <div className="corrida-row">
              <Button small variant="secondary" onClick={() => nav(`${base}/jogos`)}><ArrowLeft size={14} /> Voltar</Button>
              <Button small variant="secondary" disabled={!internet} onClick={() => nav(`${base}/jogos?aba=ranking&jogo=corrida-moedas`)}><Trophy size={14} /> Ranking</Button>
            </div>
          </div>
        )}

        {phase === 'over' && result && (
          <div className="game-over">
            <div className="game-over-card">
              <Trophy size={36} />
              <h2>{result.crash ? 'Bateu no trem!' : 'O guarda pegou você!'}</h2>
              <p><Coins size={16} /> <b>{result.coins}</b> moedas · <Footprints size={16} /> <b>{result.dist}</b> m</p>
              {result.saving && <p className="small muted">Salvando...</p>}
              {result.offline && <p className="small"><WifiOff size={13} /> Sem internet: esta corrida não entrou no ranking.</p>}
              {result.error && <p className="small">{result.error}</p>}
              {result.coinsRec && (
                <p className="small">
                  {result.coinsRec.record || result.distRec.record ? <b>Novo recorde! </b> : null}
                  Recordes: {result.coinsRec.best} moedas ({result.coinsRec.position ? `${result.coinsRec.position}º` : '—'}) · {result.distRec.best} m ({result.distRec.position ? `${result.distRec.position}º` : '—'})
                </p>
              )}
              <Button block onClick={again}><RotateCcw size={16} /> Jogar de novo</Button>
              <Button block variant="secondary" disabled={!internet} onClick={() => nav(`${base}/jogos?aba=ranking&jogo=corrida-moedas`)}><Trophy size={16} /> Ver ranking</Button>
              <Button block variant="secondary" onClick={() => { setReady(false); setRound((r) => r + 1); setPhase('menu'); }}><ArrowLeft size={16} /> Voltar</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
