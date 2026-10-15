// Uno DBV: cartas online de 2 a 6 jogadores, com chat de voz.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Ban, Bot, Copy, Timer, Crown, Globe2, Hash, Lock, LogOut, Mic, MicOff, Play, RefreshCw, Repeat2, Trophy,
  UserX, Users, Volume2, VolumeX, Wifi, WifiOff, Zap, Ear, EarOff,
} from 'lucide-react';
import { Avatar, Button, Card, Modal, PageHeader, Section } from '../../ui.jsx';
import { useOnline as useInternet } from '../../offline.js';
import { sfx, unlockAudio } from '../games/audio.js';
import { useOnline } from './net.js';
import { useVoice } from './voice.js';
import './uno.css';

const COLOR_NAME = { r: 'Vermelho', y: 'Amarelo', g: 'Verde', b: 'Azul' };

/** Carta desenhada (cores e símbolos próprios do App do DBV). */
export function UnoCard({ card, back, size = 'md', playable, onClick, style, className = '' }) {
  if (back || !card) {
    return (
      <span className={`uno-card back ${size} ${className}`} style={style}>
        <span className="uno-oval"><b>DBV</b></span>
      </span>
    );
  }
  const color = card.color === 'w' ? (card.chosen || 'w') : card.color;
  const sym = {
    skip: <Ban className="uno-sym-ico" />, reverse: <Repeat2 className="uno-sym-ico" />, draw2: '+2', wild: <WildOval />, wild4: '+4',
  }[card.value] ?? card.value;
  const small = { skip: <Ban size={12} />, reverse: <Repeat2 size={12} />, draw2: '+2', wild: '★', wild4: '+4' }[card.value] ?? card.value;
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag type={onClick ? 'button' : undefined} className={`uno-card c-${color} ${card.color === 'w' ? 'wild' : ''} ${size} ${playable ? 'playable' : ''} ${className}`} onClick={onClick} style={style}>
      <span className="uno-corner tl">{small}</span>
      <span className="uno-oval">{card.value === 'wild4' ? <><WildOval mini /><b className="uno-big">+4</b></> : <b className={'uno-big' + (card.value === '6' || card.value === '9' ? ' ul' : '')}>{sym}</b>}</span>
      <span className="uno-corner br">{small}</span>
    </Tag>
  );
}
const WildOval = ({ mini }) => (
  <span className={'wild-oval' + (mini ? ' mini' : '')}><i className="q r" /><i className="q b" /><i className="q y" /><i className="q g" /></span>
);

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
        <div className="uno-logo"><span>UNO</span><small>DBV</small></div>
        <UnoCard card={{ color: 'w', value: 'wild' }} size="sm" className="tilt-r" />
      </div>
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

