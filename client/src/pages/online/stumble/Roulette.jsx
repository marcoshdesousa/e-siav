// Roleta das fases (como no Stumble Guys): os cartões das fases passam rápido, vão freando e param na
// fase que o servidor sorteou. O movimento sai do relógio do servidor, então todos veem a mesma coisa
// e quem entra no meio pega a roleta já andando.
import { useEffect, useMemo, useRef } from 'react';
import {
  ArrowBigUp, Axe, Bell, BrickWall, ChevronsUp, Crown, Cylinder, DoorOpen, Factory, Fan, FastForward, FerrisWheel, Flag, Grid3x3,
  Hammer, Hexagon, Mountain, MoveVertical, PersonStanding, Rabbit, Sailboat, Scale, Shuffle, Snowflake, Target, Tent, Tornado,
  TreePalm, Trophy, Volleyball, Wind,
} from 'lucide-react';
import { sfx } from '../../games/audio.js';
import { rng, STAGES, THEMES } from './stages.js';

// Ícone de cada fase (mesma ordem de STAGES)
const ICONS = [Flag, Bell, Factory, Sailboat, Rabbit, DoorOpen, Grid3x3, Mountain, Hammer, Fan, Target, PersonStanding, ChevronsUp, FastForward, TreePalm, Shuffle, ArrowBigUp, Tornado, Tent, Trophy, FerrisWheel, Volleyball, Axe, Scale, Hexagon, Snowflake, Wind, Cylinder, MoveVertical, BrickWall];

const COUNT = 30; // cartões na fita
const TARGET = 25; // posição do cartão sorteado (sobram alguns depois dele)
const PITCH = 138; // largura do cartão + espaço (px)
const SPIN = 0.9; // parte do tempo girando; o resto fica parado mostrando a fase

/** Desacelera como roleta de verdade: começa rápido e para devagar, com um tranquinho no fim. */
function reelPos(f) {
  if (f >= SPIN) return TARGET;
  const x = f / SPIN;
  const e = 1 - (1 - x) ** 3.2;
  return TARGET * e + Math.sin(x * Math.PI) * 0.18 * x ** 6;
}

/** Miniatura da fase desenhada em CSS: céu, água, a pista em perspectiva e o ícone. */
export function StageThumb({ index }) {
  const th = THEMES[index % THEMES.length];
  const Icon = ICONS[index % ICONS.length] || Flag;
  return (
    <span className="stb-thumb" style={{ '--sky1': th.skyTop, '--sky2': th.skyBot, '--water': th.water, '--floor': th.floor, '--trim': th.trim, '--acc': th.acc, '--obs': th.obs }}>
      <i className="stb-thumb-track" />
      <i className="stb-thumb-ico"><Icon size={22} strokeWidth={2.6} /></i>
    </span>
  );
}

export default function Roulette({ g, clock }) {
  const strip = useRef(null);
  const wrap = useRef(null);
  const title = useRef(null);
  // Fita de cartões: sorteio fixo pela semente da rodada (igual em todos os celulares)
  const cards = useMemo(() => {
    const r = rng((g.seed || 1) * 31 + 7);
    const out = [];
    for (let i = 0; i < COUNT; i++) {
      let s;
      do s = Math.floor(r() * STAGES.length); while (s === out[i - 1] || (i === TARGET - 1 && s === g.stage) || (i === TARGET + 1 && s === g.stage));
      out.push(s);
    }
    out[TARGET] = g.stage;
    return out;
  }, [g.seed, g.stage]);

  useEffect(() => {
    let raf = 0;
    let lastIdx = -1;
    let lastTick = 0;
    const ms = g.rouletteMs || 3000;
    const startF = 1 - (g.rouletteEndsAt - clock()) / ms;
    let dinged = startF >= SPIN; // entrou depois que parou: sem som
    const els = strip.current ? [...strip.current.children] : [];
    const loop = () => {
      raf = window.requestAnimationFrame(loop);
      const f = Math.max(0, Math.min(1, 1 - (g.rouletteEndsAt - clock()) / ms));
      const pos = reelPos(f);
      const w = wrap.current?.clientWidth || 360;
      if (strip.current) strip.current.style.transform = `translate3d(${w / 2 - PITCH / 2 - pos * PITCH}px,0,0)`;
      // Cartão do meio maior; os dos lados menores e mais apagados
      for (let i = Math.max(0, Math.floor(pos) - 3); i <= Math.min(els.length - 1, Math.ceil(pos) + 3); i++) {
        const d = Math.min(1, Math.abs(i - pos));
        els[i].style.transform = `scale(${1.08 - d * 0.2})`;
        els[i].style.opacity = String(1 - d * 0.45);
      }
      const idx = Math.round(pos);
      const now = window.performance.now();
      if (idx !== lastIdx) {
        if (lastIdx >= 0 && !dinged && now - lastTick > 40) { sfx('stbTick'); lastTick = now; }
        lastIdx = idx;
      }
      if (f >= SPIN && !dinged) {
        dinged = true;
        sfx('stbDing');
      }
      if (f >= SPIN) {
        wrap.current?.classList.add('landed');
        if (title.current) title.current.textContent = 'Fase sorteada!';
      }
    };
    loop();
    return () => window.cancelAnimationFrame(raf);
  }, [g.rouletteEndsAt, g.rouletteMs, cards]);

  return (
    <div className={'stb-roul' + (g.round >= 2 ? ' final' : '')}>
      <div className="stb-rounds">{[0, 1, 2].map((r) => <i key={r} className={r < g.round ? 'done' : r === g.round ? 'now' : ''}>{r === 2 ? <Crown size={12} /> : r + 1}</i>)}</div>
      <small>{g.round >= 2 ? 'Fase final' : `Fase ${g.round + 1} de 3`}</small>
      <b ref={title}>Sorteando a fase...</b>
      <div className="stb-reel" ref={wrap}>
        <div className="stb-reel-strip" ref={strip}>
          {cards.map((s, i) => (
            <div key={i} className={'stb-rcard' + (i === TARGET ? ' pick' : '')}>
              <StageThumb index={s} />
              <em>{STAGES[s].name}</em>
            </div>
          ))}
        </div>
        <i className="stb-reel-mark" aria-hidden="true" />
      </div>
    </div>
  );
}
