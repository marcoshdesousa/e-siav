// DesbravaCraft: menu (mundo offline e mundos online), o jogo com controles na tela e o inventário.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Backpack, Copy, Globe2, Hammer, Heart, LogOut, Play, Plus, RefreshCw, Shirt, Users, Utensils, WifiOff } from 'lucide-react';
import { api } from '../../../api.js';
import { Button, Card, Modal, Section } from '../../../ui.jsx';
import { useOnline as useInternet } from '../../../offline.js';
import { sfx, unlockAudio } from '../../games/audio.js';
import { useOnline } from '../net.js';
import { OUTFITS, outfitById } from '../stumble/outfits.js';
import { ITEMS, RECIPES, SMELT, iconOf, itemName } from './blocks.js';
import { BIOME_NAME } from './world.js';
import { createCraft } from './game.js';
import './craft.css';

// ───────────── Mundo offline salvo no celular (IndexedDB) ─────────────
function idb() {
  return new Promise((res, rej) => {
    const r = window.indexedDB.open('dbv-craft', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('save');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function loadOffline() {
  try {
    const db = await idb();
    return await new Promise((res) => { const t = db.transaction('save').objectStore('save').get('offline'); t.onsuccess = () => res(t.result || null); t.onerror = () => res(null); });
  } catch { return null; }
}
async function saveOffline(data) {
  try {
    const db = await idb();
    await new Promise((res) => { const t = db.transaction('save', 'readwrite'); t.objectStore('save').put(data, 'offline'); t.oncomplete = res; t.onerror = res; });
  } catch { /* sem armazenamento */ }
}

const readOutfit = () => { try { return window.localStorage.getItem('dbv-stumble-visual') || 'm01'; } catch { return 'm01'; } };
const swatch = (o) => `linear-gradient(180deg, ${o.hairColor} 0 20%, ${o.skin} 20% 40%, ${o.top} 40% 70%, ${o.bottom} 70%)`;

export default function CraftPage({ base }) {
  const [mode, setMode] = useState(null); // null | { offline: true, save } | { online: code }
  if (mode) return <Game mode={mode} onExit={() => setMode(null)} />;
  return <Menu base={base} onPlay={setMode} />;
}

function Menu({ base, onPlay }) {
  const nav = useNavigate();
  const internet = useInternet();
  const [save, setSave] = useState(undefined);
  const [worlds, setWorlds] = useState(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [outfit, setOutfit] = useState(readOutfit);
  const [pick, setPick] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { loadOffline().then(setSave); }, []);
  useEffect(() => { if (internet) api.get('/craft/mundos').then(setWorlds).catch(() => setWorlds([])); }, [internet]);
  const create = async () => {
    setErr('');
    try { const w = await api.post('/craft/mundos', { name }); onPlay({ online: w.code, outfit }); } catch (e) { setErr(e.message); }
  };
  const newOffline = () => onPlay({ offline: true, save: null, seed: Math.floor(Math.random() * 2 ** 31) });
  return (
    <div className="craft-menu">
      <div className="craft-logo"><span>Desbrava</span><b>Craft</b></div>
      <p className="center small muted">Construa, explore, junte materiais e sobreviva às noites.</p>

      <Section title="Mundo offline (só seu)">
        <Card>
          <p className="small muted">Fica salvo neste celular e funciona sem internet.</p>
          {save === undefined ? <p className="small">Carregando...</p> : save ? (
            <div className="uno-actions">
              <Button onClick={() => { unlockAudio(); onPlay({ offline: true, save, seed: save.seed }); }}><Play size={16} /> Continuar</Button>
              <Button variant="secondary" onClick={() => setConfirmNew(true)}><Plus size={16} /> Novo mundo</Button>
            </div>
          ) : <Button block onClick={() => { unlockAudio(); newOffline(); }}><Plus size={16} /> Criar mundo</Button>}
        </Card>
      </Section>

      <Section title="Mundos online (até 10 amigos)">
        {!internet ? <Card className="small center"><WifiOff size={18} /> Os mundos online precisam de internet.</Card> : (
          <>
            <div className="craft-me">
              <span className="stb-swatch" style={{ background: swatch(outfitById(outfit)) }} />
              <span className="grow small">Visual: <b>{outfitById(outfit).name}</b></span>
              <Button small variant="secondary" onClick={() => setPick(true)}><Shirt size={14} /> Trocar</Button>
            </div>
            {worlds?.length > 0 && (
              <div className="list">
                {worlds.map((w) => (
                  <div key={w.code} className="list-item">
                    <Globe2 size={20} />
                    <div className="grow">
                      <div className="title">{w.name}</div>
                      <div className="sub">Código {w.code} · {w.mine ? 'seu mundo' : `de ${String(w.owner_name || '').split(' ')[0]}`}{w.online ? ` · ${w.online} jogando` : ''}</div>
                    </div>
                    <Button small onClick={() => { unlockAudio(); onPlay({ online: w.code, outfit }); }}>Entrar</Button>
                  </div>
                ))}
              </div>
            )}
            <div className="uno-code-in">
              <input inputMode="numeric" maxLength={4} placeholder="Código" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))} />
              <Button disabled={code.length !== 4} onClick={() => { unlockAudio(); onPlay({ online: code, outfit }); }}>Entrar</Button>
            </div>
            {creating ? (
              <Card>
                <input placeholder="Nome do mundo" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
                {err && <p className="small uno-err">{err}</p>}
                <div className="uno-actions mt">
                  <Button variant="secondary" onClick={() => setCreating(false)}>Cancelar</Button>
                  <Button onClick={create}>Criar</Button>
                </div>
              </Card>
            ) : <Button block variant="secondary" onClick={() => setCreating(true)}><Plus size={16} /> Criar mundo online</Button>}
            <p className="small muted">O mundo online fica salvo no servidor. Passe o código para os amigos: eles entram mesmo quando você não está.</p>
          </>
        )}
      </Section>
      <Button block variant="secondary" onClick={() => nav(`${base}/jogos`)}><ArrowLeft size={16} /> Voltar aos jogos</Button>

      {confirmNew && (
        <Modal title="Criar outro mundo?" onClose={() => setConfirmNew(false)}>
          <p>O mundo offline atual será apagado e um novo será criado.</p>
          <div className="uno-actions">
            <Button variant="secondary" onClick={() => setConfirmNew(false)}>Cancelar</Button>
            <Button variant="danger" onClick={() => { setConfirmNew(false); newOffline(); }}>Criar novo</Button>
          </div>
        </Modal>
      )}
      {pick && (
        <Modal title="Seu visual" onClose={() => setPick(false)}>
          <div className="stb-outfits">
            {OUTFITS.map((o) => (
              <button key={o.id} type="button" className={'stb-outfit' + (o.id === outfit ? ' on' : '')} onClick={() => { setOutfit(o.id); try { window.localStorage.setItem('dbv-stumble-visual', o.id); } catch { /* */ } }}>
                <span className="stb-swatch" style={{ background: swatch(o) }} />
                <small>{o.name}</small>
              </button>
            ))}
          </div>
          <Button block onClick={() => setPick(false)}>Pronto</Button>
        </Modal>
      )}
    </div>
  );
}

// ───────────── Jogo ─────────────

function Joystick({ onMove }) {
  const ref = useRef(null);
  const [k, setK] = useState({ x: 0, y: 0 });
  const id = useRef(null);
  const handle = (e) => {
    const r = ref.current.getBoundingClientRect();
    let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    setK({ x, y });
    onMove(x, y);
  };
  const end = () => { id.current = null; setK({ x: 0, y: 0 }); onMove(0, 0); };
  return (
    <div ref={ref} className="craft-joy" onPointerDown={(e) => { e.stopPropagation(); id.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); handle(e); }} onPointerMove={(e) => id.current === e.pointerId && handle(e)} onPointerUp={end} onPointerCancel={end}>
      <span style={{ transform: `translate(${k.x * 30}px, ${k.y * 30}px)` }} />
    </div>
  );
}

