// Corrida DBV: tela do jogo (menu, escolha do personagem, partida em 3D e fim de corrida).
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Coins, Flag, Footprints, Play, RotateCcw, Trophy, Volume2, VolumeX, WifiOff } from 'lucide-react';
import { api } from '../../../api.js';
import { Button, Card, PageHeader, Spinner } from '../../../ui.jsx';
import { useOnline as useInternet } from '../../../offline.js';
import { isMuted, onMuteChange, setMuted, sfx, startMusic, stopMusic, unlockAudio } from '../../games/audio.js';
import { createRunner } from './engine.js';
import './corrida.css';

const readGender = () => { try { return window.localStorage.getItem('dbv-corrida-menina') === '1'; } catch { return false; } };
const saveGender = (f) => { try { window.localStorage.setItem('dbv-corrida-menina', f ? '1' : '0'); } catch { /* sem armazenamento */ } };

export default function CorridaPage({ base }) {
  const nav = useNavigate();
  const internet = useInternet();
  const canvasRef = useRef(null);
  const game = useRef(null);
  const [female, setFemale] = useState(readGender);
  const [phase, setPhase] = useState('menu'); // menu | story | run | over
  const [hud, setHud] = useState({ coins: 0, dist: 0 });
  const [warn, setWarn] = useState('');
  const [result, setResult] = useState(null);
  const [mine, setMine] = useState(null);
  const [round, setRound] = useState(0);
  const [mute, setMute] = useState(isMuted());
  useEffect(() => onMuteChange(setMute), []);

  const loadMine = () => api.get('/jogos/meus').then((m) => setMine(m)).catch(() => {});
  useEffect(() => { loadMine(); }, []);

  // Cria o mundo 3D (de novo a cada partida)
  useEffect(() => {
    if (!canvasRef.current) return undefined;
    const g = createRunner(canvasRef.current, {
      female,
      onHud: (h) => {
        if (h.warn) { setWarn(h.warn); setTimeout(() => setWarn(''), 1600); return; }
        setHud(h);
      },
      onSound: (n) => {
        if (n === 'whistle') sfx('error');
        else sfx(n);
      },
      onEnd: async (r) => {
        stopMusic();
        setPhase('over');
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
          setResult({ ...r, error: e.offline ? 'Sem internet: a corrida não entrou no ranking.' : 'Não deu para salvar.' });
        }
      },
    });
    game.current = g;
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
      const a = map[e.key];
      if (a) { e.preventDefault(); g.input[a](); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [phase]);

  // Deslizar o dedo
  const touch = useRef(null);
  const onDown = (e) => { touch.current = { x: e.clientX, y: e.clientY, done: false }; };
  const onMove = (e) => {
    const t = touch.current;
    if (!t || t.done || phase !== 'run') return;
    const dx = e.clientX - t.x;
    const dy = e.clientY - t.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
    t.done = true;
    const g = game.current;
    if (Math.abs(dx) > Math.abs(dy)) g?.input[dx < 0 ? 'left' : 'right']();
    else g?.input[dy < 0 ? 'up' : 'down']();
  };
  const onUp = () => { touch.current = null; };

  const pickGender = (f) => { setFemale(f); saveGender(f); game.current?.setFemale(f); sfx('tap'); };
  const play = () => {
    unlockAudio();
    setResult(null);
    setHud({ coins: 0, dist: 0 });
    setPhase('story');
    setTimeout(() => { setPhase('run'); game.current?.start(); startMusic('corrida'); }, 2600);
  };
  const again = () => { setRound((r) => r + 1); setPhase('menu'); setTimeout(play, 50); };

  const wallet = mine?.['corrida-moedas']?.total || 0;
  const bestCoins = mine?.['corrida-moedas']?.best || 0;
  const bestDist = mine?.['corrida-distancia']?.best || 0;

  if (!internet) return <><PageHeader title="Corrida DBV" /><Card className="center"><WifiOff size={30} /><p>A Corrida DBV precisa de internet.</p></Card></>;

  return (
    <div className={'corrida ' + phase}>
      <div className="corrida-stage" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <canvas key={round} ref={canvasRef} className="corrida-canvas" />
        {!game.current && phase === 'menu' && <div className="corrida-loading"><Spinner /></div>}

        {(phase === 'run' || phase === 'story') && (
          <div className="corrida-hud">
            <span className="corrida-pill"><Coins size={16} /> {hud.coins}</span>
            <span className="corrida-pill"><Footprints size={16} /> {hud.dist} m</span>
            <span className="grow" />
            <button type="button" className="corrida-btn" onClick={() => { unlockAudio(); setMuted(!mute); }} aria-label="Som">{mute ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
            <button type="button" className="corrida-btn" onClick={() => game.current?.giveUp()}><Flag size={16} /> Desistir</button>
          </div>
        )}
        {phase === 'run' && hud.close && !warn && <div className="corrida-police">O guarda está perto!</div>}
        {warn && <div className="corrida-warn">{warn}</div>}

        {phase === 'story' && (
          <div className="corrida-story">
            <p>Você acabou de pintar o símbolo dos Desbravadores no muro da estação...</p>
            <b>O guarda viu! CORRA!</b>
          </div>
        )}

        {phase === 'menu' && (
          <div className="corrida-menu">
            <h1>Corrida DBV</h1>
            <div className="corrida-gender">
              <button type="button" className={!female ? 'on' : ''} onClick={() => pickGender(false)}>Desbravador</button>
              <button type="button" className={female ? 'on' : ''} onClick={() => pickGender(true)}>Desbravadora</button>
            </div>
            <div className="corrida-stats">
              <span><Coins size={14} /> {wallet} desbrava coins</span>
              <span><Trophy size={14} /> Recordes: {bestCoins} moedas · {bestDist} m</span>
            </div>
            <Button block onClick={play}><Play size={18} /> Correr</Button>
            <p className="small corrida-help">Deslize: ← → troca de trilho · ↑ pula · ↓ rola. No computador: setas ou W A S D.</p>
            <div className="corrida-row">
              <Button small variant="secondary" onClick={() => nav(`${base}/jogos`)}><ArrowLeft size={14} /> Voltar</Button>
              <Button small variant="secondary" onClick={() => nav(`${base}/jogos?aba=ranking&jogo=corrida-moedas`)}><Trophy size={14} /> Ranking</Button>
            </div>
          </div>
        )}

        {phase === 'over' && result && (
          <div className="game-over">
            <div className="game-over-card">
              <Trophy size={36} />
              <h2>O guarda pegou você!</h2>
              <p><Coins size={16} /> <b>{result.coins}</b> moedas · <Footprints size={16} /> <b>{result.dist}</b> m</p>
              {result.saving && <p className="small muted">Salvando...</p>}
              {result.error && <p className="small">{result.error}</p>}
              {result.coinsRec && (
                <p className="small">
                  {result.coinsRec.record || result.distRec.record ? <b>Novo recorde! </b> : null}
                  Recordes: {result.coinsRec.best} moedas ({result.coinsRec.position ? `${result.coinsRec.position}º` : '—'}) · {result.distRec.best} m ({result.distRec.position ? `${result.distRec.position}º` : '—'})
                </p>
              )}
              <Button block onClick={again}><RotateCcw size={16} /> Jogar de novo</Button>
              <Button block variant="secondary" onClick={() => nav(`${base}/jogos?aba=ranking&jogo=corrida-moedas`)}><Trophy size={16} /> Ver ranking</Button>
              <Button block variant="secondary" onClick={() => { setRound((r) => r + 1); setPhase('menu'); }}><ArrowLeft size={16} /> Voltar</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
