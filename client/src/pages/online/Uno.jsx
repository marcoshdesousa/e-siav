// Uno DBV: o UNO online de 2 a 6 jogadores, numa mesa redonda, com chat de voz.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Bot, Copy, Timer, Crown, Globe2, Hash, Lock, LogOut, Mic, MicOff, Play, RefreshCw, Trophy,
  UserX, Users, Volume2, VolumeX, Wifi, WifiOff, Zap, Ear, EarOff, Bell, BellOff,
} from 'lucide-react';
import { Avatar, Button, Card, Modal, PageHeader, Section } from '../../ui.jsx';
import { useOnline as useInternet } from '../../offline.js';
import { isMuted, onMuteChange, setMuted, sfx, unlockAudio } from '../games/audio.js';
import { useOnline } from './net.js';
import { useVoice } from './voice.js';
import './uno.css';

const COLOR_NAME = { r: 'Vermelho', y: 'Amarelo', g: 'Verde', b: 'Azul' };
const VALUE_NAME = { skip: 'Pular', reverse: 'Inverter', draw2: '+2', wild: 'Coringa', wild4: 'Coringa +4' };
const cardLabel = (c) => (c.color === 'w' ? VALUE_NAME[c.value] : `${VALUE_NAME[c.value] || c.value} ${COLOR_NAME[c.color]}`);

// Símbolos desenhados (próprios do App do DBV).
const SkipIco = () => (
  <svg viewBox="0 0 24 24" className="uno-ico" aria-hidden="true"><circle cx="12" cy="12" r="8.2" /><path d="M6.4 17.6 17.6 6.4" /></svg>
);
const ReverseIco = () => (
  <svg viewBox="0 0 24 24" className="uno-ico" aria-hidden="true"><path d="M4 9.5h13M13.5 5.5l4 4-4 4M20 14.5H7M10.5 10.5l-4 4 4 4" /></svg>
);
const WildOval = ({ mini }) => (
  <span className={'wild-oval' + (mini ? ' mini' : '')}><i className="q r" /><i className="q b" /><i className="q y" /><i className="q g" /></span>
);

/** Carta desenhada: cores do UNO, oval branco, número grande e os cantinhos. O verso tem "UNO DBV". */
export function UnoCard({ card, back, size = 'md', playable, onClick, style, className = '', btnRef, label }) {
  if (back || !card) {
    return (
      <span className={`uno-card back ${size} ${className}`} style={style} aria-hidden="true">
        <span className="uno-oval back-oval">
          <b className="back-uno">UNO</b>
          <small className="back-dbv">DBV</small>
        </span>
        {size !== 'xs' && <img className="back-logo" src="/marca/logo.svg" alt="" />}
      </span>
    );
  }
  const color = card.color === 'w' ? (card.chosen || 'w') : card.color;
  const big = {
    skip: <SkipIco />, reverse: <ReverseIco />, draw2: '+2',
  }[card.value] ?? card.value;
  const small = { skip: <SkipIco />, reverse: <ReverseIco />, draw2: '+2', wild: <WildOval mini />, wild4: '+4' }[card.value] ?? card.value;
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      type={onClick ? 'button' : undefined} ref={btnRef} onClick={onClick} style={style}
      aria-label={onClick ? (label || cardLabel(card)) + (playable ? ' (pode jogar)' : '') : undefined}
      className={`uno-card c-${color} ${card.color === 'w' ? 'wild' : ''} ${size} ${playable ? 'playable' : ''} ${className}`}
    >
      <span className="uno-corner tl">{small}</span>
      <span className="uno-oval">
        {card.value === 'wild' ? <WildOval /> : card.value === 'wild4' ? <><WildOval /><b className="uno-big plus4">+4</b></> : <b className={'uno-big' + (card.value === '6' || card.value === '9' ? ' ul' : '') + (card.value === 'draw2' ? ' plus' : '')}>{big}</b>}
      </span>
      <span className="uno-corner br">{small}</span>
    </Tag>
  );
}

function useTimeLeft(endsAt) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  return Math.max(0, Math.ceil(((endsAt || 0) - now) / 1000));
}

