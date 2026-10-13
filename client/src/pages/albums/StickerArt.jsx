import { useId } from 'react';
import './stickers.css';

/* =========================================================
   Álbum Bíblico — arte vetorial das figurinhas
   StickerArt: retrato "chibi" gerado a partir de `look`.
   StickerCard: a figurinha completa (moldura, nº, nome, selo).
   ========================================================= */

const OUT = '#3B2A20';

const SKINS = {
  light: ['#F9DCC4', '#EAB996'],
  tan: ['#EDBB8E', '#D39A6A'],
  brown: ['#B97A4E', '#985D35'],
  dark: ['#7B4A2D', '#5C341D'],
};
const HAIRS = {
  black: '#2A2226',
  brown: '#6B4226',
  red: '#B5532B',
  blond: '#E6B85C',
  gray: '#A9A9AE',
  white: '#F1EFEA',
};

const DEFAULT_LOOK = {
  gender: 'm', age: 'adult', skin: 'tan', hair: 'brown', hairStyle: 'short', beard: 'none',
  head: 'none', robe: '#7A4E2D', robe2: '#E9C46A', item: 'none', bg: '#BDE0A8',
};

function hexToRgb(hex) {
  let h = String(hex || '#888888').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [136, 136, 136];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** Clareia (amt > 0) ou escurece (amt < 0) uma cor hex. amt em -1..1. */
function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const f = (c) => Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt));
  return '#' + [f(r), f(g), f(b)].map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('');
}
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function starPath(cx, cy, R, r, n = 5, rot = -90) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    const rad = i % 2 === 0 ? R : r;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)}`);
  }
  return 'M' + pts.join(' L') + 'Z';
}

/* Traço com contorno (desenha a linha escura por baixo e a cor por cima). */
function Stick({ d, color, w = 4 }) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={OUT} strokeWidth={w + 2.4} />
      <path d={d} stroke={color} strokeWidth={w} />
    </g>
  );
}

const GOLD = '#F5C842';
const GOLD_D = '#C99418';
const WOOD = '#A0703F';
const WOOD_D = '#734B26';
const STONE = '#BDB7AC';
const CLAY = '#C97A45';
const SILVER = '#E3E8EF';
const LEAF = '#5FA13A';

/* ---------- itens (coordenadas locais, centro 0,0 ~ caixa de 40px) ---------- */
const ITEMS = {
  staff: {
    hand: [6, 2],
    draw: () => <Stick d="M6 30 L6 -46 C6 -62 -10 -62 -10 -50" color={WOOD} w={4} />,
  },
  sword: {
    hand: [0, 15],
    draw: () => (
      <g>
        <path d="M-3.5 6 L-3.5 -34 L0 -41 L3.5 -34 L3.5 6Z" fill={SILVER} />
        <path d="M0 -38 L0 4" stroke="#AEB8C6" strokeWidth="1" fill="none" />
        <rect x="-11" y="5" width="22" height="5" rx="2.5" fill={GOLD} />
        <rect x="-2.5" y="10" width="5" height="12" rx="1.5" fill={WOOD_D} />
        <circle cx="0" cy="24.5" r="3.4" fill={GOLD} />
      </g>
    ),
  },
  spear: {
    hand: [6, 4],
    draw: () => (
      <g>
        <Stick d="M6 30 L6 -48" color={WOOD} w={3.4} />
        <path d="M6 -70 C11 -62 11 -54 6 -48 C1 -54 1 -62 6 -70Z" fill={SILVER} />
        <path d="M2 -48 L10 -48" stroke={OUT} strokeWidth="2.6" strokeLinecap="round" />
      </g>
    ),
  },
  harp: {
    draw: () => (
      <g>
        <path d="M-12 18 L12 18 L10 12 L-10 12Z" fill={WOOD} />
        {[-6, -2, 2, 6].map((x) => <path key={x} d={`M${x} -17 L${x} 13`} stroke="#FFF6D8" strokeWidth="1" />)}
        <Stick d="M-10 13 C-18 0 -16 -14 -12 -22 M10 13 C18 0 16 -14 12 -22" color={GOLD} w={3.6} />
        <Stick d="M-15 -17 L15 -17" color={WOOD} w={3} />
        <circle cx="-12" cy="-23" r="2.6" fill={GOLD} />
        <circle cx="12" cy="-23" r="2.6" fill={GOLD} />
      </g>
    ),
  },
  scroll: {
    draw: () => (
      <g>
        <rect x="-13" y="-12" width="26" height="25" fill="#F6E7BE" />
        {[-6, -2, 2, 6].map((y) => <path key={y} d={`M-8 ${y} L8 ${y}`} stroke="#B89A62" strokeWidth="1.2" />)}
        <rect x="-16" y="-17" width="32" height="7" rx="3.5" fill="#DDB97A" />
        <rect x="-16" y="11" width="32" height="7" rx="3.5" fill="#DDB97A" />
        <circle cx="-17" cy="-13.5" r="2.4" fill={WOOD_D} /><circle cx="17" cy="-13.5" r="2.4" fill={WOOD_D} />
        <circle cx="-17" cy="14.5" r="2.4" fill={WOOD_D} /><circle cx="17" cy="14.5" r="2.4" fill={WOOD_D} />
      </g>
    ),
  },
  tablets: {
    draw: () => (
      <g>
        {[-11, 11].map((cx) => (
          <g key={cx}>
            <path d={`M${cx - 10} 20 L${cx - 10} -10 C${cx - 10} -22 ${cx + 10} -22 ${cx + 10} -10 L${cx + 10} 20Z`} fill="#CFC9BC" />
            {[-8, -2, 4, 10].map((y) => <path key={y} d={`M${cx - 5} ${y} L${cx + 5} ${y}`} stroke="#8D8577" strokeWidth="1.3" />)}
          </g>
        ))}
      </g>
    ),
  },
  crown: {
    draw: () => (
      <g>
        <path d="M-17 12 L-18 -10 L-9 -1 L0 -15 L9 -1 L18 -10 L17 12Z" fill={GOLD} />
        <rect x="-17" y="6" width="34" height="7" fill={GOLD_D} />
        <circle cx="0" cy="-15.5" r="2.4" fill="#FFF" /><circle cx="-18" cy="-11" r="2.2" fill="#FFF" /><circle cx="18" cy="-11" r="2.2" fill="#FFF" />
        <circle cx="-8" cy="9.5" r="2.2" fill="#E63946" stroke="none" /><circle cx="0" cy="9.5" r="2.2" fill="#2E86DE" stroke="none" /><circle cx="8" cy="9.5" r="2.2" fill="#2BB673" stroke="none" />
      </g>
    ),
  },
  sling: {
    draw: () => (
      <g>
        <path d="M-12 -22 C-12 -4 -8 8 -4 12 M12 -22 C12 -4 8 8 4 12" fill="none" stroke={WOOD_D} strokeWidth="2" />
        <path d="M-8 10 C-6 20 6 20 8 10 C4 13 -4 13 -8 10Z" fill="#8A5A2E" />
        <circle cx="0" cy="9" r="5" fill="#9DA3A8" />
        <circle cx="-1.6" cy="7.4" r="1.4" fill="#fff" opacity=".6" stroke="none" />
        <circle cx="-12" cy="-23" r="2" fill={WOOD_D} /><circle cx="12" cy="-23" r="2" fill={WOOD_D} />
      </g>
    ),
  },
  net: {
    draw: (c) => (
      <g>
        <clipPath id={`${c.uid}-net`}><path d="M-20 -12 Q0 34 20 -12Z" /></clipPath>
        <path d="M-20 -12 Q0 34 20 -12Z" fill="#F3E3C0" opacity=".85" />
        <g clipPath={`url(#${c.uid}-net)`} stroke="#9C7A4C" strokeWidth="1.1">
          {[-24, -16, -8, 0, 8, 16, 24].map((x) => <path key={'a' + x} d={`M${x - 14} -14 L${x + 14} 24`} />)}
          {[-24, -16, -8, 0, 8, 16, 24].map((x) => <path key={'b' + x} d={`M${x + 14} -14 L${x - 14} 24`} />)}
        </g>
        <path d="M-20 -12 Q0 34 20 -12" fill="none" />
        <path d="M-21 -12 L21 -12" stroke={WOOD_D} strokeWidth="2.4" strokeLinecap="round" />
        {[-14, 0, 14].map((x) => <circle key={x} cx={x} cy="-12" r="3.2" fill="#F08A24" />)}
        <path d="M-6 6 C-2 2 4 2 6 6 C4 10 -2 10 -6 6Z M6 6 L10 3 L10 9Z" fill="#5BA4E6" />
      </g>
    ),
  },
  fish: {
    draw: () => (
      <g>
        <path d="M12 0 L23 -10 L21 0 L23 10Z" fill="#3E86CC" />
        <path d="M-18 0 C-10 -14 8 -14 14 0 C8 14 -10 14 -18 0Z" fill="#5BA9EA" />
        <path d="M-2 -9 C2 -4 2 4 -2 9" fill="none" stroke="#3E86CC" strokeWidth="1.3" />
        <path d="M2 -6 C5 -2 5 2 2 6" fill="none" stroke="#3E86CC" strokeWidth="1.1" />
        <circle cx="-10" cy="-2" r="2.6" fill="#fff" /><circle cx="-10.3" cy="-2" r="1.4" fill={OUT} stroke="none" />
        <path d="M-6 -16 C-2 -18 4 -16 6 -11 L-4 -10Z" fill="#3E86CC" />
      </g>
    ),
  },
  lamp: {
    draw: () => (
      <g>
        <circle cx="16" cy="-12" r="9" fill="#FFE27A" opacity=".45" stroke="none" />
        <path d="M-20 4 C-22 -2 -18 -6 -16 -2" fill="none" stroke={OUT} strokeWidth="2.2" />
        <path d="M-18 4 C-18 -4 -6 -6 4 -3 L18 -6 C16 2 10 12 -4 12 C-12 12 -18 9 -18 4Z" fill={CLAY} />
        <ellipse cx="-4" cy="-3" rx="7" ry="2" fill="#7A4220" />
        <path d="M16 -24 C21 -18 21 -12 16 -9 C11 -12 11 -18 16 -24Z" fill="#FFB020" />
        <path d="M16 -18 C18 -15 18 -12 16 -11 C14 -12 14 -15 16 -18Z" fill="#FFF3A6" stroke="none" />
      </g>
    ),
  },
  jar: {
    draw: () => (
      <g>
        <path d="M-9 -12 C-17 -12 -18 -2 -12 2 M9 -12 C17 -12 18 -2 12 2" fill="none" stroke={OUT} strokeWidth="2.4" />
        <path d="M-7 -16 L7 -16 L6 -10 C17 -5 17 14 7 19 L-7 19 C-17 14 -17 -5 -6 -10Z" fill={CLAY} />
        <rect x="-9" y="-20" width="18" height="5" rx="2" fill="#B5652F" />
        <path d="M-13 3 L13 3" stroke="#F3D19A" strokeWidth="2.4" />
        <path d="M-11 8 L11 8" stroke="#8C4A22" strokeWidth="1.2" />
      </g>
    ),
  },
  bread: {
    draw: () => (
      <g>
        <ellipse cx="-4" cy="6" rx="16" ry="9" fill="#D99A50" />
        <ellipse cx="5" cy="-4" rx="14" ry="8" fill="#E8B067" />
        {[-2, 4, 10].map((x) => <path key={x} d={`M${x - 3} -8 L${x + 1} -1`} stroke="#9E6328" strokeWidth="1.4" />)}
        {[-12, -5, 2].map((x) => <path key={x} d={`M${x - 3} 3 L${x + 1} 10`} stroke="#9E6328" strokeWidth="1.4" />)}
      </g>
    ),
  },
  dove: {
    draw: () => (
      <g>
        <path d="M-8 2 L-23 -3 L-21 9Z" fill="#E6EEF5" />
        <ellipse cx="0" cy="3" rx="14" ry="8.5" fill="#FFFFFF" transform="rotate(-10)" />
        <circle cx="11" cy="-6" r="6.5" fill="#FFFFFF" />
        <path d="M17 -7 L23 -5 L17 -3Z" fill="#F29A38" />
        <circle cx="12.5" cy="-7" r="1.3" fill={OUT} stroke="none" />
        <path d="M-6 0 C-6 -14 6 -22 12 -16 C6 -10 4 -2 -6 0Z" fill="#F1F5FA" />
        <path d="M-1 -6 C1 -10 4 -13 7 -14" fill="none" stroke="#B8C6D4" strokeWidth="1" />
        <path d="M20 -4 C22 2 24 6 26 8" fill="none" stroke="#5E7F2E" strokeWidth="1.3" />
        <ellipse cx="23" cy="2" rx="3" ry="1.5" fill={LEAF} transform="rotate(50 23 2)" />
        <ellipse cx="25" cy="7" rx="3" ry="1.5" fill={LEAF} transform="rotate(-20 25 7)" />
      </g>
    ),
  },
  lion: {
    draw: () => (
      <g>
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return <circle key={i} cx={(Math.cos(a) * 14).toFixed(2)} cy={(Math.sin(a) * 14 + 1).toFixed(2)} r="7" fill="#D9792A" />;
        })}
        <circle cx="0" cy="1" r="15" fill="#D9792A" stroke="none" />
        <circle cx="-9" cy="-8" r="3.6" fill="#F2C14E" /><circle cx="9" cy="-8" r="3.6" fill="#F2C14E" />
        <circle cx="0" cy="2" r="11" fill="#F2C14E" />
        <ellipse cx="0" cy="7" rx="6.5" ry="4.5" fill="#FBE3A6" stroke="none" />
        <circle cx="-4.5" cy="-1" r="1.7" fill={OUT} stroke="none" /><circle cx="4.5" cy="-1" r="1.7" fill={OUT} stroke="none" />
        <path d="M-2.4 3.5 L2.4 3.5 L0 6Z" fill="#7A3F1B" />
        <path d="M0 6 L0 8 M-3 9 C-1.5 10 0 9 0 8 C0 9 1.5 10 3 9" fill="none" strokeWidth="1.1" />
      </g>
    ),
  },
  ark: {
    draw: () => (
      <g>
        <rect x="-10" y="-11" width="20" height="13" fill="#E3B97A" />
        <path d="M-13 -10 L0 -20 L13 -10Z" fill="#B5502F" />
        <rect x="-3" y="-7" width="6" height="5" fill="#6E4723" />
        <path d="M-22 1 L22 1 L16 14 L-16 14Z" fill={WOOD} />
        <path d="M-19 6 L19 6 M-17 10 L17 10" stroke={WOOD_D} strokeWidth="1.1" />
        <path d="M-24 17 Q-18 13 -12 17 T0 17 T12 17 T24 17" fill="none" stroke="#3E8EDE" strokeWidth="2.4" />
      </g>
    ),
  },
  ladder: {
    draw: () => (
      <g>
        {[-30, -20, -10, 0, 10, 20].map((y, i) => (
          <Stick key={y} d={`M${-10 + i * -0.7 + (20 - y) * 0.08} ${y} L${10 + (20 - y) * 0.08} ${y}`} color="#D4A86A" w={2.4} />
        ))}
        <Stick d="M-10 26 L-6 -40" color="#C0914F" w={3.2} />
        <Stick d="M10 26 L14 -40" color="#C0914F" w={3.2} />
      </g>
    ),
  },
  trumpet: {
    draw: () => (
      <g transform="rotate(-28)">
        <rect x="-20" y="-2.2" width="26" height="4.4" rx="2" fill={GOLD} />
        <circle cx="-21" cy="0" r="3" fill={GOLD_D} />
        <path d="M4 -3 L20 -11 L20 11 L4 3Z" fill={GOLD} />
        <ellipse cx="20" cy="0" rx="3" ry="11" fill="#FFE07A" />
        <rect x="-9" y="-6" width="3" height="5" fill={GOLD_D} /><rect x="-4" y="-6" width="3" height="5" fill={GOLD_D} />
      </g>
    ),
  },
  shield: {
    draw: () => (
      <g>
        <circle cx="0" cy="0" r="19" fill={GOLD_D} />
        <circle cx="0" cy="0" r="15.5" fill="#B83B3B" stroke="none" />
        <path d="M0 -15 L0 15 M-15 0 L15 0" stroke={GOLD} strokeWidth="3" />
        <circle cx="0" cy="0" r="5" fill={GOLD} />
        <circle cx="-1.5" cy="-1.5" r="1.4" fill="#fff" opacity=".7" stroke="none" />
      </g>
    ),
  },
  bow: {
    draw: () => (
      <g>
        <path d="M-8 -24 L-8 24" stroke="#F4EAD5" strokeWidth="1.1" />
        <Stick d="M-8 -24 C12 -16 12 16 -8 24" color={WOOD} w={3.4} />
        <path d="M-18 0 L16 0" stroke={WOOD_D} strokeWidth="1.8" />
        <path d="M22 0 L14 -4 L14 4Z" fill={SILVER} />
        <path d="M-20 -4 L-14 0 L-20 4 M-17 -4 L-11 0 L-17 4" fill="none" stroke="#E63946" strokeWidth="1.6" />
      </g>
    ),
  },
  cross: {
    draw: () => (
      <g>
        <rect x="-3.6" y="-26" width="7.2" height="48" rx="1.2" fill={WOOD} />
        <rect x="-15" y="-16" width="30" height="7" rx="1.2" fill={WOOD} />
        <path d="M0 -22 L0 -18 M0 -6 L0 16" stroke={WOOD_D} strokeWidth=".9" />
      </g>
    ),
  },
  key: {
    draw: () => (
      <g transform="rotate(-20)">
        <rect x="-2.2" y="-8" width="4.4" height="28" rx="1.5" fill={GOLD} />
        <path d="M2 12 L8 12 L8 16 L2 16 M2 18 L6 18 L6 21 L2 21" fill={GOLD} />
        <circle cx="0" cy="-14" r="8" fill={GOLD} />
        <circle cx="0" cy="-14" r="3.2" fill="#fff" />
      </g>
    ),
  },
  pen: {
    draw: () => (
      <g>
        <path d="M-6 8 C-4 -6 6 -20 18 -26 C16 -12 6 2 -6 8Z" fill="#FFFFFF" />
        <path d="M-6 8 C2 -4 10 -16 18 -26" fill="none" stroke="#B8C6D4" strokeWidth="1.1" />
        <rect x="-16" y="6" width="14" height="12" rx="3" fill="#2F3E66" />
        <rect x="-14" y="3.5" width="10" height="4" rx="1.4" fill="#4A5C8C" />
      </g>
    ),
  },
  basket: {
    draw: () => (
      <g>
        <path d="M-14 -2 C-14 -18 14 -18 14 -2" fill="none" stroke={OUT} strokeWidth="5" />
        <path d="M-14 -2 C-14 -18 14 -18 14 -2" fill="none" stroke="#C99A55" strokeWidth="2.8" />
        <path d="M-19 -2 L19 -2 L14 17 L-14 17Z" fill="#D7A863" />
        {[-10, -3, 4, 11].map((x) => <path key={x} d={`M${x} -2 L${x * 0.75} 17`} stroke="#9C6B2E" strokeWidth="1.2" />)}
        {[4, 10].map((y) => <path key={y} d={`M${-18 + y * 0.25} ${y} L${18 - y * 0.25} ${y}`} stroke="#9C6B2E" strokeWidth="1.2" />)}
        <rect x="-20" y="-4" width="40" height="5" rx="2.5" fill="#C99A55" />
      </g>
    ),
  },
  lamb: {
    draw: () => (
      <g>
        <path d="M-10 10 L-10 18 M-3 11 L-3 18 M5 11 L5 18 M11 10 L11 18" stroke="#5A4A42" strokeWidth="2.6" strokeLinecap="round" />
        {[[-12, 2], [-6, -4], [2, -5], [9, -1], [10, 6], [2, 9], [-7, 9], [-14, 6]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="6.5" fill="#FFFFFF" />
        ))}
        <ellipse cx="-1" cy="2" rx="12" ry="8" fill="#FFFFFF" stroke="none" />
        <ellipse cx="16" cy="-4" rx="6" ry="7" fill="#F4E1D0" />
        <ellipse cx="11" cy="-8" rx="4" ry="2" fill="#E8CDB6" transform="rotate(-30 11 -8)" />
        <circle cx="17.5" cy="-5" r="1.2" fill={OUT} stroke="none" />
        <circle cx="12" cy="-11" r="3.2" fill="#FFFFFF" />
      </g>
    ),
  },
  star: {
    draw: () => (
      <g>
        <path d={starPath(0, 0, 19, 8.5)} fill="#FFD43B" />
        <path d={starPath(0, 0, 10, 4.5)} fill="#FFF3A6" stroke="none" />
        <path d="M-17 -18 L-17 -10 M-21 -14 L-13 -14 M17 12 L17 18 M14 15 L20 15" stroke="#FFF" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    ),
  },
  tent: {
    draw: (c) => (
      <g>
        <path d="M-22 16 L0 -18 L22 16Z" fill="#E9D3A8" />
        <path d="M-15 5 L15 5 L18 10 L-18 10Z" fill={c.robe2} stroke="none" />
        <path d="M-6 16 L0 2 L6 16Z" fill="#5A3B22" />
        <path d="M0 -18 L0 -24" stroke={WOOD_D} strokeWidth="2" />
        <path d="M-24 16 L24 16" stroke={OUT} strokeWidth="1.6" />
      </g>
    ),
  },
  boat: {
    draw: () => (
      <g>
        <path d="M2 -26 L2 2" stroke={WOOD_D} strokeWidth="2.4" />
        <path d="M4 -24 C14 -16 16 -6 14 0 L4 0Z" fill="#FFFFFF" />
        <path d="M0 -20 C-10 -14 -12 -6 -12 0 L0 0Z" fill="#F4E6CB" />
        <path d="M-21 2 L21 2 L14 13 L-14 13Z" fill={WOOD} />
        <path d="M-18 7 L18 7" stroke={WOOD_D} strokeWidth="1.1" />
        <path d="M-24 17 Q-18 13 -12 17 T0 17 T12 17 T24 17" fill="none" stroke="#3E8EDE" strokeWidth="2.4" />
      </g>
    ),
  },
  wheat: {
    draw: () => (
      <g>
        {[-10, 0, 10].map((x, i) => {
          const tilt = (i - 1) * 14;
          return (
            <g key={x} transform={`rotate(${tilt} 0 20)`}>
              <path d="M0 20 L0 -12" stroke="#B88A2E" strokeWidth="1.8" />
              {[-20, -14, -8, -2].map((y) => (
                <g key={y}>
                  <ellipse cx="-3" cy={y} rx="2.6" ry="4.4" fill="#F0C24B" transform={`rotate(-30 -3 ${y})`} />
                  <ellipse cx="3" cy={y} rx="2.6" ry="4.4" fill="#F0C24B" transform={`rotate(30 3 ${y})`} />
                </g>
              ))}
              <ellipse cx="0" cy="-25" rx="2.4" ry="4" fill="#F0C24B" />
            </g>
          );
        })}
        <path d="M-6 12 L6 12" stroke="#C0392B" strokeWidth="3" strokeLinecap="round" />
      </g>
    ),
  },
  oil: {
    draw: () => (
      <g>
        <path d="M-6 -14 L6 -14 L6 -8 C16 -3 16 15 0 17 C-16 15 -16 -3 -6 -8Z" fill="#E8D9A8" />
        <path d="M-11 4 C-10 12 -4 15 0 15 C4 15 10 12 11 4Z" fill="#E1B21E" stroke="none" />
        <rect x="-5" y="-20" width="10" height="6" rx="2" fill={WOOD} />
        <path d="M14 -18 C18 -12 18 -8 14 -6 C10 -8 10 -12 14 -18Z" fill="#F2C12E" />
        <path d="M-7 -4 C-9 0 -9 4 -8 6" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    ),
  },
  tree: {
    draw: () => (
      <g>
        <path d="M-4 22 L-3 2 L3 2 L4 22Z" fill={WOOD} />
        {[[-10, -6, 10], [10, -6, 10], [0, -16, 11], [0, -2, 11]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={LEAF} />)}
        <circle cx="0" cy="-7" r="13" fill={LEAF} stroke="none" />
        <circle cx="-6" cy="-14" r="5" fill="#86C25A" stroke="none" />
        {[[-10, -4], [7, -12], [6, 2], [-2, -20]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.6" fill="#E63946" />)}
      </g>
    ),
  },
  whale: {
    draw: () => (
      <g>
        <path d="M-19 2 L-29 -9 L-27 3 L-30 13Z" fill="#3D78C2" />
        <path d="M-22 4 C-22 -12 8 -16 18 -4 C22 1 22 7 18 10 C8 17 -18 17 -22 4Z" fill="#4E8FDB" />
        <path d="M-18 9 C-8 15 10 15 18 10 C12 6 -8 6 -18 9Z" fill="#BFDDF7" stroke="none" />
        <circle cx="10" cy="-1" r="1.8" fill={OUT} stroke="none" />
        <path d="M13 5 C15 6 17 6 19 5" fill="none" strokeWidth="1.2" />
        <path d="M2 -12 C2 -18 0 -22 -3 -24 M2 -12 C3 -18 6 -22 9 -23" fill="none" stroke="#9FD3FF" strokeWidth="2" strokeLinecap="round" />
      </g>
    ),
  },
  cup: {
    draw: () => (
      <g>
        <path d="M-13 -17 L13 -17 C13 -2 7 3 0 3 C-7 3 -13 -2 -13 -17Z" fill={GOLD} />
        <path d="M-12 -14 L12 -14" stroke={GOLD_D} strokeWidth="1.3" />
        <rect x="-2.5" y="2" width="5" height="11" fill={GOLD_D} />
        <ellipse cx="0" cy="15" rx="10" ry="3.6" fill={GOLD} />
        <circle cx="0" cy="-7" r="2.6" fill="#C0392B" />
        <path d="M-9 -12 C-9 -7 -7 -4 -5 -3" fill="none" stroke="#FFF6C8" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    ),
  },
  coins: {
    draw: () => (
      <g>
        {[14, 9, 4, -1].map((y) => (
          <g key={y}>
            <rect x="-17" y={y} width="20" height="5" fill={GOLD_D} />
            <ellipse cx="-7" cy={y} rx="10" ry="3.2" fill={GOLD} />
          </g>
        ))}
        <circle cx="10" cy="4" r="11" fill={GOLD} />
        <circle cx="10" cy="4" r="7.5" fill="none" stroke={GOLD_D} strokeWidth="1.4" />
        <path d="M10 0 L10 8 M7.5 2 L12.5 2" stroke={GOLD_D} strokeWidth="1.6" />
      </g>
    ),
  },
  book: {
    draw: () => (
      <g>
        <rect x="-13" y="-17" width="28" height="34" rx="3" fill="#F6F0E0" />
        <rect x="-15" y="-18" width="26" height="35" rx="3" fill="#8E3B2E" />
        <rect x="-15" y="-18" width="5" height="35" rx="2" fill="#6E2A20" />
        <path d="M2 -11 L2 5 M-4 -5 L8 -5" stroke={GOLD} strokeWidth="2.6" strokeLinecap="round" />
        <path d="M-6 11 L10 11" stroke={GOLD} strokeWidth="1.2" />
      </g>
    ),
  },
  fire: {
    draw: () => (
      <g>
        <path d="M0 -26 C9 -14 19 -6 15 8 C13 16 5 20 0 20 C-8 20 -16 14 -14 3 C-13 -4 -8 -6 -6 -12 C-2 -10 0 -14 0 -26Z" fill="#F77F28" />
        <path d="M1 -10 C6 -2 10 4 8 10 C6 16 -6 16 -7 9 C-8 3 -3 0 1 -10Z" fill="#FFD43B" stroke="none" />
        <path d="M1 2 C4 6 4 10 1 12 C-2 10 -2 6 1 2Z" fill="#FFF6C8" stroke="none" />
      </g>
    ),
  },
  rainbow: {
    draw: () => (
      <g fill="none" stroke="none">
        {['#E63946', '#F4A261', '#FFD43B', '#52B788', '#4D96FF', '#9B5DE5'].map((col, i) => (
          <path key={col} d={`M${-22 + i * 3} 10 A${22 - i * 3} ${22 - i * 3} 0 0 1 ${22 - i * 3} 10`} stroke={col} strokeWidth="3.2" />
        ))}
        <path d="M-22 10 A22 22 0 0 1 22 10" stroke={OUT} strokeWidth="1.2" />
        <g fill="#fff" stroke={OUT} strokeWidth="1.2">
          <path d="M-28 14 C-30 8 -24 4 -20 7 C-18 3 -11 4 -12 10 C-8 10 -8 15 -12 15 L-26 15 C-28 15 -29 14 -28 14Z" />
          <path d="M28 14 C30 8 24 4 20 7 C18 3 11 4 12 10 C8 10 8 15 12 15 L26 15 C28 15 29 14 28 14Z" />
        </g>
      </g>
    ),
  },
  flower: {
    draw: () => (
      <g>
        <Stick d="M0 22 C0 12 -2 6 0 -2" color={LEAF} w={2.4} />
        <ellipse cx="-7" cy="12" rx="6" ry="2.8" fill={LEAF} transform="rotate(-30 -7 12)" />
        <ellipse cx="7" cy="8" rx="6" ry="2.8" fill={LEAF} transform="rotate(30 7 8)" />
        {Array.from({ length: 6 }, (_, i) => (
          <ellipse key={i} cx="0" cy="-15" rx="5" ry="8" fill="#FF8FB7" transform={`rotate(${i * 60} 0 -8)`} />
        ))}
        <circle cx="0" cy="-8" r="5" fill="#FFD43B" />
      </g>
    ),
  },
  baby: {
    draw: (c) => (
      <g>
        <circle cx="0" cy="-6" r="22" fill="#FFF3B0" opacity=".55" stroke="none" />
        <ellipse cx="0" cy="4" rx="13" ry="18" fill="#F7F1E3" transform="rotate(-12)" />
        <path d="M-12 8 C-4 2 6 2 12 -2 M-10 16 C-2 10 6 10 10 6" fill="none" stroke="#C9BFA8" strokeWidth="1.3" />
        <circle cx="-2" cy="-8" r="8" fill={c.skin} />
        <path d="M-6 -8 Q-4.5 -6.5 -3 -8 M0 -8 Q1.5 -6.5 3 -8" fill="none" strokeWidth="1.1" />
        <circle cx="-6" cy="-5" r="1.6" fill="#FF8A8A" opacity=".6" stroke="none" />
        <path d="M-10 -10 C-10 -18 6 -18 6 -10 C2 -14 -6 -14 -10 -10Z" fill="#F7F1E3" />
      </g>
    ),
  },
  camel: {
    draw: () => (
      <g>
        <path d="M-14 6 L-15 20 M-8 6 L-8 20 M6 6 L7 20 M11 6 L12 20" stroke="#B9874A" strokeWidth="3" strokeLinecap="round" />
        <path d="M-20 4 C-22 -4 -16 -6 -14 -6 C-12 -18 -2 -18 0 -8 C2 -16 10 -16 10 -6 C12 -6 13 -10 14 -16 C15 -20 22 -22 24 -18 C25 -16 24 -14 21 -14 C19 -6 18 4 12 8 L-16 8 C-18 8 -20 6 -20 4Z" fill="#D9A866" />
        <circle cx="20" cy="-18" r="1.1" fill={OUT} stroke="none" />
        <path d="M-20 0 C-24 2 -24 6 -22 8" fill="none" strokeWidth="1.4" />
        <path d="M-12 -4 L8 -4" stroke="#C0392B" strokeWidth="2" />
      </g>
    ),
  },
  ram: {
    draw: () => (
      <g>
        <path d="M-10 10 L-10 18 M-3 11 L-3 18 M5 11 L5 18 M11 10 L11 18" stroke="#4A3A32" strokeWidth="2.6" strokeLinecap="round" />
        {[[-12, 2], [-6, -4], [2, -5], [9, -1], [10, 6], [2, 9], [-7, 9], [-14, 6]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="6.5" fill="#E9E1D3" />
        ))}
        <ellipse cx="-1" cy="2" rx="12" ry="8" fill="#E9E1D3" stroke="none" />
        <ellipse cx="16" cy="-4" rx="5.5" ry="7.5" fill="#6B5446" />
        <circle cx="17.5" cy="-5" r="1.2" fill="#fff" stroke="none" />
        <path d="M13 -9 C6 -14 6 -2 11 -3 C14 -4 12 -8 10 -7" fill="none" stroke={OUT} strokeWidth="4.6" strokeLinecap="round" />
        <path d="M13 -9 C6 -14 6 -2 11 -3 C14 -4 12 -8 10 -7" fill="none" stroke="#D9B98A" strokeWidth="2.8" strokeLinecap="round" />
      </g>
    ),
  },
  water: {
    draw: () => (
      <g>
        <path d="M0 -24 C8 -12 13 -6 13 2 C13 10 7 14 0 14 C-7 14 -13 10 -13 2 C-13 -6 -8 -12 0 -24Z" fill="#5AB0F0" />
        <path d="M-6 -2 C-7 2 -6 6 -3 8" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <path d="M-24 14 Q-18 10 -12 14 T0 14 T12 14 T24 14 M-24 20 Q-18 16 -12 20 T0 20 T12 20 T24 20" fill="none" stroke="#2F7FCC" strokeWidth="2.4" />
      </g>
    ),
  },
  stone: {
    draw: () => (
      <g>
        <path d="M-20 16 C-22 6 -14 0 -6 2 C-2 8 -2 16 -6 18 L-18 18Z" fill="#A7A399" />
        <path d="M-6 18 C-8 4 2 -4 12 0 C20 4 20 14 16 18Z" fill={STONE} />
        <path d="M-12 4 C-12 -8 -2 -14 6 -10 C10 -6 8 2 2 4Z" fill="#CBC6BC" />
        <circle cx="-4" cy="-6" r="2" fill="#fff" opacity=".6" stroke="none" />
      </g>
    ),
  },
  rope: {
    draw: () => (
      <g fill="none">
        <ellipse cx="0" cy="2" rx="17" ry="14" stroke={OUT} strokeWidth="6.4" />
        <ellipse cx="0" cy="2" rx="17" ry="14" stroke="#C9A06A" strokeWidth="4" strokeDasharray="2.5 1.5" />
        <ellipse cx="0" cy="2" rx="10" ry="8" stroke={OUT} strokeWidth="6.4" />
        <ellipse cx="0" cy="2" rx="10" ry="8" stroke="#D8B27E" strokeWidth="4" strokeDasharray="2.5 1.5" />
        <path d="M14 10 C20 16 22 20 18 24" stroke={OUT} strokeWidth="6" strokeLinecap="round" />
        <path d="M14 10 C20 16 22 20 18 24" stroke="#C9A06A" strokeWidth="3.6" strokeLinecap="round" />
      </g>
    ),
  },
  crown_thorns: {
    draw: () => (
      <g fill="none" strokeLinecap="round">
        {Array.from({ length: 14 }, (_, i) => {
          const a = (i / 14) * Math.PI * 2;
          const x = Math.cos(a) * 17;
          const y = Math.sin(a) * 9;
          const dx = Math.cos(a + 0.6) * 6;
          const dy = Math.sin(a + 0.6) * 5;
          return <path key={i} d={`M${x.toFixed(1)} ${y.toFixed(1)} l${dx.toFixed(1)} ${dy.toFixed(1)}`} stroke="#6E4723" strokeWidth="1.6" />;
        })}
        <ellipse cx="0" cy="0" rx="17" ry="9" stroke={OUT} strokeWidth="6" />
        <ellipse cx="0" cy="0" rx="17" ry="9" stroke="#8A5A2E" strokeWidth="3.6" />
        <ellipse cx="0" cy="0" rx="17" ry="9" stroke="#B07A45" strokeWidth="1.4" strokeDasharray="4 4" />
      </g>
    ),
  },
  apple: {
    draw: () => (
      <g>
        <path d="M0 -10 C8 -16 18 -10 16 2 C14 14 6 18 0 15 C-6 18 -14 14 -16 2 C-18 -10 -8 -16 0 -10Z" fill="#E63946" />
        <path d="M0 -10 C0 -14 1 -18 3 -20" fill="none" stroke={WOOD_D} strokeWidth="2" />
        <path d="M3 -16 C8 -22 14 -20 14 -16 C10 -14 6 -14 3 -16Z" fill={LEAF} />
        <path d="M-9 -4 C-10 0 -9 4 -7 6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".8" />
      </g>
    ),
  },
  sun: {
    draw: () => (
      <g>
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d="M-3 -14 L0 -22 L3 -14Z" fill="#FFA62B" transform={`rotate(${i * 30})`} />
        ))}
        <circle cx="0" cy="0" r="13" fill="#FFD43B" />
        <circle cx="-4" cy="-4" r="4" fill="#FFF3A6" stroke="none" />
      </g>
    ),
  },
  tower: {
    draw: () => (
      <g>
        <rect x="-18" y="10" width="36" height="9" fill="#D9B27C" />
        <rect x="-14" y="1" width="28" height="9" fill="#E3BF8A" />
        <rect x="-10" y="-8" width="20" height="9" fill="#D9B27C" />
        <rect x="-6" y="-17" width="12" height="9" fill="#E3BF8A" />
        <rect x="-3" y="-24" width="6" height="7" fill="#D9B27C" />
        <path d="M-3 19 L-3 13 C-3 11 3 11 3 13 L3 19Z" fill="#6E4723" />
        <path d="M-14 6 L-8 1 M8 -3 L4 -8" stroke="#A47C45" strokeWidth="1.2" />
      </g>
    ),
  },
  wall: {
    draw: () => (
      <g>
        <path d="M-21 18 L-21 -12 L-15 -12 L-15 -16 L-9 -16 L-9 -12 L-3 -12 L-3 -16 L3 -16 L3 -12 L9 -12 L9 -16 L15 -16 L15 -12 L21 -12 L21 18Z" fill="#D2B48C" />
        <g stroke="#9C7E58" strokeWidth="1.1">
          {[-5, 2, 9].map((y) => <path key={y} d={`M-21 ${y} L21 ${y}`} />)}
          {[[-12, -12, -5], [4, -12, -5], [-4, -5, 2], [12, -5, 2], [-12, 2, 9], [4, 2, 9], [-4, 9, 18], [12, 9, 18]].map(([x, a, b], i) => <path key={i} d={`M${x} ${a} L${x} ${b}`} />)}
        </g>
      </g>
    ),
  },
  chariot: {
    draw: () => (
      <g>
        <path d="M-18 -4 C-22 -14 -14 -20 -12 -26 C-8 -18 -2 -20 0 -28 C4 -18 12 -16 10 -4Z" fill="#F77F28" />
        <path d="M-12 -4 C-14 -10 -10 -14 -8 -18 C-6 -12 -2 -14 0 -18 C2 -12 6 -10 4 -4Z" fill="#FFD43B" stroke="none" />
        <path d="M10 2 L24 -4" stroke={WOOD_D} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M-18 -6 L10 -6 L14 6 L-18 6Z" fill="#C0392B" />
        <path d="M-18 -2 L12 -2" stroke={GOLD} strokeWidth="2" />
        <circle cx="-4" cy="10" r="10" fill="#F2D49B" />
        <circle cx="-4" cy="10" r="10" fill="none" stroke={WOOD_D} strokeWidth="2.6" />
        {[0, 45, 90, 135].map((a) => <path key={a} d="M-13 10 L5 10" stroke={WOOD_D} strokeWidth="1.4" transform={`rotate(${a} -4 10)`} />)}
        <circle cx="-4" cy="10" r="2.4" fill={GOLD} />
      </g>
    ),
  },
  sandals: {
    draw: () => (
      <g>
        {[[-8, 2, -12], [8, -2, 10]].map(([x, y, r], i) => (
          <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
            <path d="M0 -17 C7 -17 8 -6 6 2 C5 10 6 17 0 17 C-6 17 -5 10 -6 2 C-8 -6 -7 -17 0 -17Z" fill="#C98E52" />
            <path d="M-6 -4 L6 -8 M-6 4 L6 0 M0 -16 L0 -8" stroke="#6E4723" strokeWidth="2.4" strokeLinecap="round" />
          </g>
        ))}
      </g>
    ),
  },
};

