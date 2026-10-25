// Meu Bichinho (aba em Jogos), no estilo dos bichinhos virtuais: cenário em tela cheia, botões
// redondos com medidor, nível em anel e muita interação — tocar na cabeça, na barriga e no pé,
// comida feita na cozinha, sabonete + chuveiro, vaso com descarga, luz do quarto e closet.
import { useEffect, useRef, useState } from 'react';
import { Brush, Crown, Glasses, Heart, Lamp, Lock, Moon, Shirt, ShowerHead, Smile, Sparkles, Toilet, Utensils, X } from 'lucide-react';
import { api } from '../../../api.js';
import { Button, Loading, notify, useLoad } from '../../../ui.jsx';
import { sfx, unlockAudio } from '../audio.js';
import PetArt, { FoodArt, Poop, swatch } from './PetArt.jsx';
import { RoomBack, RoomFront } from './Rooms.jsx';
import './pet.css';

const KIND_NAME = { cachorro: ['Cachorrinho', 'Cachorrinha'], gato: ['Gatinho', 'Gatinha'], ovelha: ['Carneirinho', 'Ovelhinha'] };
const kindName = (k, g) => KIND_NAME[k][g === 'f' ? 1 : 0];
const SLOT = { chapeu: ['Cabeça', Crown], oculos: ['Óculos', Glasses], rosto: ['Rosto', Sparkles], pescoco: ['Pescoço', Heart], roupa: ['Roupa', Shirt] };
const NAV = [
  ['sala', 'Alegria', Smile, (p) => p.alegria],
  ['cozinha', 'Comida', Utensils, (p) => p.fome],
  ['banho', 'Banho', ShowerHead, (p) => p.limpeza],
  ['toalete', 'Banheiro', Toilet, (p) => 100 - p.bexiga],
  ['quarto', 'Sono', Moon, (p) => p.energia],
];
// Onde o bichinho fica em cada cômodo (em unidades do cenário de 400 de largura).
const SPOT = {
  sala: { x: 200, b: 110, w: 250 }, cozinha: { x: 200, b: 70, w: 250 }, banho: { x: 200, b: 110, w: 230 },
  toalete: { x: 200, b: 150, w: 200 }, toaleteFora: { x: 112, b: 105, w: 200 }, quartoDorme: { x: 200, b: 175, w: 220 }, quarto: { x: 200, b: 40, w: 230 }, closet: { x: 200, b: 105, w: 260 },
};