export default function UnoPage({ base }) {
  const net = useOnline('uno');
  const internet = useInternet();
  const { room, game } = net;
  const humanPlayers = useMemo(() => room?.players.filter((p) => !p.bot), [room?.players]);
  const voice = useVoice({ me: net.me, players: humanPlayers, send: net.send, listen: net.listen });
  const playing = room && room.status !== 'waiting';
  useEffect(() => {
    document.body.classList.toggle('online-playing', !!room);
    return () => document.body.classList.remove('online-playing');
  }, [room]);
  if (!internet) return <><PageHeader title="Uno DBV" /><Card className="center"><WifiOff size={30} /><p>O Uno DBV precisa de internet.</p></Card></>;
  return (
    <div className="uno-page">
      <div className="uno-rotate" role="alert">
        <div className="uno-rotate-phone" aria-hidden="true"><i /></div>
        <p>Vire o celular de pé para jogar o <span>Uno DBV</span></p>
      </div>
      {!net.connected && <div className="uno-conn"><RefreshCw size={14} className="spin" /> Conectando...</div>}
      {!room && <Lobby net={net} base={base} />}
      {room && !playing && <WaitingRoom net={net} voice={voice} />}
      {room && playing && game && <Table net={net} voice={voice} base={base} />}
    </div>
  );
}

// ───────────── Saguão ─────────────

function Lobby({ net, base }) {
  const nav = useNavigate();
  const [size, setSize] = useState(4);
  const [pub, setPub] = useState(true);
  const [code, setCode] = useState('');
  const lobby = net.lobby;
  const go = (m) => { unlockAudio(); sfx('tap'); net.send(m); };
  return (
    <>
      <div className="uno-hero">
        <UnoCard card={{ color: 'r', value: 'draw2' }} size="sm" className="tilt-l" />
        <div className="uno-logo-wrap">
          <div className="uno-logo" role="img" aria-label="Uno DBV"><img src="/marca/logo.svg" alt="" /><span>UNO</span><small>DBV</small></div>
          <p className="uno-logo-sub" aria-hidden="true"><i /> Desbravadores <i /></p>
        </div>
        <UnoCard card={{ color: 'w', value: 'wild' }} size="sm" className="tilt-r" />
      </div>
      <p className="center small muted">O UNO de verdade, com todas as 108 cartas, numa mesa com até 6 desbravadores.</p>
      <p className="center small muted"><Wifi size={13} /> {lobby?.online ?? '…'} jogando agora</p>
      {net.kicked && <Card className="small center">O dono da sala tirou você da sala.</Card>}
      {net.error && <Card className="small center uno-err">{net.error.msg}</Card>}

      <Section title="Partida rápida">
        <div className="uno-quick">
          <button type="button" className="uno-big-btn" onClick={() => go({ t: 'quick', game: 'uno', size: 2 })}><Zap size={22} /><b>2 jogadores</b><small>Começa quando achar 1 pessoa</small></button>
          <button type="button" className="uno-big-btn alt" onClick={() => go({ t: 'quick', game: 'uno', size: 4 })}><Users size={22} /><b>4 jogadores</b><small>Começa quando a sala encher</small></button>
        </div>
      </Section>

      <Section title="Criar sala">
        <Card>
          <div className="uno-row"><span>Jogadores</span>
            <div className="seg">{[2, 4, 6].map((n) => <button key={n} type="button" className={size === n ? 'active' : ''} onClick={() => setSize(n)}>{n}</button>)}</div>
          </div>
          <div className="uno-row"><span>Sala</span>
            <div className="seg">
              <button type="button" className={pub ? 'active' : ''} onClick={() => setPub(true)}><Globe2 size={13} /> Pública</button>
              <button type="button" className={!pub ? 'active' : ''} onClick={() => setPub(false)}><Lock size={13} /> Privada</button>
            </div>
          </div>
          <p className="small muted">{pub ? 'Aparece na lista para todos entrarem.' : 'Só entra quem tiver o código.'} Você escolhe quando começar.</p>
          <Button block onClick={() => go({ t: 'create', game: 'uno', size, public: pub })}>Criar sala</Button>
        </Card>
      </Section>

      <Section title="Entrar com código">
        <div className="uno-code-in">
          <input inputMode="numeric" maxLength={4} placeholder="0000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))} />
          <Button disabled={code.length !== 4} onClick={() => go({ t: 'join', code })}>Entrar</Button>
        </div>
      </Section>

      <Section title="Salas públicas">
        {!lobby?.rooms?.length ? <p className="small muted center">Nenhuma sala pública esperando agora. Crie uma!</p> : (
          <div className="list">
            {lobby.rooms.map((r) => (
              <div key={r.code} className="list-item">
                <Hash size={18} />
                <div className="grow"><div className="title">Sala de {r.owner}</div><div className="sub">{r.count}/{r.size} jogadores · código {r.code}</div></div>
                <Button small onClick={() => go({ t: 'join', code: r.code })}>Entrar</Button>
              </div>
            ))}
          </div>
        )}
      </Section>
      <Button block variant="secondary" onClick={() => nav(`${base}/jogos`)}><ArrowLeft size={16} /> Voltar aos jogos</Button>
    </>
  );
}