/* ---------- cabelo ---------- */
const CAP = {
  short: 'M29 63 C26 38 41 29 60 29 C79 29 94 38 91 63 C89 55 86 50 82 47 C78 51 70 52 64 48 C58 52 50 52 44 48 C39 51 33 55 29 63Z',
  long: 'M29 68 C25 40 40 29 60 29 C80 29 95 40 91 68 C89 56 83 47 74 43 C70 47 64 47 60 42 C56 47 50 47 46 43 C37 47 31 56 29 68Z',
  braid: 'M29 66 C25 40 40 29 60 29 C80 29 95 40 91 66 C88 54 80 45 60 44 C40 45 32 54 29 66Z',
};
const BACK = {
  long: 'M31 48 C20 70 21 100 25 114 C33 119 44 117 48 110 L72 110 C76 117 87 119 95 114 C99 100 100 70 89 48Z',
  bob: 'M31 48 C22 64 22 82 27 90 C35 92 42 90 45 86 L75 86 C78 90 85 92 93 90 C98 82 98 64 89 48Z',
};

function curlCircles(cx, cy, R, from, to, n, r) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = ((from + ((to - from) * i) / (n - 1)) * Math.PI) / 180;
    out.push([cx + R * Math.cos(a), cy + R * Math.sin(a), r]);
  }
  return out;
}

