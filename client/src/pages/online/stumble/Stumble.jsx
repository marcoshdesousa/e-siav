// Stumble DBV: saguão (visual, partida aleatória, criar/entrar em sala), sala de espera e a partida.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { ArrowLeft, Copy, Crown, Globe2, Hash, Lock, LogOut, Mic, MicOff, Play, RefreshCw, Shirt, Timer, Trophy, UserX, Users, Wifi, WifiOff } from 'lucide-react';
import { Button, Card, Modal, PageHeader, Section } from '../../../ui.jsx';
import { useOnline as useInternet } from '../../../offline.js';
import { sfx, startMusic, stopMusic, unlockAudio } from '../../games/audio.js';
import { useOnline } from '../net.js';
import { useVoice } from '../voice.js';
import { BotTag, VoiceBar } from '../Uno.jsx';
import { animate, makeStumbler } from './character.js';
import { createStumble } from './engine.js';
import { OUTFITS, outfitById } from './outfits.js';
import { STAGES } from './stages.js';
import './stumble.css';

const readOutfit = () => { try { return window.localStorage.getItem('dbv-stumble-visual') || 'm01'; } catch { return 'm01'; } };

/** Mostra o boneco com o visual escolhido, girando. */
function OutfitPreview({ outfit, height = 180 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#fff', '#64748b', 2));
    const d = new THREE.DirectionalLight('#fff', 1.2);
    d.position.set(2, 4, -3);
    scene.add(d);
    const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    cam.position.set(0, 1.4, -5.2);
    cam.lookAt(0, 1.15, 0);
    const p = makeStumbler(outfitById(outfit));
    scene.add(p);
    let raf = 0;
    let t = 0;
    const loop = () => {
      raf = window.requestAnimationFrame(loop);
      t += 1 / 60;
      p.rotation.y = Math.sin(t * 0.8) * 0.7;
      animate(p, t, 'idle');
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.floor(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
      renderer.render(scene, cam);
    };
    loop();
    return () => { window.cancelAnimationFrame(raf); renderer.dispose(); };
  }, [outfit]);
  return <canvas ref={ref} className="stb-preview" style={{ height }} />;
}

function OutfitPicker({ value, onChange, onClose }) {
  const [g, setG] = useState(outfitById(value).g);
  return (
    <Modal title="Escolha o seu visual" onClose={onClose}>
      <OutfitPreview outfit={value} height={170} />
      <p className="center"><b>{outfitById(value).name}</b></p>
      <div className="seg stb-seg">
        <button type="button" className={g === 'm' ? 'active' : ''} onClick={() => setG('m')}>Meninos</button>
        <button type="button" className={g === 'f' ? 'active' : ''} onClick={() => setG('f')}>Meninas</button>
      </div>
      <div className="stb-outfits">
        {OUTFITS.filter((o) => o.g === g).map((o) => (
          <button key={o.id} type="button" className={'stb-outfit' + (o.id === value ? ' on' : '')} onClick={() => onChange(o.id)}>
            <span className="stb-swatch" style={{ background: `linear-gradient(180deg, ${o.hatColor || o.hairColor} 0 22%, ${o.skin} 22% 42%, ${o.top} 42% 72%, ${o.bottom} 72%)` }} />
            <small>{o.name}</small>
          </button>
        ))}
      </div>
      <Button block onClick={onClose}>Pronto</Button>
    </Modal>
  );
}

export default function StumblePage({ base }) {
  const net = useOnline('stumble');
  const internet = useInternet();
  const [outfit, setOutfitState] = useState(readOutfit);
  const setOutfit = (o) => {
    setOutfitState(o);
    try { window.localStorage.setItem('dbv-stumble-visual', o); } catch { /* sem armazenamento */ }
    if (net.room?.status === 'waiting') net.send({ t: 'outfit', outfit: o });
  };
  const { room } = net;
  const humanPlayers = useMemo(() => room?.players.filter((p) => !p.bot), [room?.players]);
  const voice = useVoice({ me: net.me, players: humanPlayers, send: net.send, listen: net.listen });
  useEffect(() => {
    document.body.classList.toggle('online-playing', !!room);
    return () => document.body.classList.remove('online-playing');
  }, [room]);
  if (!internet) return <><PageHeader title="Stumble DBV" /><Card className="center"><WifiOff size={30} /><p>O Stumble DBV precisa de internet.</p></Card></>;
  return (
    <div className="stb-page">
      {!net.connected && <div className="uno-conn"><RefreshCw size={14} className="spin" /> Conectando...</div>}
      {!room && <Lobby net={net} base={base} outfit={outfit} setOutfit={setOutfit} />}
      {room && room.status === 'waiting' && <Waiting net={net} outfit={outfit} setOutfit={setOutfit} voice={voice} />}
      {room && room.status !== 'waiting' && net.game && <Match net={net} outfit={outfit} base={base} voice={voice} />}
    </div>
  );
}

