// Meu Bichinho (aba em Jogos): adotar e cuidar — comida feita na cozinha, banho, xixi, cocô,
// dormir, carinho e roupinhas que liberam com o nível.
import { useEffect, useRef, useState } from 'react';
import { Bath, BedDouble, Brush, CookingPot, Droplets, Heart, Lock, Moon, Shirt, Sofa, Sparkles, Sun, Utensils } from 'lucide-react';
import { api } from '../../../api.js';
import { Button, Loading, notify, useLoad } from '../../../ui.jsx';
import { sfx, unlockAudio } from '../audio.js';
import PetArt, { FoodArt, Poop, swatch } from './PetArt.jsx';
import './pet.css';

const KIND_NAME = { cachorro: 'Cachorrinho', gato: 'Gatinho', ovelha: 'Ovelhinha' };
const SLOT_NAME = { chapeu: 'Chapéu', oculos: 'Óculos', pescoco: 'Pescoço', roupa: 'Roupa' };
const ROOMS = [['sala', 'Sala', Sofa], ['cozinha', 'Cozinha', CookingPot], ['banheiro', 'Banheiro', Bath], ['quarto', 'Quarto', BedDouble], ['roupas', 'Roupas', Shirt]];
const METERS = [['fome', 'Comida', Utensils], ['energia', 'Energia', Moon], ['limpeza', 'Limpeza', Sparkles], ['banheiro', 'Banheiro', Droplets], ['alegria', 'Alegria', Heart]];