/* ---------- o retrato ---------- */
export function StickerArt({ look, size = 120 }) {
  const raw = useId();
  const uid = 'stk' + raw.replace(/[^a-zA-Z0-9_-]/g, '');
  const L = { ...DEFAULT_LOOK, ...(look || {}) };
  const female = L.gender === 'f';
  const child = L.age === 'child';
  const old = L.age === 'old';

  const [skin, skinD] = SKINS[L.skin] || SKINS.tan;
  let hair = HAIRS[L.hair] || HAIRS.brown;
  if (old && L.hair !== 'white' && L.hair !== 'gray') hair = HAIRS.gray;
  const hairD = shade(hair, luminance(hair) > 0.7 ? -0.22 : -0.32);
  const beardCol = old ? (L.hair === 'gray' ? HAIRS.gray : HAIRS.white) : hair;
  const robe = L.robe || DEFAULT_LOOK.robe;
  const robe2 = L.robe2 || DEFAULT_LOOK.robe2;
  const bg = L.bg || DEFAULT_LOOK.bg;

  let head = L.head || 'none';
  let style = L.hairStyle || 'short';
  if (style === 'covered' && (head === 'none' || head === 'crown' || head === 'headband' || head === 'wreath')) {
    head = female ? 'veil' : 'turban';
  }
  const hidesHair = head === 'veil' || head === 'turban' || head === 'helmet';
  if (style === 'covered') style = female ? 'long' : 'short';
  const beard = female || child ? 'none' : L.beard || 'none';
  const item = ITEMS[L.item] ? L.item : null;
  const darkSkin = L.skin === 'brown' || L.skin === 'dark';

  const veilCol = robe2;
  const veilD = shade(veilCol, -0.18);

  /* proporções */
  const bodyT = child ? 'translate(60 150) scale(.8 .78) translate(-60 -150)' : undefined;
  const headT = child ? 'translate(60 64) scale(.95) translate(-60 -52)' : undefined;
  const eyeR = child ? 4.3 : female ? 3.9 : 3.6;
  const eyeY = 66;
  const faceRx = female ? 28.5 : 29;
  const faceRy = child ? 28.5 : 28;
  const cheek = darkSkin ? '#E0606A' : '#FF8A8A';

  /* ----- fundo ----- */
  const rays = Array.from({ length: 16 }, (_, i) => (
    <path key={i} d="M60 60 L52 -60 L68 -60Z" transform={`rotate(${i * 22.5} 60 60)`} />
  ));

  /* ----- partes ----- */
  const backHair = (() => {
    if (head === 'veil' || head === 'turban') return null;
    if (style === 'long') return <path d={BACK.long} fill={hair} />;
    if (style === 'braid') return <path d={BACK.bob} fill={hair} />;
    if (style === 'curly' && (female || child)) {
      const cs = [...curlCircles(60, 60, 33, 160, 200, 3, 9), ...curlCircles(60, 60, 33, -20, 20, 3, 9), [30, 86, 9], [90, 86, 9], [33, 98, 8], [87, 98, 8]];
      return <g fill={hair}>{cs.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} />)}</g>;
    }
    if (style === 'short' && female) return <path d={BACK.bob} fill={hair} />;
    return null;
  })();

  const frontHair = (() => {
    if (hidesHair) return null;
    if (style === 'bald') {
      return (
        <g>
          <ellipse cx="49" cy="42" rx="8" ry="4.5" fill="#fff" opacity=".35" stroke="none" transform="rotate(-25 49 42)" />
          {(old || !female) && (
            <g fill={hair}>
              <path d="M29 58 C25 62 26 72 31 74 C31 68 33 63 36 60Z" />
              <path d="M91 58 C95 62 94 72 89 74 C89 68 87 63 84 60Z" />
            </g>
          )}
        </g>
      );
    }
    if (style === 'curly') {
      const cs = curlCircles(60, 60, 28, 185, 355, 9, 8.5);
      return (
        <g>
          <g fill={hair}>{cs.map(([x, y, r], i) => <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={r} />)}</g>
          <path d="M34 54 C36 38 48 31 60 31 C72 31 84 38 86 54 C76 46 44 46 34 54Z" fill={hair} stroke="none" />
          <g fill="none" stroke={hairD} strokeWidth="1.2" strokeLinecap="round">
            <path d="M44 40 c2 -3 5 -3 6 0" /><path d="M58 36 c2 -3 5 -3 6 0" /><path d="M72 40 c2 -3 5 -3 6 0" />
          </g>
        </g>
      );
    }
    const d = CAP[style] || CAP.short;
    return (
      <g>
        <path d={d} fill={hair} />
        {style === 'braid' ? (
          <path d="M60 30 L60 44" stroke={hairD} strokeWidth="1.3" fill="none" />
        ) : (
          <path d="M44 36 C50 33 56 33 60 34" stroke={shade(hair, 0.3)} strokeWidth="2.4" strokeLinecap="round" fill="none" opacity=".7" />
        )}
      </g>
    );
  })();

  const braid = style === 'braid' && !hidesHair ? (
    <g fill={hair}>
      {[0, 1, 2, 3, 4].map((i) => <ellipse key={i} cx={33 - i * 0.6} cy={80 + i * 8} rx={5.6 - i * 0.3} ry="5" />)}
      <path d="M28 119 L34 119 L36 127 L26 127Z" fill={hair} />
      <rect x="27" y="116" width="8" height="3.6" rx="1.4" fill={robe2} />
    </g>
  ) : null;

  const eyes = (
    <g>
      {[49, 71].map((x, i) => (
        <g key={x}>
          <ellipse cx={x} cy={eyeY} rx={eyeR} ry={eyeR * 1.12} fill="#2B1D16" stroke="none" />
          <circle cx={x - eyeR * 0.32} cy={eyeY - eyeR * 0.4} r={eyeR * 0.36} fill="#fff" stroke="none" />
          <circle cx={x + eyeR * 0.35} cy={eyeY + eyeR * 0.35} r={eyeR * 0.15} fill="#fff" stroke="none" />
          {female && (
            <path
              d={i === 0 ? `M${x - eyeR} ${eyeY - eyeR * 0.6} l-2.6 -1.6 M${x - eyeR * 0.6} ${eyeY - eyeR} l-1.6 -2.4` : `M${x + eyeR} ${eyeY - eyeR * 0.6} l2.6 -1.6 M${x + eyeR * 0.6} ${eyeY - eyeR} l1.6 -2.4`}
              stroke="#2B1D16" strokeWidth="1.2" strokeLinecap="round" fill="none"
            />
          )}
        </g>
      ))}
    </g>
  );

  const browCol = old ? shade(beardCol, -0.12) : hairD;
  const brows = (
    <g fill="none" stroke={browCol} strokeLinecap="round" strokeWidth={female ? 1.5 : old ? 3 : 2.3}>
      <path d={`M44 ${eyeY - 9} Q49 ${eyeY - 12} 54 ${eyeY - 9.5}`} />
      <path d={`M66 ${eyeY - 9.5} Q71 ${eyeY - 12} 76 ${eyeY - 9}`} />
    </g>
  );

  const wrinkles = old ? (
    <g fill="none" stroke={skinD} strokeWidth="1.1" strokeLinecap="round">
      <path d="M39.5 63 l-3 -1.5 M39.5 66.5 l-3.4 .4 M80.5 63 l3 -1.5 M80.5 66.5 l3.4 .4" />
      <path d="M45 72 Q49 74 53 72 M67 72 Q71 74 75 72" />
      {beard === 'none' && <path d="M48 76 Q46 80 49 83 M72 76 Q74 80 71 83" />}
      {(style === 'bald' && !hidesHair) && <path d="M51 47 Q60 44 69 47 M53 51 Q60 49 67 51" />}
    </g>
  ) : null;

  const mouthY = beard === 'none' ? 77 : 82;
  const mouth = (
    <g>
      <path d={`M53 ${mouthY} Q60 ${mouthY + 9} 67 ${mouthY} Q60 ${mouthY + 2.5} 53 ${mouthY}Z`} fill="#8E2B2B" stroke="#5A1A16" strokeWidth="1" strokeLinejoin="round" />
      <path d={`M56.5 ${mouthY + 4.6} Q60 ${mouthY + 2.6} 63.5 ${mouthY + 4.6} Q60 ${mouthY + 7.2} 56.5 ${mouthY + 4.6}Z`} fill="#F07A7A" />
    </g>
  );

  const beardEl = (() => {
    if (beard === 'none') return null;
    const bd = shade(beardCol, luminance(beardCol) > 0.7 ? -0.2 : -0.3);
    const jaw = beard === 'long'
      ? 'M31 60 C29 86 40 112 60 124 C80 112 91 86 89 60 C86 72 82 79 74 80 C68 76 52 76 46 80 C38 79 34 72 31 60Z'
      : 'M31 60 C30 84 42 98 60 99 C78 98 90 84 89 60 C86 72 82 79 74 80 C68 76 52 76 46 80 C38 79 34 72 31 60Z';
    return (
      <g>
        <path d={jaw} fill={beardCol} stroke={OUT} strokeOpacity=".45" strokeWidth="1.2" strokeLinejoin="round" />
        <g fill="none" stroke={bd} strokeWidth="1.2" strokeLinecap="round">
          {beard === 'long'
            ? <path d="M50 92 Q52 102 56 110 M60 94 L60 116 M70 92 Q68 102 64 110 M42 86 Q44 94 48 100 M78 86 Q76 94 72 100" />
            : <path d="M46 88 Q50 93 54 94 M74 88 Q70 93 66 94 M60 92 L60 96" />}
        </g>
        <path d="M46 81 C50 75 57 76 60 79 C63 76 70 75 74 81 C68 84 63 82 60 81 C57 82 52 84 46 81Z" fill={beardCol} stroke={OUT} strokeOpacity=".45" strokeWidth="1.1" strokeLinejoin="round" />
      </g>
    );
  })();

  /* corpo / roupa */
  const robePath = 'M8 152 C10 121 30 103 60 103 C90 103 110 121 112 152Z';
  const coat = L.item === 'coat';
  const coatStripes = ['#E63946', '#F4A261', '#FFD43B', '#52B788', '#4D96FF', '#9B5DE5'];
  const body = (
    <g transform={bodyT}>
      <clipPath id={`${uid}-robe`}><path d={robePath} /></clipPath>
      <path d={robePath} fill={robe} />
      <g clipPath={`url(#${uid}-robe)`}>
        {coat && coatStripes.concat(coatStripes).map((col, i) => (
          <rect key={i} x={6 + i * 9.4} y="100" width="9.4" height="60" fill={col} transform="rotate(8 60 125)" />
        ))}
        <path d="M8 152 C12 128 26 112 44 106 C34 118 30 134 32 152Z" fill="#fff" opacity=".14" />
        <path d="M112 152 C110 128 98 112 80 106 C90 120 92 136 90 152Z" fill="#000" opacity=".12" />
        {female ? (
          <g fill={robe2} stroke={OUT} strokeOpacity=".4" strokeWidth="1.2">
            <path d="M6 152 C8 124 24 106 44 103 C36 116 34 134 38 152Z" />
            <path d="M114 152 C112 124 96 106 76 103 C84 116 86 134 82 152Z" />
          </g>
        ) : (
          <path d="M26 112 C32 106 38 104 42 104 L96 152 L76 152Z" fill={robe2} stroke={OUT} strokeOpacity=".4" strokeWidth="1.2" />
        )}
        {!female && <path d="M38 152 L40 134 M84 152 L82 136" stroke="#000" strokeOpacity=".14" strokeWidth="1.6" fill="none" />}
      </g>
      <path d={robePath} fill="none" stroke={OUT} strokeWidth="1.4" strokeOpacity=".6" />
      {/* pescoço + gola */}
      <path d="M52 86 L68 86 L68 104 L52 104Z" fill={skin} />
      <path d="M52 92 C56 96 64 96 68 92 L68 98 C64 100 56 100 52 98Z" fill={skinD} opacity=".6" />
      <path d="M50 103 L60 117 L70 103Z" fill={skin} stroke={OUT} strokeOpacity=".5" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M48 102 L60 119 L72 102" fill="none" stroke={female ? shade(robe2, -0.15) : robe2} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
    </g>
  );

  /* véu (parte de trás) */
  const veilBack = head === 'veil' ? (
    <g>
      <path d="M23 68 C20 34 40 20 60 20 C80 20 100 34 97 68 C99 96 106 122 110 152 L84 152 C82 128 80 112 72 104 L48 104 C40 112 38 128 36 152 L10 152 C14 122 21 96 23 68Z" fill={veilCol} stroke={OUT} strokeOpacity=".5" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M28 90 C30 110 30 128 26 150 M92 90 C90 110 90 128 94 150" fill="none" stroke={veilD} strokeWidth="1.4" />
    </g>
  ) : null;

  const headwear = (() => {
    switch (head) {
      case 'veil':
        return (
          <g>
            {style !== 'bald' && <path d="M35 56 C38 46 48 42 60 43 C72 42 82 46 85 56 C77 50 68 49 60 51 C52 49 43 50 35 56Z" fill={hair} />}
            <path d="M26 68 C24 38 42 25 60 25 C78 25 96 38 94 68 C90 52 79 41 60 41 C41 41 30 52 26 68Z" fill={veilCol} stroke={OUT} strokeOpacity=".5" strokeWidth="1.3" strokeLinejoin="round" />
            <path d="M29 62 C30 48 42 38 60 38 C78 38 90 48 91 62" fill="none" stroke={veilD} strokeWidth="2" />
          </g>
        );
      case 'turban': {
        const t = robe2;
        const tD = shade(t, -0.2);
        return (
          <g>
            <path d="M25 56 C20 30 40 16 60 16 C80 16 100 30 95 56 C87 47 75 44 60 44 C45 44 33 47 25 56Z" fill={t} stroke={OUT} strokeOpacity=".55" strokeWidth="1.3" strokeLinejoin="round" />
            <g fill="none" stroke={tD} strokeWidth="1.8" strokeLinecap="round">
              <path d="M28 44 C40 32 70 26 92 40" />
              <path d="M30 32 C46 38 72 38 90 30" />
              <path d="M40 22 C50 28 70 28 82 22" />
            </g>
            <circle cx="60" cy="39" r="4.2" fill={GOLD} stroke={OUT} strokeOpacity=".55" strokeWidth="1" />
            <circle cx="60" cy="39" r="2" fill="#E63946" />
          </g>
        );
      }
      case 'helmet':
        return (
          <g>
            <path d="M42 22 C46 0 76 0 80 22 C74 14 48 14 42 22Z" fill="#D63A3A" stroke={OUT} strokeOpacity=".55" strokeWidth="1.2" />
            <path d="M48 12 L50 18 M56 8 L56 15 M64 8 L64 15 M72 12 L70 18" stroke="#9E2323" strokeWidth="1.3" />
            <path d="M26 56 C24 30 42 18 60 18 C78 18 96 30 94 56Z" fill="#C98B3C" stroke={OUT} strokeOpacity=".6" strokeWidth="1.3" />
            <path d="M24 52 L96 52 L96 59 C80 55 40 55 24 59Z" fill="#A86F28" stroke={OUT} strokeOpacity=".6" strokeWidth="1.2" />
            <path d="M25 56 L33 56 L34 76 C29 75 26 68 25 56Z M95 56 L87 56 L86 76 C91 75 94 68 95 56Z" fill="#A86F28" stroke={OUT} strokeOpacity=".6" strokeWidth="1.2" />
            <path d="M40 30 C44 24 50 22 54 22" stroke="#F3D28C" strokeWidth="3" strokeLinecap="round" fill="none" />
          </g>
        );
      case 'crown':
        return (
          <g stroke={OUT} strokeOpacity=".6" strokeWidth="1.2" strokeLinejoin="round">
            <path d="M39 44 L36 24 L47 33 L53 18 L60 29 L67 18 L73 33 L84 24 L81 44Z" fill={GOLD} />
            <path d="M39 39 L81 39 L81 45 L39 45Z" fill={GOLD_D} />
            <circle cx="53" cy="17.5" r="2.2" fill="#fff" /><circle cx="67" cy="17.5" r="2.2" fill="#fff" />
            <circle cx="36" cy="23" r="2" fill="#fff" /><circle cx="84" cy="23" r="2" fill="#fff" />
            <circle cx="60" cy="35" r="3" fill="#E63946" />
            <circle cx="48" cy="37" r="2" fill="#2E86DE" /><circle cx="72" cy="37" r="2" fill="#2BB673" />
          </g>
        );
      case 'headband':
        return (
          <g stroke={OUT} strokeOpacity=".55" strokeWidth="1.1" strokeLinejoin="round">
            <path d="M88 52 L97 62 L93 64 Z M88 52 L99 56 L97 59Z" fill={shade(robe2, -0.15)} />
            <path d="M30 54 C40 44 80 44 90 54 L90 49 C80 39 40 39 30 49Z" fill={robe2} />
          </g>
        );
      case 'wreath': {
        const leaves = [];
        for (let i = 0; i <= 10; i++) {
          const t = Math.PI + (i / 10) * Math.PI;
          const x = 60 + 30 * Math.cos(t);
          const y = 54 + 16 * Math.sin(t);
          const ang = (t * 180) / Math.PI + 90;
          leaves.push(
            <ellipse key={'a' + i} cx={x.toFixed(1)} cy={(y - 2.5).toFixed(1)} rx="2.6" ry="5.2" fill={i % 2 ? LEAF : '#7DBB4E'} transform={`rotate(${(ang - 35).toFixed(0)} ${x.toFixed(1)} ${(y - 2.5).toFixed(1)})`} />,
            <ellipse key={'b' + i} cx={x.toFixed(1)} cy={(y + 2).toFixed(1)} rx="2.6" ry="5.2" fill={i % 2 ? '#7DBB4E' : LEAF} transform={`rotate(${(ang + 35).toFixed(0)} ${x.toFixed(1)} ${(y + 2).toFixed(1)})`} />,
          );
        }
        return <g stroke={OUT} strokeOpacity=".5" strokeWidth=".9">{leaves}</g>;
      }
      default:
        return null;
    }
  })();

  /* item */
  let itemEl = null;
  const def = item ? ITEMS[item] : null;
  if (def && item !== 'coat') {
    const ctx = { uid, robe, robe2, skin };
    const [ix, iy] = [92, 123];
    const hx = ix + (def.hand ? def.hand[0] : 0);
    const hy = iy + (def.hand ? def.hand[1] : 0);
    const arm = def.hand ? `M${child ? 82 : 84} 146 C${child ? 84 : 88} 134 ${hx - 8} ${hy + 8} ${hx} ${hy}` : null;
    itemEl = (
      <g>
        {arm && (
          <g fill="none" strokeLinecap="round">
            <path d={arm} stroke={OUT} strokeOpacity=".6" strokeWidth="11.4" />
            <path d={arm} stroke={robe} strokeWidth="9" />
          </g>
        )}
        <g filter={`url(#${uid}-cut)`}>
          <g transform={`translate(${ix} ${iy})`} stroke={OUT} strokeWidth="1.3" strokeLinejoin="round">
            {def.draw(ctx)}
          </g>
        </g>
        {def.hand && <circle cx={hx} cy={hy} r="4.8" fill={skin} stroke={OUT} strokeOpacity=".7" strokeWidth="1.2" />}
      </g>
    );
  }

  return (
    <svg
      className="stk-svg"
      viewBox="0 0 120 150"
      width={size}
      height={size * 1.25}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={`${uid}-light`} cx="50%" cy="38%" r="70%">
          <stop offset="0" stopColor="#fff" stopOpacity=".75" />
          <stop offset=".55" stopColor="#fff" stopOpacity=".12" />
          <stop offset="1" stopColor="#000" stopOpacity=".12" />
        </radialGradient>
        <radialGradient id={`${uid}-face`} cx="40%" cy="35%" r="75%">
          <stop offset="0" stopColor={shade(skin, 0.12)} />
          <stop offset=".7" stopColor={skin} />
          <stop offset="1" stopColor={skinD} />
        </radialGradient>
        <pattern id={`${uid}-dots`} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <circle cx="3" cy="3" r="1.3" fill="#fff" />
          <path d="M9 7.5 L9.6 9 L11 9.4 L9.6 9.9 L9 11.4 L8.4 9.9 L7 9.4 L8.4 9Z" fill="#fff" />
        </pattern>
        <filter id={`${uid}-cut`} x="-30%" y="-30%" width="160%" height="160%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="1.8" result="d" />
          <feOffset in="d" dy="1.4" result="o" />
          <feGaussianBlur in="o" stdDeviation="1" result="ob" />
          <feFlood floodColor="#000" floodOpacity=".22" />
          <feComposite in2="ob" operator="in" result="sh" />
          <feFlood floodColor="#fff" />
          <feComposite in2="d" operator="in" result="w" />
          <feMerge>
            <feMergeNode in="sh" />
            <feMergeNode in="w" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width="120" height="150" fill={bg} />
      <g fill="#fff" opacity=".22">{rays}</g>
      <rect width="120" height="150" fill={`url(#${uid}-dots)`} opacity=".22" />
      <rect width="120" height="150" fill={`url(#${uid}-light)`} />

      <g transform={headT}>{backHair}</g>
      {body}
      {veilBack && <g transform={headT}>{veilBack}</g>}
      <g transform={headT}>
        {/* orelhas */}
        {head !== 'veil' && (
          <g fill={skin} stroke={OUT} strokeOpacity=".5" strokeWidth="1.2">
            <circle cx={60 - faceRx - 1} cy="67" r="5.5" />
            <circle cx={60 + faceRx + 1} cy="67" r="5.5" />
          </g>
        )}
        <ellipse cx="60" cy="62" rx={faceRx} ry={faceRy} fill={`url(#${uid}-face)`} stroke={OUT} strokeOpacity=".5" strokeWidth="1.3" />
        {frontHair}
        <ellipse cx="44" cy="74" rx={female ? 5.4 : 4.8} ry="3.2" fill={cheek} opacity={darkSkin ? 0.45 : 0.5} />
        <ellipse cx="76" cy="74" rx={female ? 5.4 : 4.8} ry="3.2" fill={cheek} opacity={darkSkin ? 0.45 : 0.5} />
        {brows}
        {eyes}
        <path d="M58 71.5 Q60 73.5 62 71.5" fill="none" stroke={skinD} strokeWidth="1.4" strokeLinecap="round" />
        {wrinkles}
        {beardEl}
        {mouth}
        {headwear}
        {braid}
      </g>
      {itemEl}
    </svg>
  );
}