function Lobby({ net, base, outfit, setOutfit }) {
  const nav = useNavigate();
  const [pick, setPick] = useState(false);
  const [code, setCode] = useState('');
  const [pub, setPub] = useState(true);
  const go = (m) => { unlockAudio(); sfx('tap'); net.send({ ...m, outfit }); };
  return (
    <>
      <div className="stb-hero">
        <h1>Stumble <span>DBV</span></h1>
        <p><Wifi size={13} /> {net.lobby?.online ?? '…'} jogando agora</p>
      </div>
      <div className="stb-me">
        <OutfitPreview outfit={outfit} height={190} />
        <Button small variant="secondary" onClick={() => setPick(true)}><Shirt size={14} /> {outfitById(outfit).name}</Button>
      </div>
      {net.kicked && <Card className="small center">O dono da sala tirou você da sala.</Card>}
      {net.error && <Card className="small center uno-err">{net.error.msg}</Card>}
      <button type="button" className="stb-play" onClick={() => go({ t: 'quick', game: 'stumble', size: 10 })}>
        <Play size={26} /> <b>Jogar</b><small>Até 10 jogadores · 3 fases · só o 1º vence</small>
      </button>
      <Section title="Criar sala">
        <Card>
          <div className="seg stb-seg">
            <button type="button" className={pub ? 'active' : ''} onClick={() => setPub(true)}><Globe2 size={13} /> Pública</button>
            <button type="button" className={!pub ? 'active' : ''} onClick={() => setPub(false)}><Lock size={13} /> Privada</button>
          </div>
          <p className="small muted">Mínimo de 3 jogadores e máximo de 10. Você começa quando quiser.</p>
          <Button block onClick={() => go({ t: 'create', game: 'stumble', size: 10, public: pub })}>Criar sala</Button>
        </Card>
      </Section>
      <Section title="Entrar com código">
        <div className="uno-code-in">
          <input inputMode="numeric" maxLength={4} placeholder="0000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))} />
          <Button disabled={code.length !== 4} onClick={() => go({ t: 'join', code })}>Entrar</Button>
        </div>
      </Section>
      <Section title="Salas públicas">
        {!net.lobby?.rooms?.length ? <p className="small muted center">Nenhuma sala pública esperando agora.</p> : (
          <div className="list">
            {net.lobby.rooms.map((r) => (
              <div key={r.code} className="list-item">
                <Hash size={18} />
                <div className="grow"><div className="title">Sala de {r.owner}</div><div className="sub">{r.count}/{r.size} jogadores · código {r.code}</div></div>
                <Button small onClick={() => go({ t: 'join', code: r.code })}>Entrar</Button>
              </div>
            ))}
          </div>
        )}
      </Section>
      <div className="uno-actions">
        <Button variant="secondary" onClick={() => nav(`${base}/jogos`)}><ArrowLeft size={16} /> Voltar</Button>
        <Button variant="secondary" onClick={() => nav(`${base}/jogos?aba=ranking&jogo=stumble`)}><Trophy size={16} /> Ranking</Button>
      </div>
      {pick && <OutfitPicker value={outfit} onChange={setOutfit} onClose={() => setPick(false)} />}
    </>
  );
}

/** Relógio do servidor: a diferença é medida quando chega cada mensagem da sala (não a cada desenho). */
function useServerClock(room) {
  const off = useRef(0);
  const seen = useRef(null);
  if (room?.now && seen.current !== room.now) {
    seen.current = room.now;
    off.current = room.now - Date.now();
  }
  return () => Date.now() + off.current;
}

