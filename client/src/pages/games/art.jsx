// Desenhos dos mini jogos (SVG feito à mão, sem emoji): ilustrações bíblicas, peças de xadrez,
// naipes e pequenos ícones de placar.

const S = ({ children, size = '1em', vb = '0 0 64 64', title, className }) => (
  <svg viewBox={vb} width={size} height={size} className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
    {children}
  </svg>
);

// ───────────── Ilustrações bíblicas (Jogo da memória) ─────────────

export const BIBLE_ART = {
  arca: { name: 'Arca de Noé', draw: (
    <>
      <path d="M6 40h52l-7 13H13z" fill="#8B5A2B" />
      <path d="M6 40h52l-2 4H8z" fill="#6E4420" />
      <rect x="16" y="26" width="32" height="14" rx="2" fill="#A0693A" />
      <path d="M13 27l19-11 19 11z" fill="#6E4420" />
      <rect x="24" y="30" width="6" height="6" fill="#3B2412" />
      <rect x="34" y="30" width="6" height="6" fill="#3B2412" />
      <path d="M2 55c6-3 10 3 16 0s10 3 16 0 10 3 16 0 10 3 14 0v7H2z" fill="#2E7BC4" />
    </>
  ) },
  pomba: { name: 'Pomba com o ramo', draw: (
    <>
      <path d="M14 36c4-10 16-14 26-10l10-6c-2 6-4 9-8 11 2 8-4 17-16 17-6 0-11-3-14-6l8-2z" fill="#F4F6FA" stroke="#9AA6BD" strokeWidth="1.5" />
      <path d="M22 30c6-10 14-14 22-14-4 6-10 10-16 14z" fill="#DDE3EE" stroke="#9AA6BD" strokeWidth="1.5" />
      <circle cx="43" cy="27" r="1.6" fill="#1F2937" />
      <path d="M49 23l6 1-6 2z" fill="#E7A33C" />
      <path d="M52 26c4 2 6 6 6 10" stroke="#3F7D2C" strokeWidth="2" fill="none" />
      <ellipse cx="57" cy="31" rx="3" ry="1.6" fill="#5FA03A" transform="rotate(50 57 31)" />
      <ellipse cx="55" cy="35" rx="3" ry="1.6" fill="#5FA03A" transform="rotate(-20 55 35)" />
    </>
  ) },
  tabuas: { name: 'Tábuas da Lei', draw: (
    <>
      <path d="M8 22a10 10 0 0 1 20 0v32H8z" fill="#B9B2A3" stroke="#7D7567" strokeWidth="2" />
      <path d="M36 22a10 10 0 0 1 20 0v32H36z" fill="#B9B2A3" stroke="#7D7567" strokeWidth="2" />
      {[24, 30, 36, 42, 48].map((y) => <g key={y}><path d={`M12 ${y}h12`} stroke="#5E574B" strokeWidth="2" /><path d={`M40 ${y}h12`} stroke="#5E574B" strokeWidth="2" /></g>)}
    </>
  ) },
  coroa: { name: 'Coroa do rei', draw: (
    <>
      <path d="M8 46l-2-26 14 12 12-18 12 18 14-12-2 26z" fill="#F2B705" stroke="#B07D00" strokeWidth="2" strokeLinejoin="round" />
      <rect x="8" y="46" width="48" height="8" rx="2" fill="#D99A00" />
      <circle cx="20" cy="50" r="2.5" fill="#C0262D" /><circle cx="32" cy="50" r="2.5" fill="#1D63C9" /><circle cx="44" cy="50" r="2.5" fill="#1F8A4C" />
    </>
  ) },
  harpa: { name: 'Harpa de Davi', draw: (
    <>
      <path d="M16 56V12c10 0 14 8 22 10s14 2 14 12c0 10-12 12-16 22z" fill="none" stroke="#A0693A" strokeWidth="5" strokeLinejoin="round" />
      {[22, 27, 32, 37, 42].map((x, i) => <path key={x} d={`M${x} ${15 + i * 2}V${54 - i * 1}`} stroke="#E8D9A8" strokeWidth="1.4" />)}
    </>
  ) },
  funda: { name: 'Funda e pedra de Davi', draw: (
    <>
      <path d="M10 10c6 16 10 26 18 32M54 10c-6 16-10 26-18 32" stroke="#7A4E25" strokeWidth="2.5" fill="none" />
      <path d="M24 40c4 6 12 6 16 0l-2 8c-4 3-8 3-12 0z" fill="#8B5A2B" />
      <ellipse cx="32" cy="42" rx="5" ry="4" fill="#8E8E8E" stroke="#5B5B5B" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="3" fill="#7A4E25" /><circle cx="54" cy="10" r="3" fill="#7A4E25" />
    </>
  ) },
  paes: { name: 'Pães e peixes', draw: (
    <>
      <ellipse cx="20" cy="22" rx="13" ry="9" fill="#D79A4E" stroke="#9C6426" strokeWidth="1.5" />
      <ellipse cx="44" cy="22" rx="13" ry="9" fill="#D79A4E" stroke="#9C6426" strokeWidth="1.5" />
      <path d="M12 20q8-4 16 0M36 20q8-4 16 0" stroke="#9C6426" strokeWidth="1.3" fill="none" />
      <path d="M10 46c8-10 26-10 34 0-8 10-26 10-34 0z" fill="#7FA7C9" stroke="#476E91" strokeWidth="1.5" />
      <path d="M44 46l10-7v14z" fill="#7FA7C9" stroke="#476E91" strokeWidth="1.5" />
      <circle cx="18" cy="45" r="1.6" fill="#1F2937" />
    </>
  ) },
  ovelha: { name: 'Ovelha', draw: (
    <>
      <g fill="#F7F5EF" stroke="#BDB6A6" strokeWidth="1.5">
        <circle cx="22" cy="30" r="9" /><circle cx="32" cy="26" r="10" /><circle cx="42" cy="30" r="9" /><circle cx="27" cy="38" r="9" /><circle cx="39" cy="38" r="9" />
      </g>
      <ellipse cx="50" cy="28" rx="6" ry="7" fill="#3A332B" />
      <circle cx="52" cy="27" r="1.2" fill="#fff" />
      <path d="M24 46v10M30 47v9M36 47v9M42 46v10" stroke="#3A332B" strokeWidth="3" strokeLinecap="round" />
    </>
  ) },
  estrela: { name: 'Estrela de Belém', draw: (
    <>
      <circle cx="32" cy="30" r="14" fill="#FFE58A" opacity=".45" />
      <path d="M32 4l4 20 20 6-20 6-4 24-4-24-20-6 20-6z" fill="#F6C343" stroke="#C99212" strokeWidth="1.5" strokeLinejoin="round" />
    </>
  ) },
  candeia: { name: 'Candeia acesa', draw: (
    <>
      <path d="M33 10c6 7 5 13 0 16-5-3-6-9 0-16z" fill="#FFB020" />
      <path d="M33 16c3 4 2 7 0 9-2-2-3-5 0-9z" fill="#FFE36E" />
      <path d="M8 40c6-10 36-12 48-4-2 10-14 14-28 14-10 0-18-4-20-10z" fill="#A86B3C" stroke="#6E4420" strokeWidth="1.5" />
      <path d="M48 36l10-6" stroke="#6E4420" strokeWidth="3" strokeLinecap="round" />
      <path d="M33 27v6" stroke="#4A3A28" strokeWidth="2" />
    </>
  ) },
  pergaminho: { name: 'Pergaminho', draw: (
    <>
      <rect x="14" y="14" width="36" height="38" fill="#F1E2B8" stroke="#B4955A" strokeWidth="1.5" />
      <rect x="8" y="8" width="8" height="48" rx="4" fill="#8B5A2B" />
      <rect x="48" y="8" width="8" height="48" rx="4" fill="#8B5A2B" />
      {[22, 28, 34, 40, 46].map((y) => <path key={y} d={`M20 ${y}h24`} stroke="#8E7A50" strokeWidth="1.6" />)}
    </>
  ) },
  arcoiris: { name: 'Arco-íris da aliança', draw: (
    <>
      {['#E5383B', '#F48C06', '#FFD60A', '#38B000', '#1D63C9', '#7B2CBF'].map((c, i) => (
        <path key={c} d={`M${6 + i * 3} 48a${26 - i * 3} ${26 - i * 3} 0 0 1 ${52 - i * 6} 0`} stroke={c} strokeWidth="3.2" fill="none" />
      ))}
      <ellipse cx="12" cy="50" rx="10" ry="5" fill="#fff" /><ellipse cx="52" cy="50" rx="10" ry="5" fill="#fff" />
    </>
  ) },
  sarca: { name: 'Sarça ardente', draw: (
    <>
      <path d="M32 6c10 10 4 16 12 22 4-6 2-10 2-12 8 8 10 26-14 34-24-8-22-26-14-34 0 4 0 8 4 10 0-8 2-14 8-20z" fill="#FF7A1A" />
      <path d="M32 22c6 6 2 10 6 14 2-2 2-4 2-6 4 6 2 16-10 18-12-2-12-12-8-18 0 2 0 4 2 6 0-6 4-10 8-14z" fill="#FFC93C" />
      <path d="M14 56c4-8 10-10 18-10s14 2 18 10z" fill="#3F7D2C" />
    </>
  ) },
  jarro: { name: 'Jarro de Gideão', draw: (
    <>
      <path d="M24 10h16v6c8 4 12 12 12 22 0 12-9 18-20 18s-20-6-20-18c0-10 4-18 12-22z" fill="#B5643A" stroke="#7A3E1E" strokeWidth="1.5" />
      <path d="M14 34h36" stroke="#E4B080" strokeWidth="3" />
      <path d="M32 2c4 4 3 7 0 8-3-1-4-4 0-8z" fill="#FFB020" />
    </>
  ) },
};