function Adopt({ data, onDone }) {
  const [kind, setKind] = useState('cachorro');
  const [color, setColor] = useState(data.colors.cachorro[0]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const pick = (k) => { setKind(k); setColor(data.colors[k][0]); };
  const adopt = async () => {
    setBusy(true);
    try { onDone((await api.post('/bichinho', { kind, color, name })).pet); sfx('win'); } catch (e) { notify(e.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <div className="pet-adopt">
      <h2>Adote o seu bichinho</h2>
      <p className="small muted">Ele vai precisar de você todo dia: comida, banho, banheiro, sono e carinho.</p>
      <div className="pet-kinds">
        {data.kinds.map((k) => (
          <button key={k} type="button" className={'pet-kind' + (kind === k ? ' on' : '')} onClick={() => pick(k)}>
            <PetArt kind={k} color={kind === k ? color : data.colors[k][0]} />
            <b>{KIND_NAME[k]}</b>
          </button>
        ))}
      </div>
      <div className="pet-swatches">
        {data.colors[kind].map((c) => (
          <button key={c} type="button" className={'pet-swatch' + (color === c ? ' on' : '')} style={{ background: swatch(kind, c) }} onClick={() => setColor(c)} aria-label={c} title={c} />
        ))}
      </div>
      <input className="pet-name-input" placeholder="Nome do bichinho" maxLength={16} value={name} onChange={(e) => setName(e.target.value)} />
      <Button block busy={busy} disabled={name.trim().length < 2} onClick={adopt}><Heart size={16} /> Adotar</Button>
    </div>
  );
}

function Meters({ pet }) {
  const val = (k) => (k === 'banheiro' ? 100 - pet.bexiga : pet[k]);
  return (
    <div className="pet-meters">
      {METERS.map(([k, label, Icon]) => {
        const v = val(k);
        return (
          <div key={k} className={'pet-meter' + (v < 30 ? ' low' : '')} title={`${label}: ${v}%`}>
            <span className="pet-ring" style={{ '--v': v }}><Icon size={16} /></span>
            <small>{label}</small>
          </div>
        );
      })}
    </div>
  );
}

function Care({ data, setPet }) {
  const pet = data.pet;
  const [room, setRoom] = useState('sala');
  const [fx, setFx] = useState(null); // efeito na cena: hearts | bubbles | food:<id> | cooking:<id> | toilet
  const [say, setSay] = useState(null);
  const [slot, setSlot] = useState('chapeu');
  const timer = useRef();
  const speak = (text) => { clearTimeout(timer.current); setSay(text); timer.current = setTimeout(() => setSay(null), 2600); };
  useEffect(() => () => clearTimeout(timer.current), []);

  const act = async (acao, item, effect, sound) => {
    unlockAudio();
    try {
      const r = await api.post('/bichinho/acao', { acao, item });
      setPet(r.pet);
      if (effect) { setFx(effect); setTimeout(() => setFx(null), 1800); }
      if (sound) sfx(sound);
      if (r.msg) speak(r.msg);
      if (r.level_up) { notify(`${r.pet.name} subiu para o nível ${r.pet.level}! Roupinhas novas liberadas.`); sfx('win'); }
      return true;
    } catch (e) { speak(e.message); return false; }
  };
  const cook = (id) => {
    if (fx) return;
    setFx(`cooking:${id}`); sfx('move');
    setTimeout(async () => { setFx(null); await act('comer', id, `food:${id}`, 'coin'); }, 1600);
  };
  const mess = pet.cocos > 0 || pet.xixi_chao;
  const level = pet.level;

  return (
    <div className="pet-care">
      <div className="pet-head">
        <div><b>{pet.name}</b><small>{KIND_NAME[pet.kind]} · nível {level}</small></div>
        <div className="pet-xp"><i style={{ width: `${(pet.xp / pet.xp_next) * 100}%` }} /></div>
      </div>
      <Meters pet={pet} />

      <div className={`pet-room room-${room}${pet.dormindo ? ' night' : ''}`}>
        <div className="pet-props" aria-hidden="true">
          {room === 'sala' && <><div className="prop-window" /><div className="prop-sofa" /><div className="prop-rug" /></>}
          {room === 'cozinha' && <><div className="prop-cabinets" /><div className="prop-stove" /></>}
          {room === 'banheiro' && <><div className="prop-tiles" /><div className={'prop-toilet' + (fx === 'toilet' ? ' busy' : '')} /><div className="prop-tub" /></>}
          {room === 'quarto' && <><div className="prop-window night-window" /><div className="prop-bed" /><div className="prop-lamp" /></>}
          {room === 'roupas' && <><div className="prop-mirror" /><div className="prop-wardrobe" /></>}
        </div>
        <button type="button" className={'pet-stage' + (fx === 'toilet' ? ' on-toilet' : '')} onClick={() => !pet.dormindo && act('carinho', null, 'hearts', 'point')} aria-label={`Fazer carinho em ${pet.name}`}>
          <PetArt kind={pet.kind} color={pet.color} mood={fx?.startsWith('food') ? 'feliz' : pet.mood} outfit={pet.outfit} dirty={pet.limpeza < 30} />
        </button>
        {fx === 'toilet' && <div className="prop-toilet-front" aria-hidden="true" />}
        {pet.dormindo && <div className="pet-zzz"><span>z</span><span>z</span><span>Z</span></div>}
        <div className="pet-floor-mess">
          {Array.from({ length: pet.cocos }, (_, i) => <Poop key={i} />)}
          {pet.xixi_chao && <span className="pet-puddle" />}
        </div>
        {fx === 'hearts' && <div className="pet-fx hearts">{[0, 1, 2, 3, 4].map((i) => <Heart key={i} size={22} fill="#FF5A7A" color="#FF5A7A" style={{ '--i': i }} />)}</div>}
        {fx === 'bubbles' && <div className="pet-fx bubbles">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--i': i }} />)}</div>}
        {fx?.startsWith('food') && <div className="pet-fx food"><FoodArt id={fx.split(':')[1]} size={64} /></div>}
        {fx?.startsWith('cooking') && <div className="pet-fx cooking"><div className="pan"><FoodArt id={fx.split(':')[1]} size={46} /></div><span className="steam" /><span className="steam" /><span className="steam" /></div>}
        {say && <div className="pet-say">{say}</div>}
        {mess && <button type="button" className="pet-clean" onClick={() => act('limpar', null, 'bubbles', 'point')}><Brush size={16} /> Limpar</button>}
      </div>

      <div className="pet-panel">
        {room === 'sala' && (
          <div className="pet-actions">
            <Button onClick={() => act('carinho', null, 'hearts', 'point')} disabled={pet.dormindo}><Heart size={16} /> Fazer carinho</Button>
            <p className="small muted">Toque no(a) {pet.name} para fazer carinho. Cuidar dá experiência e libera roupinhas novas.</p>
          </div>
        )}
        {room === 'cozinha' && (
          <div className="pet-recipes">
            {Object.entries(data.recipes).map(([id, r]) => (
              <button key={id} type="button" className="pet-recipe" disabled={!!fx || pet.dormindo} onClick={() => cook(id)}>
                <FoodArt id={id} size={48} /><b>{r.name}</b><small>+{r.fome} comida</small>
              </button>
            ))}
          </div>
        )}
        {room === 'banheiro' && (
          <div className="pet-actions two">
            <Button onClick={() => act('banho', null, 'bubbles', 'point')} disabled={pet.dormindo}><Bath size={16} /> Dar banho</Button>
            <Button variant="secondary" onClick={async () => { setFx('toilet'); const ok = await act('xixi', null, null, 'move'); setTimeout(() => setFx(null), ok ? 1500 : 0); }} disabled={pet.dormindo}><Droplets size={16} /> Fazer xixi</Button>
          </div>
        )}
        {room === 'quarto' && (
          <div className="pet-actions">
            <Button onClick={() => act('dormir', null, null, 'move')}>{pet.dormindo ? <><Sun size={16} /> Acender a luz e acordar</> : <><Moon size={16} /> Apagar a luz e dormir</>}</Button>
            <p className="small muted">Dormindo, a energia volta rapidinho e ele acorda sozinho quando descansar.</p>
          </div>
        )}
        {room === 'roupas' && (
          <div className="pet-wardrobe">
            <div className="seg">{Object.keys(data.wardrobe).map((s) => <button key={s} type="button" className={slot === s ? 'active' : ''} onClick={() => setSlot(s)}>{SLOT_NAME[s]}</button>)}</div>
            <div className="pet-items">
              {data.wardrobe[slot].map(([id, name, lvl]) => {
                const locked = level < lvl;
                const on = pet.outfit[slot] === id;
                return (
                  <button key={id} type="button" className={'pet-item' + (on ? ' on' : '') + (locked ? ' locked' : '')} disabled={locked} onClick={() => act('vestir', id)}>
                    <PetArt kind={pet.kind} color={pet.color} outfit={{ [slot]: id }} />
                    <b>{name}</b>
                    <small>{locked ? <><Lock size={11} /> nível {lvl}</> : on ? 'Usando' : 'Vestir'}</small>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <nav className="pet-rooms">
        {ROOMS.map(([id, label, Icon]) => (
          <button key={id} type="button" className={room === id ? 'on' : ''} onClick={() => setRoom(id)}><Icon size={20} /><span>{label}</span></button>
        ))}
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
    const t = setInterval(() => api.get('/bichinho').then((r) => setPet(r.pet)).catch(() => {}), 60e3);
    return () => clearInterval(t);
  }, []);
  return (
    <Loading {...state}>
      {(data) => (pet ? <Care data={{ ...data, pet }} setPet={setPet} /> : <Adopt data={data} onDone={setPet} />)}
    </Loading>
  );
}