function Waiting({ net, outfit, setOutfit, voice }) {
  const { room, me } = net;
  const owner = room.owner === me;
  const clock = useServerClock(room);
  const [, force] = useState(0);
  const [pick, setPick] = useState(false);
  useEffect(() => { const t = setInterval(() => force((n) => n + 1), 500); return () => clearInterval(t); }, []);
  const left = room.startAt ? Math.max(0, Math.ceil((room.startAt - clock()) / 1000)) : null;
  const copy = () => window.navigator.clipboard?.writeText(room.code).catch(() => {});
  return (
    <>
      <div className="uno-waiting-head">
        <b>{room.quick ? 'Partida aleatória' : room.public ? 'Sala pública' : 'Sala privada'}</b>
        {!room.quick && <button type="button" className="uno-code" onClick={copy}><small>Código da sala</small><span>{room.code}</span><small><Copy size={12} /> Toque para copiar</small></button>}
        <div className="stb-count"><Users size={16} /> {room.players.length}/{room.size}</div>
        {room.quick && left != null && <div className="stb-countdown"><Timer size={18} /> Começa em {left}s</div>}
        <p className="small muted">{room.quick ? 'A partida sempre tem 10 jogadores: se faltar gente, robôs completam (e saem quando alguém entra).' : owner ? 'Você começa quando quiser: as vagas vazias viram robôs.' : 'O dono da sala vai começar.'}</p>
      </div>
      <div className="stb-players">
        {room.players.map((p) => (
          <div key={p.id} className="stb-player">
            <span className="stb-swatch" style={{ background: (() => { const o = outfitById(p.outfit); return `linear-gradient(180deg, ${o.hatColor || o.hairColor} 0 22%, ${o.skin} 22% 42%, ${o.top} 42% 72%, ${o.bottom} 72%)`; })() }} />
            <b>{p.name}{p.id === me ? ' (você)' : ''}</b>
            {p.bot && <BotTag />}
            {room.owner === p.id && !room.quick && <Crown size={13} />}
            {owner && !room.quick && p.id !== me && <button type="button" className="icon-btn" onClick={() => net.send({ t: 'kick', member: p.id })} aria-label="Tirar"><UserX size={15} /></button>}
          </div>
        ))}
      </div>
      <VoiceBar net={net} voice={voice} />
      <Button variant="secondary" onClick={() => setPick(true)}><Shirt size={16} /> Trocar visual</Button>
      <div className="uno-actions">
        <Button variant="secondary" onClick={() => net.send({ t: 'leave' })}><LogOut size={16} /> Sair</Button>
        {owner && !room.quick && <Button onClick={() => { unlockAudio(); net.send({ t: 'start' }); }}><Play size={16} /> Começar</Button>}
      </div>
      {net.error && <p className="small center uno-err">{net.error.msg}</p>}
      {pick && <OutfitPicker value={outfit} onChange={setOutfit} onClose={() => setPick(false)} />}
    </>
  );
}

// ───────────── Partida ─────────────

function Joystick({ onMove }) {
  const ref = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const id = useRef(null);
  const handle = (e) => {
    const r = ref.current.getBoundingClientRect();
    let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    setKnob({ x, y });
    onMove(x, y);
  };
  return (
    <div
      ref={ref}
      className="stb-joy"
      onPointerDown={(e) => { id.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); handle(e); }}
      onPointerMove={(e) => id.current === e.pointerId && handle(e)}
      onPointerUp={() => { id.current = null; setKnob({ x: 0, y: 0 }); onMove(0, 0); }}
      onPointerCancel={() => { id.current = null; setKnob({ x: 0, y: 0 }); onMove(0, 0); }}
    >
      <span className="stb-knob" style={{ transform: `translate(${knob.x * 34}px, ${knob.y * 34}px)` }} />
    </div>
  );
}