/** Ilustração bíblica pelo nome (chave de BIBLE_ART). */
export function BibleArt({ id, size = '1em' }) {
  const a = BIBLE_ART[id];
  return a ? <S size={size} title={a.name}>{a.draw}</S> : null;
}

// ───────────── Xadrez ─────────────

const PIECE = {
  p: <path d="M32 14a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm-6 16h12l4 16H22zM16 48h32v8H16z" />,
  r: <path d="M18 12h6v5h5v-5h6v5h5v-5h6v12l-4 3v17h4l2 4H16l2-4h4V27l-4-3zM14 50h36v6H14z" />,
  n: <path d="M24 56H50v-6c0-14-2-26-12-34-4-3-8-4-12-2l-4 6-6 4 2 8 8-2 6 2c-6 6-10 12-8 24zM14 50h38v6H14z" />,
  b: <path d="M32 6a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 9c8 6 11 14 9 22l-3 5H26l-3-5c-2-8 1-16 9-22zm-8 29h16l2 6H22zM14 50h36v6H14z" />,
  q: <><circle cx="10" cy="17" r="4" /><circle cx="23" cy="11" r="4" /><circle cx="41" cy="11" r="4" /><circle cx="54" cy="17" r="4" /><path d="M10 22l8 22h28l8-22-10 10-4-16-8 16-8-16-4 16zM16 46h32l2 6H14zM14 52h36v4H14z" /></>,
  k: <path d="M30 4h4v5h5v4h-5v5h-4v-5h-5V9h5zM32 18c10 0 16 6 16 14 0 5-3 9-6 12H22c-3-3-6-7-6-12 0-8 6-14 16-14zm-12 28h24l2 4H18zM14 50h36v6H14z" />,
};