function Slot({ s, sel, onClick, small }) {
  return (
    <button type="button" className={'craft-slot' + (sel ? ' sel' : '') + (small ? ' small' : '')} onClick={onClick}>
      {s && <img src={iconOf(s.id)} alt={itemName(s.id)} draggable={false} />}
      {s && s.n > 1 && <b>{s.n}</b>}
      {s && ITEMS[s.id]?.tool && s.dur != null && <i style={{ width: `${(s.dur / ITEMS[s.id].uses) * 100}%` }} />}
    </button>
  );
}

function Game({ mode, onExit }) {
  const canvasRef = useRef(null);
  const g = useRef(null);
  const net = useOnline(mode.online ? 'craft' : '__none__');
  const [hud, setHud] = useState({ loading: true, inv: [], health: 20, hunger: 20, sel: 0 });
  const [toast, setToast] = useState('');
  const [invOpen, setInvOpen] = useState(null); // null | 'inventario' | 'receitas' | 'fornalha'
  const [world, setWorld] = useState(mode.offline ? { name: 'Mundo offline' } : null);
  const [err, setErr] = useState('');
  const [joinData, setJoinData] = useState(mode.offline ? { seed: mode.seed, save: mode.save } : null);
  const playersRef = useRef(new Map());

  const showToast = (t) => { setToast(t); setTimeout(() => setToast((x) => (x === t ? '' : x)), 2400); };

  // Online: pede para entrar no mundo
  useEffect(() => {
    if (!mode.online || !net.connected) return undefined;
    net.send({ t: 'craft-join', code: mode.online, outfit: mode.outfit });
    const off = net.listen((m) => {
      if (m.t === 'craft-world') {
        setWorld(m.world);
        for (const p of m.players) playersRef.current.set(p.id, p);
        setJoinData({ seed: m.world.seed, save: { changes: m.changes, player: m.player, time: m.world.time } });
      } else if (m.t === 'craft-set') g.current?.applyRemoteBlock(m.x, m.y, m.z, m.b);
      else if (m.t === 'craft-pos') {
        const p = playersRef.current.get(m.id);
        if (p && m.d) g.current?.setRemote(m.id, m.d, p.name, outfitById(p.outfit));
      } else if (m.t === 'craft-joined') { playersRef.current.set(m.player.id, m.player); showToast(`${m.player.name} entrou no mundo`); }
      else if (m.t === 'craft-left') { const p = playersRef.current.get(m.id); playersRef.current.delete(m.id); g.current?.removeRemote(m.id); if (p) showToast(`${p.name} saiu do mundo`); }
      else if (m.t === 'error') setErr(m.msg);
    });
    return off;
  }, [mode.online, net.connected]);

  // Cria o jogo quando o mundo chegou
  useEffect(() => {
    if (!joinData || !canvasRef.current) return undefined;
    const game = createCraft(canvasRef.current, {
      seed: joinData.seed,
      save: joinData.save,
      online: !!mode.online,
      onHud: (h) => setHud((cur) => ({ ...cur, ...h })),
      onUse: (kind) => setInvOpen(kind === 'bancada' ? 'receitas' : 'fornalha'),
      onBlock: (x, y, z, id) => mode.online && net.send({ t: 'craft-set', x, y, z, b: id }),
      onPos: (d) => net.send({ t: 'craft-pos', d }),
      onSave: () => save(game),
      onToast: showToast,
      onSound: (n) => sfx(n),
    });
    g.current = game;
    const vis = () => { if (document.visibilityState === 'hidden') save(game); };
    document.addEventListener('visibilitychange', vis);
    return () => { document.removeEventListener('visibilitychange', vis); save(game); game.dispose(); g.current = null; };
  }, [joinData]);

  const save = (game) => {
    if (!game) return;
    if (mode.offline) saveOffline(game.exportSave());
    else net.send({ t: 'craft-save', state: game.exportPlayer(), time: game.state.time });
  };
  const exit = () => {
    save(g.current);
    if (mode.online) net.send({ t: 'craft-leave' });
    onExit();
  };

  useEffect(() => {
    document.body.classList.add('craft-playing');
    return () => document.body.classList.remove('craft-playing');
  }, []);

  // Teclado e mouse (computador)
  useEffect(() => {
    const keys = new Set();
    const upd = () => {
      const x = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
      const z = (keys.has('s') ? 1 : 0) - (keys.has('w') ? 1 : 0);
      g.current?.input.move(x, z);
    };
    const down = (e) => {
      const k = e.key.toLowerCase();
      if (k === ' ') { g.current?.input.jump(true); e.preventDefault(); }
      else if (k === 'e') setInvOpen((o) => (o ? null : 'inventario'));
      else if (/^[1-9]$/.test(k)) g.current?.input.select(Number(k) - 1);
      else if ('wasd'.includes(k)) { keys.add(k); upd(); }
    };
    const up = (e) => {
      const k = e.key.toLowerCase();
      if (k === ' ') g.current?.input.jump(false);
      keys.delete(k);
      upd();
    };
    const mm = (e) => { if (document.pointerLockElement === canvasRef.current) g.current?.input.look(e.movementX * 0.0025, e.movementY * 0.0025); };
    const wheel = (e) => { if (document.pointerLockElement === canvasRef.current && g.current) g.current.input.select((g.current.state.sel + (e.deltaY > 0 ? 1 : 8)) % 9); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('mousemove', mm);
    window.addEventListener('wheel', wheel);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('mousemove', mm); window.removeEventListener('wheel', wheel); };
  }, []);

  // Toque: arrastar = olhar; toque rápido = colocar/usar/bater; segurar = quebrar
  const touch = useRef(null);
  const onDown = (e) => {
    if (e.pointerType === 'mouse') {
      if (document.pointerLockElement !== canvasRef.current) { canvasRef.current.requestPointerLock?.(); return; }
      if (e.button === 0) g.current?.input.mineStart(null, null);
      if (e.button === 2) g.current?.input.tap(null, null);
      return;
    }
    touch.current = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: Date.now(), moved: false, mining: false };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ponteiro já solto */ }
    const t = touch.current;
    t.timer = setTimeout(() => { if (!t.moved) { t.mining = true; g.current?.input.mineStart(t.lx, t.ly); } }, 260);
  };
  const onMove = (e) => {
    const t = touch.current;
    if (!t || t.id !== e.pointerId) return;
    const dx = e.clientX - t.lx;
    const dy = e.clientY - t.ly;
    t.lx = e.clientX; t.ly = e.clientY;
    if (Math.hypot(e.clientX - t.x, e.clientY - t.y) > 10) t.moved = true;
    if (t.mining) g.current?.input.mineMove(e.clientX, e.clientY);
    else if (t.moved) g.current?.input.look(dx * 0.006, dy * 0.006);
  };
  const onUp = (e) => {
    if (e.pointerType === 'mouse') { g.current?.input.mineEnd(); return; }
    const t = touch.current;
    if (!t || t.id !== e.pointerId) return;
    clearTimeout(t.timer);
    if (t.mining) g.current?.input.mineEnd();
    else if (!t.moved && Date.now() - t.t < 260) g.current?.input.tap(t.x, t.y);
    touch.current = null;
  };

  const sel = hud.inv?.[hud.sel];
  const food = sel && ITEMS[sel.id]?.food;
  if (err) return <div className="craft-menu"><Card className="center"><p>{err}</p><Button onClick={onExit}><ArrowLeft size={16} /> Voltar</Button></Card></div>;
  return (
    <div className="craft-game">
      <canvas ref={canvasRef} className="craft-canvas" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onContextMenu={(e) => e.preventDefault()} />
      {(hud.loading || !joinData) && <div className="craft-loading"><RefreshCw className="spin" size={22} /> {joinData ? 'Gerando o mundo...' : 'Entrando no mundo...'}</div>}
      <div className="craft-cross" />
      <div className="craft-top">
        <button type="button" className="craft-btn" onClick={exit}><LogOut size={16} /></button>
        <span className="craft-info">{world?.name}{world?.code ? ` · ${world.code}` : ''} · {BIOME_NAME[hud.biome] || ''} · {String(hud.clock ?? 12).padStart(2, '0')}h{hud.night ? ' 🌙' : ''}</span>
        {world?.code && <button type="button" className="craft-btn" onClick={() => window.navigator.clipboard?.writeText(world.code).then(() => showToast('Código copiado!')).catch(() => {})}><Copy size={14} /></button>}
        {mode.online && <span className="craft-info"><Users size={13} /> {playersRef.current.size}</span>}
      </div>
      {toast && <div className="craft-toast">{toast}</div>}
      {hud.hurt && <div className="craft-hurt" />}

      <div className="craft-bottom">
        <div className="craft-bars">
          <span className="craft-hearts">{Array.from({ length: 10 }).map((_, i) => <Heart key={i} size={13} className={hud.health >= (i + 1) * 2 ? 'full' : hud.health >= i * 2 + 1 ? 'half' : 'empty'} />)}</span>
          <span className="craft-food">{Array.from({ length: 10 }).map((_, i) => <Utensils key={i} size={12} className={hud.hunger >= (i + 1) * 2 ? 'full' : hud.hunger >= i * 2 + 1 ? 'half' : 'empty'} />)}</span>
        </div>
        <div className="craft-hotbar">
          {Array.from({ length: 9 }).map((_, i) => <Slot key={i} s={hud.inv?.[i]} sel={hud.sel === i} onClick={() => g.current?.input.select(i)} />)}
        </div>
        {sel && <div className="craft-held">{itemName(sel.id)}</div>}
      </div>

      <Joystick onMove={(x, y) => g.current?.input.move(x, y)} />
      <div className="craft-right">
        {food && <button type="button" className="craft-round eat" onClick={() => g.current?.input.eat()}><Utensils size={20} /></button>}
        <button type="button" className="craft-round" onClick={() => setInvOpen('inventario')}><Backpack size={22} /></button>
        <button type="button" className="craft-round jump" onPointerDown={(e) => { e.stopPropagation(); g.current?.input.jump(true); }} onPointerUp={() => g.current?.input.jump(false)} onPointerCancel={() => g.current?.input.jump(false)}>Pular</button>
      </div>

      {invOpen && <Inventory game={g.current} tab={invOpen} setTab={setInvOpen} inv={hud.inv} sel={hud.sel} onClose={() => setInvOpen(null)} toast={showToast} />}
    </div>
  );
}