function Match({ net, outfit, base, voice }) {
  const nav = useNavigate();
  const { room, game: g, me } = net;
  const canvasRef = useRef(null);
  const eng = useRef(null);
  const clock = useServerClock(room);
  const clockRef = useRef(clock);
  clockRef.current = clock;
  const gRef = useRef(g);
  gRef.current = g;
  const [, tick] = useState(0);
  const [myPlace, setMyPlace] = useState(null);
  const [leave, setLeave] = useState(false);
  const alive = g.alive.includes(me);
  const names = useMemo(() => Object.fromEntries(room.players.map((p) => [p.id, p.name])), [room.players]);

  // Cria o mundo 3D uma vez
  useEffect(() => {
    const e = createStumble(canvasRef.current, {
      outfit,
      getTime: () => (clockRef.current() - gRef.current.raceStartAt) / 1000,
      onFinish: () => net.send({ t: 'act', action: { type: 'finish' } }),
      onProgress: (p) => net.send({ t: 'act', action: { type: 'progress', p } }),
      sendPos: (d) => net.send({ t: 'pos', d }),
      onSound: (n) => sfx(n),
    });
    eng.current = e;
    const off = net.listen((m) => { if (m.t === 'pos') e.remotePos(m.from, m.d); });
    const t = setInterval(() => tick((n) => n + 1), 250);
    startMusic('stumble');
    return () => { off(); clearInterval(t); e.dispose(); eng.current = null; stopMusic(); };
  }, []);

  // Nova fase: monta a pista e posiciona todo mundo na largada
  const stageKey = `${g.round}:${g.stage}`;
  useEffect(() => {
    const e = eng.current;
    if (!e) return;
    const order = [...g.alive].sort((a, b) => a - b);
    const slot = Math.max(0, order.indexOf(me));
    e.loadStage(g.stage, g.seed, slot, order.length);
    e.setPlayers(room.players.map((p) => ({ ...p, alive: g.alive.includes(p.id) })), me);
    order.forEach((id, i) => id !== me && e.placeRemote(id, i, order.length));
    setMyPlace(null);
  }, [stageKey]);
  useEffect(() => {
    eng.current?.setPlayers(room.players.map((p) => ({ ...p, alive: g.alive.includes(p.id) })), me);
  }, [room.players, g.alive, me]);
  useEffect(() => { eng.current?.setBots(g.botT, g.finished); }, [g.botT, g.finished]);

  // Fase do jogo → modo da câmera
  const now = clock();
  const toStart = (g.raceStartAt - now) / 1000;
  useEffect(() => {
    const e = eng.current;
    if (!e) return;
    if (g.phase === 'intro') e.setMode(alive ? 'intro' : 'spectate');
    else if (g.phase === 'race') e.setMode(alive ? 'race' : 'spectate');
    else e.setMode(alive ? 'race' : 'spectate');
  }, [g.phase, alive]);
  useEffect(() => {
    if (g.phase === 'intro') eng.current?.setIntro(Math.max(0, Math.min(1, 1 - (toStart - 1.5) / 3.5)));
    if (g.phase === 'intro' && toStart <= 1.2 && toStart > 0) eng.current?.setMode(alive ? 'race' : 'spectate');
  });
  useEffect(() => {
    const i = g.finished.indexOf(me);
    if (i >= 0 && myPlace == null) { setMyPlace(i + 1); sfx('record'); }
  }, [g.finished, me, myPlace]);
  useEffect(() => { if (room.status === 'over') sfx(room.result?.winner === me ? 'win' : 'lose'); }, [room.status]);

  // Teclado
  useEffect(() => {
    const keys = new Set();
    const upd = () => {
      const x = (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0);
      const z = (keys.has('ArrowDown') || keys.has('s') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('w') ? 1 : 0);
      const l = Math.hypot(x, z) || 1;
      eng.current?.input.move(x / l, z / l);
    };
    const down = (e) => {
      if (e.key === ' ') { e.preventDefault(); eng.current?.input.jump(); return; }
      if (e.key === 'Shift') { eng.current?.input.dive(); return; }
      keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      upd();
    };
    const up = (e) => { keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key); upd(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const stage = STAGES[g.stage % STAGES.length];
  const over = room.status === 'over';
  const raceLeft = g.phase === 'race' ? Math.max(0, Math.ceil((g.phaseEndsAt - now) / 1000)) : null;
  return (
    <div className="stb-match">
      <canvas ref={canvasRef} className="stb-canvas" />
      <div className="stb-hud">
        <span className="stb-pill">Fase {g.round + 1}/3</span>
        <span className="stb-pill">{g.round >= 2 ? 'Final' : `Passam ${g.qualify}`} · {g.finished.length}/{g.qualify}</span>
        {raceLeft != null && <span className="stb-pill"><Timer size={13} /> {raceLeft}s</span>}
        <span className="grow" />
        <button type="button" className={'stb-pill btn' + (voice.mic ? ' mic-on' : '')} onClick={() => { unlockAudio(); voice.toggleMic(); }} aria-label="Microfone">{voice.mic ? <Mic size={14} /> : <MicOff size={14} />}</button>
        <button type="button" className="stb-pill btn" onClick={() => setLeave(true)}><LogOut size={14} /></button>
      </div>

      {g.phase === 'intro' && (
        <div className="stb-banner">
          <small>{g.round >= 2 ? 'Fase final' : `Fase ${g.round + 1} de 3`}</small>
          <b>{stage.name}</b>
          <span>{g.round >= 2 ? 'Quem chegar primeiro vence!' : `Os ${g.qualify} primeiros passam de fase`}</span>
          {toStart <= 3.2 && toStart > 0 && <em className="stb-321">{Math.ceil(toStart)}</em>}
        </div>
      )}
      {g.phase === 'race' && toStart > -1 && toStart <= 0 && <div className="stb-go">VAI!</div>}
      {myPlace && g.phase === 'race' && <div className="stb-qual">{g.round >= 2 ? 'Você venceu!' : `Classificado! ${myPlace}º`}</div>}
      {!alive && !over && <div className="stb-spect">Você foi eliminado. Assistindo a partida...</div>}

      {g.phase === 'results' && !over && (
        <div className="stb-results">
          <b>{g.winner ? `${names[g.winner] || ''} venceu!` : 'Resultado da fase'}</b>
          <div className="stb-res-list">
            {g.alive.map((id) => <span key={id} className="ok">{names[id] || 'Jogador'}</span>)}
            {g.eliminated.map((id) => <span key={id} className="out">{names[id] || 'Jogador'}</span>)}
          </div>
          {!g.winner && <small>Próxima fase já vai começar...</small>}
        </div>
      )}

      {alive && g.phase !== 'results' && !over && (
        <div className="stb-controls">
          <Joystick onMove={(x, y) => eng.current?.input.move(x, y)} />
          <div className="stb-btns">
            <button type="button" className="stb-btn dive" onPointerDown={() => eng.current?.input.dive()}>Mergulhar</button>
            <button type="button" className="stb-btn jump" onPointerDown={() => eng.current?.input.jump()}>Pular</button>
          </div>
        </div>
      )}

      {leave && (
        <Modal title="Sair da partida?" onClose={() => setLeave(false)}>
          <p>Se sair agora, você perde esta partida.</p>
          <div className="uno-actions">
            <Button variant="secondary" onClick={() => setLeave(false)}>Continuar</Button>
            <Button variant="danger" onClick={() => net.send({ t: 'leave' })}>Sair</Button>
          </div>
        </Modal>
      )}
      {over && (
        <div className="game-over">
          <div className="game-over-card">
            <Trophy size={40} />
            <h2>{room.result?.winner === me ? 'Você venceu!' : room.result?.winner ? `${room.result.winnerName} venceu!` : 'Partida encerrada'}</h2>
            <p className="small">{room.result?.winner === me ? 'Mais uma vitória no ranking do Stumble DBV.' : 'Na próxima é você!'}</p>
            <Button block onClick={() => net.send({ t: 'again' })}><RefreshCw size={16} /> Jogar de novo</Button>
            <Button block variant="secondary" onClick={() => { net.send({ t: 'leave' }); nav(`${base}/jogos?aba=ranking&jogo=stumble`); }}><Trophy size={16} /> Ver ranking</Button>
            <Button block variant="secondary" onClick={() => net.send({ t: 'leave' })}><ArrowLeft size={16} /> Sair</Button>
          </div>
        </div>
      )}
    </div>
  );
}