function Adopt({ data, onDone }) {
  const [kind, setKind] = useState('gato');
  const [gender, setGender] = useState('m');
  const [color, setColor] = useState(data.colors.gato[0]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const pick = (k) => { setKind(k); setColor(data.colors[k][0]); };
  const adopt = async () => {
    setBusy(true);
    try { onDone((await api.post('/bichinho', { kind, color, name, gender })).pet); sfx('win'); } catch (e) { notify(e.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <div className="pet-adopt">
      <h2>Crie o seu bichinho</h2>
      <div className="pet-adopt-preview"><PetArt kind={kind} color={color} gender={gender} outfit={{ pescoco: 'lenco' }} /></div>
      <div className="pet-adopt-row">
        {data.kinds.map((k) => <button key={k} type="button" className={'pet-chip' + (kind === k ? ' on' : '')} onClick={() => pick(k)}>{kindName(k, gender)}</button>)}
      </div>
      <div className="pet-adopt-row">
        <button type="button" className={'pet-chip boy' + (gender === 'm' ? ' on' : '')} onClick={() => setGender('m')}>Menino</button>
        <button type="button" className={'pet-chip girl' + (gender === 'f' ? ' on' : '')} onClick={() => setGender('f')}>Menina</button>
      </div>
      <div className="pet-swatches">
        {data.colors[kind].map((c) => <button key={c} type="button" className={'pet-swatch' + (color === c ? ' on' : '')} style={{ background: swatch(kind, c) }} onClick={() => setColor(c)} aria-label={c} />)}
      </div>
      <input className="pet-name-input" placeholder="Nome do bichinho" maxLength={16} value={name} onChange={(e) => setName(e.target.value)} />
      <Button block busy={busy} disabled={name.trim().length < 2} onClick={adopt}><Heart size={16} /> Adotar</Button>
    </div>
  );
}

function LevelRing({ pet }) {
  const r = 26; const c = 2 * Math.PI * r;
  return (
    <div className="pet-level" title={`Nível ${pet.level}`}>
      <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r={r} className="track" /><circle cx="32" cy="32" r={r} className="fill" strokeDasharray={c} strokeDashoffset={c * (1 - pet.xp / pet.xp_next)} /></svg>
      <b>{pet.level}</b>
    </div>
  );
}

function Game({ data, setPet }) {
  const pet = data.pet;
  const wardrobe = data.wardrobes[pet.gender] || data.wardrobe;
  const [room, setRoom] = useState('sala');
  const [react, setReact] = useState(null);
  const [say, setSay] = useState(null);
  const [fx, setFx] = useState(null); // hearts | shower | flush | cook | fly
  const [food, setFood] = useState(null);
  const [tool, setTool] = useState(null); // sabonete
  const [bubbles, setBubbles] = useState([]);
  const [seated, setSeated] = useState(false);
  const [slot, setSlot] = useState('roupa');
  const [wet, setWet] = useState(false);
  const scene = useRef(null);
  const petRef = useRef(null);
  const timers = useRef({});
  const lastTouch = useRef(0);
  const busy = useRef(false);

  const later = (key, ms, fn) => { clearTimeout(timers.current[key]); timers.current[key] = setTimeout(fn, ms); };
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);
  const speak = (t, ms = 2600) => { setSay(t); later('say', ms, () => setSay(null)); };
  const doReact = (r, ms = 1200) => { setReact(r); later('react', ms, () => setReact(null)); };

  const act = async (acao, item, quiet) => {
    unlockAudio();
    try {
      const r = await api.post('/bichinho/acao', { acao, item });
      setPet(r.pet);
      if (r.msg && !quiet) speak(r.msg);
      if (r.level_up) { notify(`${r.pet.name} subiu para o nível ${r.pet.level}! Roupinhas novas no closet.`); sfx('win'); doReact('jump', 1400); }
      return r;
    } catch (e) { speak(e.message); sfx('error'); return null; }
  };

  // Banho: esfregar o sabonete faz espuma; o chuveiro enxágua.
  const scrub = (e) => {
    const sc = scene.current.getBoundingClientRect();
    setBubbles((bs) => (bs.length >= 40 ? bs : [...bs, { id: Math.random(), x: e.clientX - sc.left, y: e.clientY - sc.top, s: 14 + Math.random() * 18 }]));
    if (Math.random() < 0.2) sfx('pop');
  };

  // Olhos seguem o dedo.
  const look = (e) => {
    const el = petRef.current; const sc = scene.current;
    if (!el || !sc) return;
    const b = el.getBoundingClientRect();
    const dx = (e.clientX - (b.left + b.width / 2)) / (b.width / 2);
    const dy = (e.clientY - (b.top + b.height * 0.28)) / (b.height / 2);
    sc.style.setProperty('--ex', `${Math.max(-1, Math.min(1, dx)) * 6}px`);
    sc.style.setProperty('--ey', `${Math.max(-1, Math.min(1, dy)) * 5}px`);
    if (tool === 'sabonete' && e.buttons && e.target.closest('.pet-actor')) scrub(e);
  };

  // Reações espontâneas de vez em quando.
  useEffect(() => {
    const t = setInterval(() => {
      if (Date.now() - lastTouch.current < 6000 || pet.dormindo || busy.current || room === 'closet') return;
      if (pet.mood === 'sono') { doReact('yawn', 1600); return; }
      doReact(Math.random() < 0.6 ? 'wave' : 'jump', 1300);
    }, 9000);
    return () => clearInterval(t);
  });

  // Toques no bichinho: cabeça = carinho, barriga = cócegas, pé = pulinho.
  const touch = (e) => {
    lastTouch.current = Date.now();
    if (tool === 'sabonete') { scrub(e); return; }
    if (pet.dormindo) { speak(`Zzz... ${pet.name} está dormindo.`); return; }
    const b = petRef.current.getBoundingClientRect();
    const y = (e.clientY - b.top) / b.height;
    if (y < 0.48) { doReact('pat', 1300); setFx('hearts'); later('fx', 1500, () => setFx(null)); sfx('point'); act('carinho', null, true); }
    else if (y < 0.82) { doReact('laugh', 1300); sfx('pop'); act('carinho', null, true); speak('Hihihi! Cócegas!', 1400); }
    else { doReact('jump', 900); sfx('boing'); }
  };

  // Cozinha: a comida vai para a panela, chia e depois vai até a boca.
  const cook = (id) => {
    if (busy.current) return;
    if (pet.dormindo) { speak(`${pet.name} está dormindo.`); return; }
    if (pet.fome >= 95) { speak(`${pet.name} está de barriga cheia!`); doReact('ouch', 900); return; }
    busy.current = true; setFood(id); setFx('cook'); sfx('move');
    later('cook', 1100, () => {
      setFx('fly');
      later('fly', 600, async () => {
        setFx(null); doReact('chew', 1700); sfx('coin');
        await act('comer', id);
        busy.current = false; setFood(null);
      });
    });
  };

  const shower = () => {
    if (busy.current) return;
    if (bubbles.length < 12 && pet.limpeza < 95) { speak('Primeiro esfregue o sabonete no bichinho!'); setTool('sabonete'); return; }
    busy.current = true; setFx('shower'); setTool(null); sfx('spray');
    later('rinse', 900, () => setBubbles([]));
    later('shower', 1800, async () => {
      setFx(null); setWet(true); later('wet', 1400, () => { setWet(false); doReact('jump', 800); });
      await act('banho'); busy.current = false;
    });
  };

  // Banheiro: senta no vaso, faz xixi e dá descarga.
  const pee = () => {
    if (busy.current) return;
    busy.current = true; setSeated(true);
    later('pee', 900, async () => {
      const r = await act('xixi');
      if (!r) { setSeated(false); busy.current = false; return; }
      doReact('pat', 1200);
      later('flush', 1500, () => {
        setFx('flush'); sfx('whoosh');
        later('flushEnd', 1300, () => { setFx(null); setSeated(false); busy.current = false; });
      });
    });
  };

  const go = (r) => { setRoom(r); setTool(null); setBubbles([]); setSeated(false); sfx('tap'); };
  const night = pet.dormindo;
  const mess = pet.cocos > 0 || pet.xixi_chao;
  const spotKey = room === 'toalete' ? (seated ? 'toalete' : 'toaleteFora') : room === 'quarto' && night ? 'quartoDorme' : room;
  const spot = SPOT[spotKey];
  const petAbove = room === 'quarto' && !night; // acordado, fica na frente da cama

  return (
    <div className="pet-game">
      <div className={`pet-scene room-${room}${night ? ' night' : ''}`} ref={scene} onPointerMove={look} onPointerDown={look}>
        <RoomBack room={room} night={night} />
        <div
          className={'pet-actor' + (petAbove ? ' above' : '')}
          ref={petRef}
          style={{ left: `calc(${spot.x} * 100cqw / 400)`, bottom: `calc(${spot.b} * 100cqw / 400)`, width: `calc(${spot.w} * 100cqw / 400)` }}
          onPointerDown={touch}
          role="button" tabIndex={0} aria-label={`Tocar no(a) ${pet.name}`}
        >
          <PetArt kind={pet.kind} color={pet.color} gender={pet.gender} mood={pet.mood} react={react} outfit={pet.outfit} dirty={pet.limpeza < 30 && !wet} wet={wet} />
        </div>
        <RoomFront room={room} sleeping={night} seated={seated} />
        {room !== 'quarto' && room !== 'closet' && (
          <div className="pet-mess">
            {Array.from({ length: pet.cocos }, (_, i) => <Poop key={i} />)}
            {pet.xixi_chao && <span className="pet-puddle" />}
          </div>
        )}
        {night && <div className="pet-zzz"><span>z</span><span>z</span><span>Z</span></div>}
        {bubbles.map((b) => <i key={b.id} className={'pet-bubble' + (fx === 'shower' ? ' pop' : '')} style={{ left: b.x, top: b.y, width: b.s, height: b.s }} />)}
        {fx === 'hearts' && <div className="pet-fx-hearts">{[0, 1, 2, 3, 4].map((i) => <Heart key={i} size={26} fill="#FF5A7A" color="#FF5A7A" style={{ '--i': i }} />)}</div>}
        {fx === 'shower' && <div className="pet-fx-shower">{Array.from({ length: 26 }, (_, i) => <i key={i} style={{ '--i': i }} />)}</div>}
        {fx === 'flush' && <div className="pet-fx-flush" />}
        {food && fx === 'cook' && <div className="pet-pan"><FoodArt id={food} size={54} /><span /><span /><span /></div>}
        {food && fx === 'fly' && <div className="pet-food-fly"><FoodArt id={food} size={64} /></div>}

        {/* HUD */}
        <LevelRing pet={pet} />
        <div className="pet-namechip">{pet.name}</div>
        {room === 'sala' && <button type="button" className="pet-round top-right" onClick={() => go('closet')} aria-label="Closet"><Shirt size={24} /></button>}
        {room === 'closet' && <button type="button" className="pet-round top-right" onClick={() => go('sala')} aria-label="Sair do closet"><X size={24} /></button>}
        {mess && room !== 'closet' && <button type="button" className="pet-round clean" onClick={() => { sfx('pop'); act('limpar'); }} aria-label="Limpar"><Brush size={22} /></button>}
        {say && <div className="pet-say">{say}</div>}

        {/* Controles de cada cômodo */}
        {room === 'cozinha' && (
          <div className="pet-food-bar">
            {Object.entries(data.recipes).map(([id, r]) => (
              <button key={id} type="button" className="pet-food" onClick={() => cook(id)} aria-label={r.name}><FoodArt id={id} size={52} /><small>{r.name}</small></button>
            ))}
          </div>
        )}
        {room === 'banho' && (
          <div className="pet-tools">
            <button type="button" className={'pet-tool' + (tool === 'sabonete' ? ' on' : '')} onClick={() => setTool(tool === 'sabonete' ? null : 'sabonete')}><span className="soap" />Sabonete</button>
            <button type="button" className={'pet-tool' + (bubbles.length >= 12 ? ' ready' : '')} onClick={shower}><ShowerHead size={26} />Chuveiro</button>
          </div>
        )}
        {room === 'banho' && tool === 'sabonete' && bubbles.length < 12 && <div className="pet-hint">Esfregue o dedo no(a) {pet.name}!</div>}
        {room === 'toalete' && (
          <div className="pet-tools">
            <button type="button" className="pet-tool" onClick={pee}><Toilet size={26} />Fazer xixi</button>
          </div>
        )}
        {room === 'quarto' && (
          <div className="pet-tools">
            <button type="button" className={'pet-tool lamp' + (night ? ' off' : '')} onClick={() => { sfx('tap'); act('dormir'); }}><Lamp size={26} />{night ? 'Acender a luz' : 'Apagar a luz'}</button>
          </div>
        )}
        {room === 'closet' && (
          <>
            <div className="pet-slots">
              {Object.keys(wardrobe).map((sl) => {
                const [label, Icon] = SLOT[sl];
                return <button key={sl} type="button" className={'pet-round' + (slot === sl ? ' on' : '')} onClick={() => setSlot(sl)} aria-label={label}><Icon size={22} /></button>;
              })}
            </div>
            <div className="pet-items">
              {(wardrobe[slot] || []).map(([id, name, lvl]) => {
                const locked = pet.level < lvl;
                const on = pet.outfit[slot] === id;
                const wear = async () => {
                  if (locked) { speak(`${name}: libera no nível ${lvl}.`); return; }
                  if (await act('vestir', id, true)) { sfx('flip'); doReact('wave', 1000); }
                };
                return (
                  <button key={id} type="button" className={'pet-item' + (on ? ' on' : '') + (locked ? ' locked' : '')} onClick={wear}>
                    <PetArt kind={pet.kind} color={pet.color} gender={pet.gender} outfit={{ [slot]: id }} crop={['roupa', 'pescoco'].includes(slot) ? 'body' : 'head'} />
                    <small>{locked ? <><Lock size={10} /> nível {lvl}</> : name}</small>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <nav className="pet-nav">
        {NAV.map(([id, label, Icon, val]) => {
          const v = Math.round(val(pet));
          return (
            <button key={id} type="button" className={'pet-navbtn' + (room === id ? ' on' : '') + (v < 30 ? ' low' : '')} style={{ '--v': v }} onClick={() => go(id)} aria-label={`${label}: ${v}%`}>
              <span className="meter"><Icon size={26} /></span>
              <small>{label}</small>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default function PetPage() {
  const state = useLoad(() => api.get('/bichinho'));
  const [pet, setPet] = useState(null);
  useEffect(() => { if (state.data) setPet(state.data.pet); }, [state.data]);
  // As necessidades mudam com o tempo: atualiza a cada minuto.
  useEffect(() => {
    const t = setInterval(() => api.get('/bichinho').then((r) => r.pet && setPet(r.pet)).catch(() => {}), 60e3);
    return () => clearInterval(t);
  }, []);
  return (
    <Loading {...state}>
      {(data) => (pet ? <Game data={{ ...data, pet }} setPet={setPet} /> : <Adopt data={data} onDone={setPet} />)}
    </Loading>
  );
}