/** Peça de xadrez desenhada. white = peça branca. */
export function ChessPiece({ type, white, size = '1em' }) {
  return (
    <S size={size} title={undefined}>
      <g fill={white ? '#FBFAF6' : '#23262E'} stroke={white ? '#3A3D45' : '#0B0C10'} strokeWidth="2.2" strokeLinejoin="round">{PIECE[type]}</g>
    </S>
  );
}

// ───────────── Naipes ─────────────

const SUIT_PATH = {
  '♠': 'M32 6C22 20 8 28 8 40c0 8 6 12 12 12 4 0 8-2 10-6l-4 12h12l-4-12c2 4 6 6 10 6 6 0 12-4 12-12 0-12-14-20-24-34z',
  '♥': 'M32 56C14 42 6 32 6 22 6 14 12 8 20 8c5 0 9 3 12 7 3-4 7-7 12-7 8 0 14 6 14 14 0 10-8 20-26 34z',
  '♦': 'M32 4l22 28-22 28-22-28z',
  '♣': 'M32 6a11 11 0 0 1 10 15 11 11 0 1 1-6 18l4 15H24l4-15a11 11 0 1 1-6-18A11 11 0 0 1 32 6z',
};
export const SUIT_RED = (s) => s === '♥' || s === '♦';
export function Suit({ s, size = '1em' }) {
  return <S size={size}><path d={SUIT_PATH[s]} fill={SUIT_RED(s) ? '#D62828' : '#1B1E26'} /></S>;
}

// ───────────── Placar ─────────────

export function Heart({ full = true, size = '1em' }) {
  return <S size={size}><path d={SUIT_PATH['♥']} fill={full ? '#E5383B' : 'none'} stroke={full ? '#B71C24' : '#9AA3B5'} strokeWidth="4" /></S>;
}
export function Hearts({ n, max = n, size = '1em' }) {
  return <span className="game-hearts">{Array.from({ length: max }, (_, i) => <Heart key={i} full={i < n} size={size} />)}</span>;
}

// ───────────── Canvas ─────────────

/** Coração desenhado no canvas (vidas). */
export function drawHeart(ctx, x, y, r, color = '#E5383B') {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.6, y - r * 0.1, x - r * 0.8, y - r * 1.3, x, y - r * 0.45);
  ctx.bezierCurveTo(x + r * 0.8, y - r * 1.3, x + r * 1.6, y - r * 0.1, x, y + r * 0.9);
  ctx.fill();
  ctx.restore();
}
export function drawHearts(ctx, n, x, y, r = 7, alignRight = false) {
  for (let i = 0; i < n; i++) drawHeart(ctx, alignRight ? x - r - i * r * 2.6 : x + r + i * r * 2.6, y, r);
}