/* ---------- a figurinha ---------- */
function CardBack() {
  return (
    <div className="stk-back-inner">
      <svg viewBox="0 0 60 60" className="stk-back-emblem" aria-hidden="true" focusable="false">
        <circle cx="30" cy="30" r="27" fill="#0E2A6B" stroke="#F9C71D" strokeWidth="3" />
        <circle cx="30" cy="30" r="21" fill="none" stroke="#F9C71D" strokeWidth="1" strokeDasharray="2 2.5" />
        <path d={starPath(30, 30, 15, 6.2)} fill="#F9C71D" />
        <path d={starPath(30, 30, 6, 2.6, 4, 0)} fill="#fff" opacity=".9" />
      </svg>
      <span className="stk-back-title">Álbum Bíblico</span>
    </div>
  );
}

export function StickerCard({ sticker, size = 110, state = 'owned', onClick, badge }) {
  const s = sticker || {};
  const rarity = ['comum', 'rara', 'lendaria'].includes(s.rarity) ? s.rarity : 'comum';
  const num = s.id != null ? `#${s.id}` : '';
  const style = { width: size, height: Math.round(size * 1.36), '--stk-size': `${size}px` };
  const Tag = onClick ? 'button' : 'div';
  const badgeText = badge != null && badge !== '' ? String(badge) : '';
  const badgeKind = /nova|novo|new/i.test(badgeText) ? 'new' : /repet/i.test(badgeText) || /^x\d+/i.test(badgeText) ? 'dup' : 'info';
  const cls = ['stk-card', `stk-state-${state}`, state === 'owned' ? `stk-r-${rarity}` : '', onClick ? 'is-clickable' : ''].filter(Boolean).join(' ');
  const label = state === 'back' ? 'Figurinha virada' : `${num} ${s.name || ''}${state === 'empty' ? ' (faltando)' : ''}`.trim();

  return (
    <Tag
      className={cls}
      style={style}
      {...(onClick ? { type: 'button', onClick, 'aria-label': label + (badgeText ? ` — ${badgeText}` : '') } : { role: 'img', 'aria-label': label })}
    >
      {state === 'back' ? (
        <CardBack />
      ) : state === 'empty' ? (
        <div className="stk-empty">
          <span className="stk-empty-num">{s.id ?? '?'}</span>
          <span className="stk-empty-name">{s.name}</span>
        </div>
      ) : (
        <div className="stk-frame">
          <div className="stk-art">
            <StickerArt look={s.look} size={size} />
          </div>
          <div className="stk-ribbon"><span>{s.name}</span></div>
          {num && <span className="stk-num">{num}</span>}
          {rarity === 'lendaria' && <span className="stk-shine" aria-hidden="true" />}
        </div>
      )}
      {badgeText && <span className={`stk-badge stk-badge-${badgeKind}`}>{badgeText}</span>}
    </Tag>
  );
}