// ───────────── Sala de espera ─────────────

/** Segundos que faltam (relógio do servidor). */
export function useCountdown(room) {
  const off = useRef(0);
  const seen = useRef(null);
  if (room?.now && seen.current !== room.now) { seen.current = room.now; off.current = room.now - Date.now(); }
  const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force((n) => n + 1), 500); return () => clearInterval(t); }, []);
  return room?.startAt ? Math.max(0, Math.ceil((room.startAt - (Date.now() + off.current)) / 1000)) : null;
}

export const BotTag = () => <span className="bot-tag"><Bot size={11} /> robô</span>;

function WaitingRoom({ net, voice }) {
  const { room, me } = net;
  const owner = room.owner === me;
  const left = useCountdown(room);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await window.navigator.clipboard.writeText(room.code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* sem área de transferência */ }
  };
  return (
    <>
      <div className="uno-waiting-head">
        <b>{room.quick ? 'Partida rápida' : room.public ? 'Sala pública' : 'Sala privada'}</b>
        {!room.quick && (
          <button type="button" className="uno-code" onClick={copy}>
            <small>Código da sala</small><span>{room.code}</span><small><Copy size={12} /> {copied ? 'Copiado!' : 'Toque para copiar'}</small>
          </button>
        )}
        {room.quick && left != null && <div className="stb-countdown"><Timer size={18} /> Começa em {left}s</div>}
        <p className="small muted">{room.quick ? 'Procurando jogadores. Se faltar gente, robôs completam a mesa (e saem quando alguém entra).' : `${room.players.length}/${room.size} jogadores. ${owner ? 'Você começa quando quiser: as vagas vazias viram robôs.' : 'O dono da sala vai começar.'}`}</p>
      </div>
      {room.quick && <div className="uno-searching"><span /><span /><span /></div>}
      <div className="list">
        {room.players.map((p) => (
          <div key={p.id} className="list-item">
            <Avatar src={p.photo} name={p.name} size={40} />
            <div className="grow">
              <div className="title">{p.name} {p.id === me && <span className="muted small">(você)</span>} {p.bot && <BotTag />}</div>
              <div className="sub">{room.owner === p.id && !room.quick ? <><Crown size={12} /> Dono da sala</> : p.bot ? 'Jogador automático' : p.connected ? 'Pronto' : 'Reconectando...'}</div>
            </div>
            {voice.talking.has(p.id) && <Mic size={16} className="uno-mic-on" />}
            {owner && p.id !== me && <Button small variant="secondary" onClick={() => net.send({ t: 'kick', member: p.id })}><UserX size={14} /> Tirar</Button>}
          </div>
        ))}
      </div>
      <VoiceBar net={net} voice={voice} />
      <div className="uno-actions">
        <Button variant="secondary" onClick={() => net.send({ t: 'leave' })}><LogOut size={16} /> Sair</Button>
        {owner && !room.quick && <Button onClick={() => { unlockAudio(); net.send({ t: 'start' }); }}><Play size={16} /> Começar</Button>}
      </div>
      {net.error && <p className="small center uno-err">{net.error.msg}</p>}
    </>
  );
}

// ───────────── Voz ─────────────

export function VoiceBar({ net, voice, compact }) {
  const [open, setOpen] = useState(false);
  const others = net.room.players.filter((p) => p.id !== net.me && !p.bot);
  const modal = open && <VoiceModal others={others} voice={voice} onClose={() => setOpen(false)} />;
  if (compact) {
    // Versão da mesa: só os botões redondos (microfone e quem eu ouço).
    return (
      <>
        <button type="button" className={'uno-round-btn mic' + (voice.mic ? ' on' : '') + (voice.speaking?.has(net.me) ? ' talking' : '')} onClick={() => { unlockAudio(); voice.toggleMic(); }} aria-label={voice.mic ? 'Desligar microfone' : 'Ligar microfone'} aria-pressed={voice.mic}>
          {voice.mic ? <Mic size={17} /> : <MicOff size={17} />}
        </button>
        {others.length > 0 && <button type="button" className="uno-round-btn" onClick={() => setOpen(true)} aria-label="Voz dos jogadores"><Volume2 size={17} /></button>}
        {voice.micError && <p className="uno-mic-err" role="alert">{voice.micError}</p>}
        {modal}
      </>
    );
  }
  return (
    <>
      <div className="uno-voice">
        <button type="button" className={'uno-mic' + (voice.mic ? ' on' : '')} onClick={() => { unlockAudio(); voice.toggleMic(); }}>
          {voice.mic ? <Mic size={18} /> : <MicOff size={18} />} {voice.mic ? 'Microfone ligado' : 'Microfone desligado'}
        </button>
        {others.length > 0 && <button type="button" className="uno-voice-more" onClick={() => setOpen(true)}><Volume2 size={18} /></button>}
      </div>
      {voice.micError && <p className="small center uno-err">{voice.micError}</p>}
      {modal}
    </>
  );
}