export function VoiceBar({ net, voice }) {
  const [open, setOpen] = useState(false);
  const others = net.room.players.filter((p) => p.id !== net.me && !p.bot);
  return (
    <>
      <div className="uno-voice">
        <button type="button" className={'uno-mic' + (voice.mic ? ' on' : '')} onClick={() => { unlockAudio(); voice.toggleMic(); }}>
          {voice.mic ? <Mic size={18} /> : <MicOff size={18} />} {voice.mic ? 'Microfone ligado' : 'Microfone desligado'}
        </button>
        {others.length > 0 && <button type="button" className="uno-voice-more" onClick={() => setOpen(true)}><Volume2 size={18} /></button>}
      </div>
      {voice.micError && <p className="small center uno-err">{voice.micError}</p>}
      {open && (
        <Modal title="Voz" onClose={() => setOpen(false)}>
          <div className="list">
            {others.map((p) => (
              <div key={p.id} className="list-item">
                <Avatar src={p.photo} name={p.name} size={36} />
                <div className="grow"><div className="title">{p.name}</div><div className="sub">{voice.talking.has(p.id) ? 'Microfone ligado' : 'Microfone desligado'}</div></div>
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
      )}
    </>
  );
}

// ───────────── Mesa ─────────────

function Table({ net, voice, base }) {
  const nav = useNavigate();
  const { room, game: g, me } = net;
  const [pick, setPick] = useState(null); // carta coringa esperando a cor
  const [confirmLeave, setConfirmLeave] = useState(false);
  const left = useTimeLeft(g.turnEndsAt);
  const myTurn = g.turn === me;
  const byId = useMemo(() => Object.fromEntries(room.players.map((p) => [p.id, p])), [room.players]);
  // Os outros jogadores na ordem do jogo, começando por quem vem depois de mim.
  const others = useMemo(() => {
    const i = g.order.indexOf(me);
    const rot = i < 0 ? g.order : [...g.order.slice(i + 1), ...g.order.slice(0, i)];
    return rot.filter((id) => id !== me);
  }, [g.order, me]);
  const act = (action) => net.send({ t: 'act', action });

  // Sons dos acontecimentos.
  const prev = useRef({});
  useEffect(() => {
    const p = prev.current;
    if (g.lastPlay && g.lastPlay.at !== p.play) sfx('flip');
    if (g.lastEvent && g.lastEvent.at !== p.event) {
      if (g.lastEvent.type === 'uno') sfx('point');
      else if (g.lastEvent.type === 'caught') sfx('error');
      else if (g.lastEvent.type === 'draw') sfx('pop');
    }
    if (myTurn && p.turn !== g.turn) sfx('tap');
    if (room.status === 'over' && p.status !== 'over') sfx(room.result?.winner === me ? 'win' : 'lose');
    prev.current = { play: g.lastPlay?.at, event: g.lastEvent?.at, turn: g.turn, status: room.status };
  }, [g, myTurn, room.status, room.result, me]);
  useEffect(() => { if (net.error) sfx('error'); }, [net.error]);

  const play = (c) => {
    if (!c.playable) { sfx('error'); return; }
    if (c.color === 'w') { setPick(c); return; }
    act({ type: 'play', card: c.id });
  };
  const myCount = g.hand.length;
  const canUno = (myCount === 2 && myTurn) || (myCount === 1 && g.unoPending === me);
  const catchable = g.unoPending && g.unoPending !== me;
  const hand = g.hand;
  const spread = Math.min(46, Math.max(16, 270 / Math.max(1, hand.length)));
  const over = room.status === 'over';

  return (
    <div className={'uno-table col-' + g.color}>
      <div className="uno-top">
        <button type="button" className="icon-btn" onClick={() => setConfirmLeave(true)} aria-label="Sair"><LogOut size={18} /></button>
        <div className="uno-opps">
          {others.map((id) => {
            const p = byId[id] || { name: '?' };
            const n = g.counts[id];
            return (
              <div key={id} className={'uno-opp' + (g.turn === id ? ' turn' : '') + (p.connected === false ? ' off' : '')}>
                <div className="uno-opp-av">
                  <Avatar src={p.photo} name={p.name} size={40} />
                  {g.turn === id && <TurnRing left={left} />}
                  {voice.talking.has(id) && <span className="uno-opp-mic"><Mic size={11} /></span>}
                </div>
                <b>{p.bot && <Bot size={11} />} {p.name}</b>
                <span className="uno-mini-fan">
                  {Array.from({ length: Math.min(n, 8) }).map((_, k) => <i key={k} style={{ transform: `rotate(${(k - Math.min(n, 8) / 2) * 7}deg)` }} />)}
                </span>
                <small>{n} carta{n === 1 ? '' : 's'}</small>
                {n === 1 && g.unoSaid?.[id] && <span className="uno-badge">UNO!</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="uno-center">
        <div className={'uno-dir' + (g.dir < 0 ? ' ccw' : '')}><Repeat2 size={18} /></div>
        <button type="button" className={'uno-deck' + (myTurn && g.drawn == null ? ' can' : '')} disabled={!myTurn || g.drawn != null} onClick={() => act({ type: 'draw' })} aria-label="Comprar carta">
          <UnoCard back size="lg" className="d3" />
          <UnoCard back size="lg" className="d2" />
          <UnoCard back size="lg" />
          <small>{g.deck}</small>
        </button>
        <div className="uno-pile">
          <UnoCard key={g.top.id + ':' + (g.lastPlay?.at || 0)} card={g.top} size="lg" className="landed" />
          <span className={'uno-color-dot c-' + g.color} title={COLOR_NAME[g.color]} />
        </div>
      </div>

      <div className={'uno-status' + (myTurn ? ' mine' : '')}>
        {over ? 'Fim de jogo' : myTurn ? (g.drawn != null ? 'Jogue a carta comprada ou passe' : 'Sua vez!') : `Vez de ${byId[g.turn]?.name || '...'}`}
        {!over && <span className="uno-timer">{left}s</span>}
      </div>
      {g.log?.length > 0 && <div className="uno-log">{g.log.at(-1)}</div>}

      <div className="uno-buttons">
        {canUno && <button type="button" className="uno-shout" onClick={() => act({ type: 'uno' })}>UNO!</button>}
        {catchable && <button type="button" className="uno-catch" onClick={() => act({ type: 'catch' })}>Pegou {byId[g.unoPending]?.name}! +2</button>}
        {myTurn && g.drawn != null && <Button small variant="secondary" onClick={() => act({ type: 'pass' })}>Passar</Button>}
      </div>

      <div className={'uno-hand' + (myTurn ? ' active' : '')}>
        <div className="uno-hand-inner" style={{ width: `${(hand.length - 1) * spread + 92}px` }}>
          {hand.map((c, i) => (
            <UnoCard
              key={c.id}
              card={c}
              size="lg"
              playable={c.playable}
              onClick={() => play(c)}
              style={{ left: `${i * spread}px`, zIndex: i, '--rot': `${(i - (hand.length - 1) / 2) * Math.min(4, 40 / hand.length)}deg` }}
              className={'in-hand' + (g.drawn === c.id ? ' just-drawn' : '')}
            />
          ))}
        </div>
      </div>

      <VoiceBar net={net} voice={voice} />

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

function TurnRing({ left }) {
  const pct = Math.max(0, Math.min(1, left / 30));
  return (
    <svg className="uno-ring" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="22" pathLength="100" strokeDasharray={`${pct * 100} 100`} />
    </svg>
  );
}