/** Bandeira de chegada no canvas. */
export function drawFlag(ctx, x, y, s) {
  ctx.save();
  ctx.strokeStyle = '#4B3A2A'; ctx.lineWidth = Math.max(2, s * 0.08);
  ctx.beginPath(); ctx.moveTo(x - s * 0.25, y + s * 0.4); ctx.lineTo(x - s * 0.25, y - s * 0.4); ctx.stroke();
  const w = s * 0.5; const h = s * 0.32; const c = w / 4;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff';
    ctx.fillRect(x - s * 0.25 + i * c, y - s * 0.4 + j * (h / 2), c, h / 2);
  }
  ctx.restore();
}

/** Frutas desenhadas no canvas (maçã, laranja, uva, cereja, figo). */
export const FRUIT_KINDS = ['maca', 'laranja', 'uva', 'cereja', 'figo'];
export function drawFruit(ctx, kind, x, y, r) {
  ctx.save();
  const ball = (cx, cy, rr, c1, c2) => {
    const g = ctx.createRadialGradient(cx - rr * 0.35, cy - rr * 0.35, rr * 0.1, cx, cy, rr);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
  };
  const leaf = (cx, cy) => {
    ctx.fillStyle = '#3E8E2E';
    ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.32, r * 0.14, -0.6, 0, Math.PI * 2); ctx.fill();
  };
  const stem = (x1, y1, x2, y2) => { ctx.strokeStyle = '#5B3A1E'; ctx.lineWidth = Math.max(1.2, r * 0.12); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  if (kind === 'maca') { ball(x, y + r * 0.08, r * 0.9, '#FF6B6B', '#B3141B'); stem(x, y - r * 0.7, x + r * 0.1, y - r * 1.05); leaf(x + r * 0.35, y - r * 0.85); }
  else if (kind === 'laranja') { ball(x, y, r * 0.9, '#FFC46B', '#E26A00'); leaf(x + r * 0.25, y - r * 0.85); }
  else if (kind === 'figo') { ball(x, y + r * 0.1, r * 0.85, '#A86BC9', '#4B1F5E'); stem(x, y - r * 0.7, x, y - r * 1.0); }
  else if (kind === 'cereja') {
    stem(x - r * 0.4, y + r * 0.1, x + r * 0.1, y - r * 0.95); stem(x + r * 0.45, y + r * 0.2, x + r * 0.1, y - r * 0.95);
    ball(x - r * 0.4, y + r * 0.35, r * 0.5, '#FF5A6E', '#9E0B1F'); ball(x + r * 0.45, y + r * 0.45, r * 0.5, '#FF5A6E', '#9E0B1F');
  } else {
    for (const [dx, dy] of [[-0.35, -0.35], [0.35, -0.35], [0, -0.05], [-0.35, 0.25], [0.35, 0.25], [0, 0.55]]) ball(x + dx * r, y + dy * r, r * 0.33, '#B784E0', '#4E2A84');
    stem(x, y - r * 0.65, x + r * 0.1, y - r * 1.0);
  }
  ctx.restore();
}

/** Sapo visto de cima (Atravesse a rua). */
export function drawFrog(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  const r = s / 2;
  ctx.fillStyle = '#2E8B3A';
  for (const [dx, dy, a] of [[-0.75, -0.55, -0.6], [0.75, -0.55, 0.6], [-0.8, 0.6, 0.5], [0.8, 0.6, -0.5]]) {
    ctx.beginPath(); ctx.ellipse(dx * r, dy * r, r * 0.38, r * 0.18, a, 0, Math.PI * 2); ctx.fill();
  }
  const g = ctx.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#7BD66B'); g.addColorStop(1, '#2C7D2F');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, r * 0.1, r * 0.62, r * 0.72, 0, 0, Math.PI * 2); ctx.fill();
  for (const dx of [-0.32, 0.32]) {
    ctx.fillStyle = '#F4F7EC'; ctx.beginPath(); ctx.arc(dx * r, -r * 0.5, r * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(dx * r, -r * 0.52, r * 0.1, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** Respingo na água ou batida (quando o sapo perde a vida). */
export function drawBurst(ctx, x, y, s, water) {
  ctx.save();
  ctx.fillStyle = water ? 'rgba(170,215,255,.9)' : 'rgba(255,190,60,.95)';
  ctx.strokeStyle = water ? '#2B6CB0' : '#C0392B';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const rr = (i % 2 ? 0.25 : 0.5) * s;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