function Inventory({ game, tab, setTab, inv, sel, onClose, toast }) {
  const [pick, setPick] = useState(null);
  const [, force] = useState(0);
  if (!game) return null;
  const nearTable = game.nearTable();
  const nearFurnace = game.nearFurnace();
  const clickSlot = (i) => {
    if (pick == null) { if (inv[i]) setPick(i); return; }
    game.moveSlot(pick, i);
    setPick(null);
  };
  const have = (ids) => game.inv.count(ids);
  return (
    <div className="craft-inv-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="craft-inv">
        <div className="craft-tabs">
          <button type="button" className={tab === 'inventario' ? 'on' : ''} onClick={() => setTab('inventario')}><Backpack size={14} /> Mochila</button>
          <button type="button" className={tab === 'receitas' ? 'on' : ''} onClick={() => setTab('receitas')}><Hammer size={14} /> Receitas</button>
          <button type="button" className={tab === 'fornalha' ? 'on' : ''} onClick={() => setTab('fornalha')}>🔥 Fornalha</button>
          <button type="button" className="close" onClick={onClose}>✕</button>
        </div>
        {tab === 'inventario' && (
          <>
            <p className="small muted">{pick != null ? `Toque onde colocar: ${itemName(inv[pick].id)}` : 'Toque num item e depois em outro lugar para trocar. A linha de baixo é a barra de itens.'}</p>
            <div className="craft-grid">
              {inv.slice(9).map((s, k) => <Slot key={k + 9} s={s} sel={pick === k + 9} onClick={() => clickSlot(k + 9)} />)}
            </div>
            <div className="craft-grid hot">
              {inv.slice(0, 9).map((s, k) => <Slot key={k} s={s} sel={pick === k || (pick == null && sel === k)} onClick={() => clickSlot(k)} />)}
            </div>
          </>
        )}
        {tab === 'receitas' && (
          <>
            <p className="small muted">{nearTable ? 'Bancada perto: todas as receitas liberadas.' : 'Sem bancada perto: só as receitas pequenas. Faça uma bancada de trabalho!'}</p>
            <div className="craft-recipes">
              {RECIPES.map((r, i) => {
                const ok = (r.grid === 2 || nearTable) && r.need.every(([ids, n]) => have(ids) >= n);
                return (
                  <div key={i} className={'craft-recipe' + (ok ? ' ok' : '')}>
                    <img src={iconOf(r.out[0])} alt="" />
                    <div className="grow">
                      <b>{itemName(r.out[0])}{r.out[1] > 1 ? ` ×${r.out[1]}` : ''}</b>
                      <small>{r.need.map(([ids, n]) => `${n} ${itemName(Array.isArray(ids) ? ids[0] : ids)}${Array.isArray(ids) ? ' (qualquer tronco)' : ''}`).join(' + ')}{r.grid === 3 ? ' · bancada' : ''}</small>
                    </div>
                    <Button small disabled={!ok} onClick={() => { const e = game.craft(r); if (e) toast(e); force((n) => n + 1); }}>Fazer</Button>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {tab === 'fornalha' && (
          <>
            <p className="small muted">{nearFurnace ? `Combustível: carvão, troncos, tábuas ou gravetos. Carga atual: ${Math.floor(game.state.fuel)}` : 'Chegue perto de uma fornalha (feita com 8 pedregulhos na bancada).'}</p>
            <div className="craft-recipes">
              {Object.entries(SMELT).map(([from, to]) => {
                const n = have(Number(from));
                return (
                  <div key={from} className={'craft-recipe' + (n && nearFurnace ? ' ok' : '')}>
                    <img src={iconOf(Number(from))} alt="" />
                    <span>→</span>
                    <img src={iconOf(to)} alt="" />
                    <div className="grow"><b>{itemName(to)}</b><small>{itemName(Number(from))} (você tem {n})</small></div>
                    <Button small disabled={!n || !nearFurnace} onClick={() => { const e = game.smelt(Number(from)); if (e) toast(e); force((k) => k + 1); }}>Assar</Button>
                  </div>
                );
              })}
            </div>
          </>
        )}
        <p className="small muted craft-tip">Dica: segure o dedo num bloco para quebrar; toque rápido para colocar o bloco da mão, abrir a bancada/fornalha ou bater nos bichos.</p>
      </div>
    </div>
  );
}