function VoiceModal({ others, voice, onClose }) {
  return (
        <Modal title="Voz" onClose={onClose}>
          <div className="list">
            {others.map((p) => (
              <div key={p.id} className="list-item">
                <Avatar src={p.photo} name={p.name} size={36} />
                <div className="grow"><div className="title">{p.name}</div><div className="sub">{voice.speaking?.has(p.id) ? 'Falando agora' : voice.talking.has(p.id) ? 'Microfone ligado' : 'Microfone desligado'}</div></div>
                <button type="button" className={'icon-btn' + (voice.mutedPeers.has(p.id) ? ' danger' : '')} title={voice.mutedPeers.has(p.id) ? 'Voltar a ouvir' : 'Silenciar (não ouvir)'} onClick={() => voice.toggleMute(p.id)}>
                  {voice.mutedPeers.has(p.id) ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <button type="button" className={'icon-btn' + (voice.blocked.has(p.id) ? ' danger' : '')} title={voice.blocked.has(p.id) ? 'Deixar ouvir você' : 'Não deixar ouvir você'} onClick={() => voice.toggleBlock(p.id)}>
                  {voice.blocked.has(p.id) ? <EarOff size={18} /> : <Ear size={18} />}
                </button>
              </div>
            ))}
          </div>
          <p className="small muted"><Volume2 size={12} /> silencia o jogador para você. <Ear size={12} /> faz ele não ouvir você.</p>
        </Modal>
  );
}

// ───────────── Mesa ─────────────

/** Lugar na mesa: eu embaixo e os outros em volta, no sentido horário (o sentido normal do jogo). */
function seatAt(k, n) {
  const deg = 90 + (k * 360) / n;
  const a = (deg * Math.PI) / 180;
  return { deg, cos: Math.cos(a), sin: Math.sin(a) };
}
const COLOR_ORDER = { r: 0, y: 1, g: 2, b: 3, w: 4 };
const VALUE_ORDER = (v) => (/^\d$/.test(v) ? Number(v) : { skip: 10, reverse: 11, draw2: 12, wild: 13, wild4: 14 }[v]);
const sortHand = (h) => [...h].sort((a, b) => COLOR_ORDER[a.color] - COLOR_ORDER[b.color] || VALUE_ORDER(a.value) - VALUE_ORDER(b.value));

function useMuted() {
  const [m, setM] = useState(isMuted());
  useEffect(() => onMuteChange(setM), []);
  return m;
}

function Table({ net, voice, base }) {
  const nav = useNavigate();
  const { room, game: g, me } = net;
  const [pick, setPick] = useState(null); // carta coringa esperando a cor
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [flights, setFlights] = useState([]); // cartas voando pela mesa
  const [hideTop, setHideTop] = useState(null); // carta de cima escondida enquanto voa até a mesa
  const [banner, setBanner] = useState(null); // aviso grande no meio (PULOU!, +2, UNO!)
  const [handW, setHandW] = useState(360);
  const muted = useMuted();
  const left = useTimeLeft(g.turnEndsAt);
  const myTurn = g.turn === me;
  const over = room.status === 'over';
  const n = g.order.length;
  const byId = useMemo(() => Object.fromEntries(room.players.map((p) => [p.id, p])), [room.players]);
  const myIdx = Math.max(0, g.order.indexOf(me));
  const nameOf = useCallback((id) => (id === me ? 'Você' : byId[id]?.name || 'Jogador'), [byId, me]);
  const act = (action) => net.send({ t: 'act', action });

  // Peças da mesa (para as cartas saberem de onde saem e para onde vão).
  const wrapRef = useRef(null);
  const pileRef = useRef(null);
  const deckRef = useRef(null);
  const handRef = useRef(null);
  const seatRefs = useRef(new Map());
  const cardRefs = useRef(new Map());
  const clicked = useRef(null); // { id, x, y } da carta que eu toquei por último

  useLayoutEffect(() => {
    const el = handRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setHandW(el.clientWidth));
    ro.observe(el);
    setHandW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Sons e animações de cada acontecimento novo da partida.
  const seenSeq = useRef(null);
  useEffect(() => {
    if (seenSeq.current == null) { seenSeq.current = g.seq; return; }
    const fresh = (g.events || []).filter((e) => e.seq > seenSeq.current);
    seenSeq.current = g.seq;
    if (!fresh.length) return;
    const wrap = wrapRef.current?.getBoundingClientRect();
    const center = (el) => {
      const r = el?.getBoundingClientRect();
      return r && wrap ? { x: r.left + r.width / 2 - wrap.left, y: r.top + r.height / 2 - wrap.top } : null;
    };
    const pile = center(pileRef.current);
    const deck = center(deckRef.current);
    const fly = (from, to, extra) => {
      if (!from || !to) return;
      const key = Math.random().toString(36).slice(2);
      setFlights((f) => [...f.slice(-10), { key, x: from.x, y: from.y, dx: to.x - from.x, dy: to.y - from.y, ...extra }]);
      setTimeout(() => setFlights((f) => f.filter((x) => x.key !== key)), 700 + (extra.delay || 0));
    };
    const show = (text, cls) => { const key = Date.now() + Math.random(); setBanner({ text, cls, key }); setTimeout(() => setBanner((b) => (b?.key === key ? null : b)), 1300); };
    let delay = 0;
    for (const e of fresh) {
      if (e.type === 'play') {
        sfx('unoPlay');
        const from = e.who === me && clicked.current?.id === e.card.id ? clicked.current : center(seatRefs.current.get(e.who));
        if (from) {
          setHideTop(e.card.id);
          setTimeout(() => setHideTop((h) => (h === e.card.id ? null : h)), 420);
          fly(from, pile, { card: e.card, rot: ((e.card.id * 37) % 30) - 15 });
        }
        if (e.card.value === 'wild') show(COLOR_NAME[e.card.chosen], 'c-' + e.card.chosen);
      } else if (e.type === 'draw') {
        sfx(e.penalty ? 'unoPlus' : 'unoDraw');
        if (e.penalty) show(`+${e.n} para ${nameOf(e.who)}`, 'plus');
        const to = e.who === me ? center(handRef.current) : center(seatRefs.current.get(e.who));
        for (let k = 0; k < Math.min(e.n, 4); k++) fly(deck, to, { back: true, delay: delay + k * 110 });
        delay += 120;
      } else if (e.type === 'caught') {
        sfx('unoCaught');
        show(`${nameOf(e.who)} foi pego! +${e.n}`, 'plus');
        const to = e.who === me ? center(handRef.current) : center(seatRefs.current.get(e.who));
        for (let k = 0; k < e.n; k++) fly(deck, to, { back: true, delay: k * 110 });
      } else if (e.type === 'uno') { sfx('unoCall'); show('UNO!', 'uno'); }
      else if (e.type === 'skip') { setTimeout(() => sfx('unoSkip'), 120); show(`${nameOf(e.who)} pulou a vez`, 'skip'); }
      else if (e.type === 'reverse') { setTimeout(() => sfx('unoReverse'), 120); show(n === 2 ? 'Inverteu = pulou!' : 'Inverteu o sentido!', 'rev'); }
      else if (e.type === 'shuffle') { sfx('unoShuffle'); show('Embaralhando a mesa', 'shuffle'); }
    }
  }, [g.seq, g.events, me, n, nameOf]);

  // A minha vez começou; fim de jogo.
  const prev = useRef({ turn: g.turn, status: room.status });
  useEffect(() => {
    const p = prev.current;
    if (myTurn && p.turn !== g.turn && !over) setTimeout(() => sfx('unoTurn'), 250);
    if (over && p.status !== 'over') setTimeout(() => sfx(room.result?.winner === me ? 'win' : 'lose'), 300);
    prev.current = { turn: g.turn, status: room.status };
  }, [g.turn, myTurn, over, room.status, room.result, me]);
  useEffect(() => { if (net.error) sfx('error'); }, [net.error]);

  const hand = useMemo(() => sortHand(g.hand), [g.hand]);
  const play = (c) => {
    unlockAudio();
    if (!c.playable) { sfx('error'); return; }
    const el = cardRefs.current.get(c.id);
    const wrap = wrapRef.current?.getBoundingClientRect();
    if (el && wrap) { const r = el.getBoundingClientRect(); clicked.current = { id: c.id, x: r.left + r.width / 2 - wrap.left, y: r.top + r.height / 2 - wrap.top }; }
    if (c.color === 'w') { setPick(c); return; }
    act({ type: 'play', card: c.id });
  };
  const myCount = g.hand.length;
  const canUno = !over && ((myCount === 2 && myTurn && !g.unoSaid?.[me]) || (myCount === 1 && g.unoPending === me));
  const catchable = !over && g.unoPending != null && g.unoPending !== me && g.order.includes(g.unoPending);

  // Leque da minha mão: as cartas se apertam para caber na largura da tela.
  // Com muitas cartas a mão vira duas fileiras (a de trás aparece pela metade).
  const cardW = handW < 360 ? 62 : 70;
  const rows = hand.length > 14 ? 2 : 1;
  const perRow = Math.ceil(hand.length / rows);
  const rowGap = Math.round(cardW * 0.62);
  const tilt = Math.min(3.5, 28 / Math.max(1, perRow));
  // Sobra um respiro dos lados porque as cartas das pontas ficam inclinadas.
  const spread = perRow > 1 ? Math.max(18, Math.min(cardW * 0.72, (handW - cardW - 56) / (perRow - 1))) : 0;
  const fanW = (perRow - 1) * spread + cardW;

  const pileUnder = (g.pile || []).slice(-2);
  const colorName = COLOR_NAME[g.color];

  return (
    <div className={'uno-table cur-' + g.color + (myTurn ? ' my-turn' : '')}>
      <div className="uno-bar">
        <button type="button" className="uno-round-btn" onClick={() => setConfirmLeave(true)} aria-label="Sair da partida"><LogOut size={17} /></button>
        <div className="uno-bar-title"><span>UNO</span><small>DBV</small></div>
        <span className="uno-deck-count" title="Cartas no monte">{g.deck} no monte</span>
        <button type="button" className="uno-round-btn" onClick={() => { unlockAudio(); setMuted(!muted); }} aria-label={muted ? 'Ligar sons' : 'Desligar sons'}>
          {muted ? <BellOff size={17} /> : <Bell size={17} />}
        </button>
        <VoiceBar net={net} voice={voice} compact />
      </div>

      <div className="uno-room" ref={wrapRef}>
        <div className="uno-felt">
          <img className="uno-felt-logo" src="/marca/logo.svg" alt="" aria-hidden="true" />
          <FeltRing />
          <div className={'uno-dir' + (g.dir < 0 ? ' ccw' : '')} aria-label={g.dir < 0 ? 'Sentido anti-horário' : 'Sentido horário'} role="img">
            <svg viewBox="0 0 200 200" className="uno-dir-svg" aria-hidden="true">
              <ellipse cx="100" cy="100" rx="92" ry="92" />
              {[0, 120, 240].map((r) => <path key={r} d="M114 4 l-14 -8 v16 z" transform={`rotate(${r} 100 100)`} />)}
            </svg>
          </div>
          <div className="uno-center">
            <button type="button" ref={deckRef} className={'uno-deck' + (myTurn && g.drawn == null && !over ? ' can' : '')} disabled={!myTurn || g.drawn != null || over} onClick={() => { unlockAudio(); act({ type: 'draw' }); }} aria-label={`Comprar carta (${g.deck} no monte)`}>
              <UnoCard back size="md" className="d3" />
              <UnoCard back size="md" className="d2" />
              <UnoCard back size="md" />
              {myTurn && g.drawn == null && !over && <span className="uno-deck-tip">Comprar</span>}
            </button>
            <div className="uno-pile" ref={pileRef} aria-label={`Mesa: ${cardLabel(g.top)}. Cor da vez: ${colorName}`} role="img">
              {pileUnder.map((c, i) => <UnoCard key={c.id} card={c} size="md" className="under" style={{ '--r': `${((c.id * 37) % 30) - 15}deg`, zIndex: i }} />)}
              <UnoCard key={g.top.id} card={g.top} size="md" className={'top' + (hideTop === g.top.id ? ' hidden' : '')} style={{ '--r': `${((g.top.id * 37) % 30) - 15}deg` }} />
            </div>
          </div>
          <div className={'uno-cur c-' + g.color}><i />{colorName}</div>
        </div>

        {g.order.map((id, idx) => {
          const k = (idx - myIdx + n) % n;
          const s = seatAt(k, n);
          const p = byId[id] || { name: '?' };
          const count = g.counts[id] ?? 0;
          const mine = id === me;
          const turn = g.turn === id && !over;
          const pos = { left: `${50 + 41 * s.cos}%`, top: `${50 + 44 * s.sin}%` };
          return (
            <div key={id}>
              <div
                ref={(el) => { if (el) seatRefs.current.set(id, el); else seatRefs.current.delete(id); }}
                className={'uno-seat' + (turn ? ' turn' : '') + (mine ? ' me' : '') + (p.connected === false ? ' off' : '') + (voice.speaking?.has(id) ? ' speaking' : '')}
                style={pos}
                aria-label={`${mine ? 'Você' : p.name}: ${count} carta${count === 1 ? '' : 's'}${turn ? ', é a vez' : ''}`}
              >
                <span className="uno-chair" style={{ transform: `translate(-50%, -50%) rotate(${s.deg - 90}deg)` }} />
                <span className="uno-seat-av">
                  <Avatar src={p.photo} name={p.name} size={mine ? 40 : 44} />
                  {turn && <TurnRing left={left} />}
                  {p.bot && <span className="uno-seat-bot" title="Robô"><Bot size={10} /></span>}
                  {voice.talking.has(id) && <span className="uno-seat-mic"><Mic size={10} /></span>}
                </span>
                <b className="uno-seat-name">{mine ? 'Você' : p.name}</b>
                {count === 1 && g.unoSaid?.[id] && <span className="uno-badge">UNO!</span>}
                {g.unoPending === id && !mine && <span className="uno-badge warn">!</span>}
              </div>
              {!mine && <BackFan count={count} seat={s} />}
            </div>
          );
        })}

        {flights.map((f) => (
          <UnoCard
            key={f.key} card={f.card} back={f.back} size={f.back ? 'sm' : 'md'} className="uno-fly"
            style={{ left: f.x, top: f.y, '--dx': `${f.dx}px`, '--dy': `${f.dy}px`, '--r': `${f.rot || 0}deg`, animationDelay: `${f.delay || 0}ms` }}
          />
        ))}
        {banner && <div key={banner.key} className={'uno-banner ' + banner.cls} role="status">{banner.text}</div>}
      </div>

      <div className={'uno-status' + (myTurn && !over ? ' mine' : '')} aria-live="polite">
        <span>{over ? 'Fim de jogo' : myTurn ? (g.drawn != null ? 'Jogue a comprada ou passe' : 'Sua vez!') : `Vez de ${byId[g.turn]?.name || '...'}`}</span>
        {!over && <span className="uno-timer"><Timer size={12} /> {left}s</span>}
      </div>
      <div className="uno-log">{g.log?.at(-1) || ' '}</div>

      <div className="uno-buttons">
        {canUno && <button type="button" className="uno-shout" onClick={() => { unlockAudio(); act({ type: 'uno' }); }}>UNO!</button>}
        {catchable && <button type="button" className="uno-catch" onClick={() => act({ type: 'catch' })}>Pegar {byId[g.unoPending]?.name}! +2</button>}
        {myTurn && g.drawn != null && !over && <button type="button" className="uno-pass" onClick={() => act({ type: 'pass' })}>Passar a vez</button>}
      </div>

      <div className={'uno-hand' + (myTurn && !over ? ' active' : '')} ref={handRef}>
        <div className="uno-hand-inner" style={{ width: `${fanW}px`, '--cw': `${cardW}px`, '--rows-extra': `${(rows - 1) * rowGap}px` }}>
          {hand.map((c, i) => {
            const row = Math.floor(i / perRow);
            const j = i - row * perRow;
            const inRow = row === rows - 1 ? hand.length - row * perRow : perRow;
            const d = j - (inRow - 1) / 2;
            return (
              <UnoCard
                key={c.id}
                card={c}
                size="hand"
                playable={c.playable}
                onClick={() => play(c)}
                btnRef={(el) => { if (el) cardRefs.current.set(c.id, el); else cardRefs.current.delete(c.id); }}
                style={{ left: `${(fanW - ((inRow - 1) * spread + cardW)) / 2 + j * spread}px`, top: `${row * rowGap}px`, zIndex: i, '--rot': `${d * tilt}deg`, '--lift': `${Math.min(16, d * d * tilt * 0.35)}px` }}
                className={'in-hand' + (g.drawn === c.id ? ' just-drawn' : '')}
              />
            );
          })}
        </div>
      </div>

      {pick && (
        <Modal title="Escolha a cor" onClose={() => setPick(null)}>
          <div className="uno-pick">
            {['r', 'y', 'g', 'b'].map((c) => (
              <button key={c} type="button" className={'uno-pick-c c-' + c} onClick={() => { act({ type: 'play', card: pick.id, color: c }); setPick(null); }}>{COLOR_NAME[c]}</button>
            ))}
          </div>
        </Modal>
      )}
      {confirmLeave && (
        <Modal title="Sair da partida?" onClose={() => setConfirmLeave(false)}>
          <p>Se sair agora, as suas cartas voltam para o monte e a partida continua sem você.</p>
          <div className="uno-actions">
            <Button variant="secondary" onClick={() => setConfirmLeave(false)}>Continuar jogando</Button>
            <Button variant="danger" onClick={() => { net.send({ t: 'leave' }); setConfirmLeave(false); }}>Sair</Button>
          </div>
        </Modal>
      )}
      {over && (
        <div className="game-over uno-over">
          <div className="game-over-card">
            <Trophy size={40} />
            <h2>{room.result?.winner === me ? 'Você venceu!' : room.result?.winner ? `${room.result.winnerName} venceu!` : 'Partida encerrada'}</h2>
            <p className="small">{room.result?.winner === me ? 'Mais uma vitória no ranking do Uno DBV.' : room.result?.winner ? 'Na próxima é você!' : 'Os outros jogadores saíram.'}</p>
            <Button block onClick={() => net.send({ t: 'again' })}><RefreshCw size={16} /> Jogar de novo</Button>
            <Button block variant="secondary" onClick={() => { net.send({ t: 'leave' }); nav(`${base}/jogos?aba=ranking&jogo=uno`); }}><Trophy size={16} /> Ver ranking</Button>
            <Button block variant="secondary" onClick={() => net.send({ t: 'leave' })}><ArrowLeft size={16} /> Sair da sala</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Leque de cartas viradas na frente de um adversário: exatamente quantas ele tem na mão. */
function BackFan({ count, seat }) {
  const shown = count;
  const step = shown <= 7 ? 8 : shown <= 12 ? 5.5 : Math.max(2, 64 / shown);
  const w = Math.max(0, shown - 1) * step + 20;
  const mid = (shown - 1) / 2;
  const tilt = shown > 12 ? 1.2 : 4;
  const pos = { left: `${50 + 41 * 0.68 * seat.cos}%`, top: `${50 + 44 * 0.62 * seat.sin}%`, transform: `translate(-50%, -50%) rotate(${seat.deg + 90}deg)` };
  return (
    <div className="uno-fan" style={pos} aria-hidden="true">
      <div className="uno-fan-inner" style={{ width: `${w}px` }}>
        {Array.from({ length: shown }).map((_, k) => (
          <UnoCard key={k} back size="xs" style={{ left: `${k * step}px`, transform: `rotate(${(k - mid) * tilt}deg)` }} />
        ))}
      </div>
      <span className="uno-fan-n" style={{ transform: `rotate(${-(seat.deg + 90)}deg)` }}>{count}</span>
    </div>
  );
}

function TurnRing({ left }) {
  const pct = Math.max(0, Math.min(1, left / 30));
  return (
    <svg className="uno-ring" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="22" pathLength="100" strokeDasharray={`${pct * 100} 100`} />
    </svg>
  );
}

// Letreiro gravado na borda de madeira da mesa (acompanha o tamanho da oval).
const RING_TEXT = '★ DESBRAVADORES ★ UNO DBV ★ DESBRAVADORES ★';
function FeltRing() {
  const ref = useRef(null);
  const [box, setBox] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current?.parentElement;
    if (!el) return undefined;
    const upd = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    upd();
    return () => ro.disconnect();
  }, []);
  const pad = 8; // meio da borda de madeira, fora do feltro
  const W = (box?.w || 0) + pad * 2 + 4, H = (box?.h || 0) + pad * 2 + 4;
  const rx = (box?.w || 0) / 2 + pad, ry = (box?.h || 0) / 2 + pad;
  const cx = W / 2, cy = H / 2;
  const per = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
  return (
    <svg ref={ref} className="uno-felt-ring" width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ left: -pad - 2, top: -pad - 2 }} aria-hidden="true">
      {box && box.w > 0 && (
        <>
          {/* Duas metades (em cima e embaixo), as duas lidas da esquerda para a direita */}
          <path id="uno-ring-top" d={`M${cx - rx},${cy} A${rx},${ry} 0 0,1 ${cx + rx},${cy}`} fill="none" />
          <path id="uno-ring-bot" d={`M${cx - rx},${cy} A${rx},${ry} 0 0,0 ${cx + rx},${cy}`} fill="none" />
          <text><textPath href="#uno-ring-top" startOffset="3%" textLength={per / 2 * 0.94} lengthAdjust="spacing">{RING_TEXT}</textPath></text>
          <text><textPath href="#uno-ring-bot" startOffset="3%" textLength={per / 2 * 0.94} lengthAdjust="spacing">{RING_TEXT}</textPath></text>
        </>
      )}
    </svg>
  );
}
