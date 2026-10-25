// Desenho do bichinho em pé (cachorro, gato ou ovelha; masculino ou feminino), com expressões,
// reações e roupinhas. Tudo em SVG; as animações ficam no pet.css. Os olhos seguem o dedo pelas
// variáveis CSS --ex e --ey (definidas na cena).

const PALETTE = {
  cachorro: { caramelo: ['#D9A066', '#A86F3A', '#F7E3C8'], chocolate: ['#8A5A3B', '#5E3A22', '#E2C29F'], branco: ['#F4F1EA', '#C9C1B1', '#FFFFFF'], cinza: ['#9AA3AF', '#6B7380', '#E4E8EE'] },
  gato: { laranja: ['#F2A65A', '#C97A2E', '#FCE8CF'], cinza: ['#8E97A6', '#626B7A', '#E3E7EC'], preto: ['#3A3F4B', '#22252D', '#9AA2B3'], branco: ['#F7F5F0', '#CFC8BA', '#FFFFFF'] },
  ovelha: { branca: ['#FBF8F1', '#D8D0BF', '#F3DCCB'], creme: ['#F3E3C3', '#D6BF92', '#EED3BE'], cinza: ['#D3D7DE', '#A7AEBA', '#E9D6CC'], rosa: ['#F8D7E3', '#E3A9BF', '#F6D2C8'] },
};
const IRIS = { cachorro: '#7A4A26', gato: '#3FA34D', ovelha: '#3A7BD5' };
export const colorsOf = (kind, color) => PALETTE[kind]?.[color] || Object.values(PALETTE[kind] || PALETTE.cachorro)[0];
export const swatch = (kind, color) => colorsOf(kind, color)[0];

const INK = '#2A2230';

/** Cor das mangas e das pernas de cada roupa (null = pelo). */
const SUIT = {
  camiseta: { sleeve: '#2B6CD8' }, blusa: { sleeve: '#F48FB1' }, moletom: { sleeve: '#E03B44' },
  pijama: { sleeve: '#2C5AA0', leg: '#2C5AA0', dots: '#F9C71D' }, uniforme: { sleeve: '#CDB47A', leg: '#1C2E5E' },
  macacao: { sleeve: '#8FD3F4', leg: '#8FD3F4', dots: '#C77DFF' }, vestido: { sleeve: '#E5383B' },
};

function Eyes({ mood, react, gender, kind, face }) {
  const closedHappy = react === 'pat' || react === 'laugh';
  if (mood === 'dormindo' || closedHappy || react === 'ouch') {
    const d = react === 'ouch' ? (x) => `M${x - 14} 104 l14 8 l-14 8` : closedHappy ? (x) => `M${x - 16} 116 q16 -16 32 0` : (x) => `M${x - 16} 112 q16 12 32 0`;
    return <g stroke={INK} strokeWidth="4.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d={d(90)} /><path d={react === 'ouch' ? 'M164 104 l-14 8 l14 8' : d(150)} /></g>;
  }
  const lid = mood === 'sono' || react === 'yawn';
  const sad = mood === 'triste' || mood === 'fome';
  return (
    <g className="pet-eyes">
      {[90, 150].map((cx) => (
        <g key={cx}>
          <ellipse cx={cx} cy="112" rx="22" ry="26" fill="#fff" stroke={INK} strokeWidth="2.5" />
          <g className="pet-pupil">
            <circle cx={cx} cy="116" r="15" fill={IRIS[kind]} />
            <circle cx={cx} cy="116" r="8.5" fill="#15121A" />
            <circle cx={cx + 5} cy="109" r="4.5" fill="#fff" />
            <circle cx={cx - 5} cy="122" r="2" fill="#fff" opacity=".8" />
          </g>
          {lid && <path d={`M${cx - 24} 112 Q${cx} 96 ${cx + 24} 112 L${cx + 24} 82 L${cx - 24} 82 Z`} fill={face} stroke={INK} strokeWidth="2.5" />}
          {gender === 'f' && <g stroke={INK} strokeWidth="3" strokeLinecap="round">{(cx < 120 ? [[-22, 98, -30, 92], [-19, 92, -25, 84], [-13, 88, -16, 79]] : [[22, 98, 30, 92], [19, 92, 25, 84], [13, 88, 16, 79]]).map(([a, b, c, d2]) => <path key={a} d={`M${cx + a} ${b} L${cx + c} ${d2}`} />)}</g>}
        </g>
      ))}
      <g stroke={INK} strokeWidth={gender === 'f' ? 2.5 : 4} strokeLinecap="round" fill="none">
        {sad ? <><path d="M70 80 q14 -2 26 8" /><path d="M170 80 q-14 -2 -26 8" /></> : <><path d="M72 80 q16 -10 32 -2" /><path d="M168 80 q-16 -10 -32 -2" /></>}
      </g>
    </g>
  );
}

function Mouth({ mood, react, lip }) {
  if (react === 'chew') return <g className="pet-chew"><path className="m-open" d="M104 160 q16 22 32 0 z" fill="#8E2B3A" stroke={INK} strokeWidth="2.5" /><path className="m-closed" d="M104 162 q16 8 32 0" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" /></g>;
  if (react === 'laugh' || react === 'jump') return <g><path d="M98 156 q22 40 44 0 z" fill="#8E2B3A" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" /><path d="M100 157 h40 v5 q-20 5 -40 0 z" fill="#fff" /><ellipse cx="120" cy="178" rx="11" ry="6" fill="#F28B9A" /></g>;
  if (react === 'yawn' || mood === 'fome') return <g><ellipse cx="120" cy="168" rx="13" ry={react === 'yawn' ? 16 : 12} fill="#8E2B3A" stroke={INK} strokeWidth="2.5" /><ellipse cx="120" cy="176" rx="8" ry="4" fill="#F28B9A" /></g>;
  if (mood === 'dormindo') return <path d="M112 162 q8 5 16 0" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />;
  if (react === 'ouch') return <ellipse cx="120" cy="166" rx="8" ry="6" fill="#8E2B3A" stroke={INK} strokeWidth="2.5" />;
  if (mood === 'triste' || mood === 'sujo') return <path d="M102 170 q18 -14 36 0" stroke={lip || INK} strokeWidth="4" fill="none" strokeLinecap="round" />;
  if (mood === 'apertado') return <path d="M100 166 l7 -5 l6 5 l7 -5 l6 5 l7 -5 l6 5" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />;
  return (
    <g>
      <path d="M98 156 q22 26 44 0 q-22 8 -44 0 z" fill="#8E2B3A" stroke={lip || INK} strokeWidth={lip ? 4 : 2.5} strokeLinejoin="round" />
      <path d="M108 164 q12 8 24 0" fill="#F28B9A" />
    </g>
  );
}

function Ears({ kind, main, dark, gender, back }) {
  if (kind === 'gato') {
    if (!back) return null;
    return (
      <g>
        <path d="M52 78 L46 8 L104 46 Z" fill={main} stroke={dark} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M188 78 L194 8 L136 46 Z" fill={main} stroke={dark} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M60 64 L57 26 L90 46 Z M180 64 L183 26 L150 46 Z" fill={gender === 'f' ? '#F7A8C0' : '#E79AAE'} />
      </g>
    );
  }
  if (kind === 'cachorro') {
    if (back) return null;
    return (
      <g fill={dark}>
        <path d="M56 66 Q26 80 30 150 Q34 176 54 168 Q66 120 74 82 Z" />
        <path d="M184 66 Q214 80 210 150 Q206 176 186 168 Q174 120 166 82 Z" />
      </g>
    );
  }
  if (!back) return null;
  return <g fill={dark}><ellipse cx="34" cy="116" rx="26" ry="12" transform="rotate(-18 34 116)" /><ellipse cx="206" cy="116" rx="26" ry="12" transform="rotate(18 206 116)" /></g>;
}

function Hat({ id }) {
  switch (id) {
    case 'bone': return <g><path d="M48 70 Q120 -14 192 70 Z" fill="#2B6CD8" stroke="#1C4A9C" strokeWidth="2.5" /><path d="M130 66 Q180 58 214 74 Q180 84 128 76 Z" fill="#1C4A9C" /><circle cx="120" cy="30" r="5" fill="#1C4A9C" /><path d="M120 34 V68" stroke="#1C4A9C" strokeWidth="2" /></g>;
    case 'bone-tras': return <g><path d="M48 70 Q120 -14 192 70 Z" fill="#18875A" stroke="#0E5C3B" strokeWidth="2.5" /><path d="M110 66 Q60 58 26 74 Q60 84 112 76 Z" fill="#0E5C3B" /><circle cx="120" cy="30" r="5" fill="#0E5C3B" /></g>;
    case 'chapeu-dbv': return <g><ellipse cx="120" cy="58" rx="94" ry="15" fill="#7A5230" stroke="#4E3219" strokeWidth="2.5" /><path d="M72 58 Q74 6 120 2 Q166 6 168 58 Z" fill="#A87545" stroke="#4E3219" strokeWidth="2.5" /><path d="M96 8 l24 20 l24 -20" stroke="#4E3219" strokeWidth="2.5" fill="none" /><rect x="72" y="44" width="96" height="9" fill="#18875A" /></g>;
    case 'gorro': return <g><path d="M50 72 Q120 -30 190 72 Z" fill="#7B2CBF" /><path d="M70 40 Q120 10 170 40" stroke="#9D4EDD" strokeWidth="6" fill="none" /><rect x="46" y="62" width="148" height="16" rx="8" fill="#F7F5F0" /><circle cx="120" cy="-2" r="13" fill="#F7F5F0" /></g>;
    case 'coroa': return <g><path d="M80 56 L74 10 L100 32 L120 0 L140 32 L166 10 L160 56 Z" fill="#F6C343" stroke="#B88A10" strokeWidth="2.5" strokeLinejoin="round" /><circle cx="120" cy="42" r="6" fill="#D62839" /><circle cx="96" cy="46" r="4" fill="#1D63C9" /><circle cx="144" cy="46" r="4" fill="#1F8A4C" /></g>;
    case 'laco': return <g transform="translate(150 36) rotate(18)"><path d="M0 0 L-34 -20 Q-42 0 -34 20 Z M0 0 L34 -20 Q42 0 34 20 Z" fill="#FF5A8A" stroke="#C2185B" strokeWidth="2.5" strokeLinejoin="round" /><circle r="9" fill="#FF7AA2" stroke="#C2185B" strokeWidth="2.5" /></g>;
    case 'flor': return <g transform="translate(70 50)">{[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="0" cy="-14" rx="9" ry="14" fill="#F06292" transform={`rotate(${a})`} />)}<circle r="8" fill="#FFD54F" /></g>;
    case 'tiara': return <g><path d="M54 74 Q120 10 186 74" stroke="#C77DFF" strokeWidth="8" fill="none" strokeLinecap="round" /><path d="M120 20 l7 14 l15 2 l-11 10 l3 15 l-14 -7 l-14 7 l3 -15 l-11 -10 l15 -2 z" fill="#FFD54F" stroke="#E0A800" strokeWidth="2" /></g>;
    default: return null;
  }
}

function Glasses({ id }) {
  switch (id) {
    case 'redondo': return <g fill="rgba(200,230,255,.25)" stroke="#3A2A1A" strokeWidth="4"><circle cx="90" cy="112" r="26" /><circle cx="150" cy="112" r="26" /><path d="M116 110 h8" /></g>;
    case 'sol': return <g><path d="M60 96 h56 l-6 30 q-22 10 -44 0 z M124 96 h56 l-6 30 q-22 10 -44 0 z" fill="#1A1D26" /><path d="M116 100 h8" stroke="#1A1D26" strokeWidth="5" /><path d="M68 102 l14 0" stroke="#fff" strokeWidth="3" opacity=".5" /></g>;
    case 'coracao': return <g fill="rgba(255,90,138,.75)" stroke="#C2185B" strokeWidth="3"><path d="M90 134 C60 116 64 92 80 92 C86 92 90 98 90 98 C90 98 94 92 100 92 C116 92 120 116 90 134 Z" transform="translate(-10 0) scale(1.1)" /><path d="M150 134 C120 116 124 92 140 92 C146 92 150 98 150 98 C150 98 154 92 160 92 C176 92 180 116 150 134 Z" transform="translate(-8 0) scale(1.05)" /><path d="M110 110 h20" fill="none" /></g>;
    case 'aviador': return <g><path d="M62 98 q24 -6 50 0 q2 26 -24 30 q-26 -4 -26 -30 z M128 98 q26 -6 50 0 q0 26 -26 30 q-26 -4 -24 -30 z" fill="rgba(80,60,20,.65)" stroke="#C9A227" strokeWidth="3" /><path d="M112 98 q8 -6 16 0" stroke="#C9A227" strokeWidth="3" fill="none" /></g>;
    default: return null;
  }
}

function Neck({ id }) {
  switch (id) {
    case 'lenco': return <g><path d="M84 198 Q120 214 156 198 L120 246 Z" fill="#F9C71D" stroke="#C99400" strokeWidth="2.5" strokeLinejoin="round" /><circle cx="120" cy="210" r="7" fill="#7A5230" /></g>;
    case 'gravata': return <g><path d="M120 206 L96 194 V218 Z M120 206 L144 194 V218 Z" fill="#D62839" stroke="#8E1622" strokeWidth="2" strokeLinejoin="round" /><circle cx="120" cy="206" r="6" fill="#B71C2C" /></g>;
    case 'colar': return <g fill="#FDFBF7" stroke="#D8CFC0" strokeWidth="1">{Array.from({ length: 11 }, (_, i) => { const a = Math.PI * (0.15 + (i / 10) * 0.7); return <circle key={i} cx={120 - Math.cos(a) * 40} cy={196 + Math.sin(a) * 18} r="5" />; })}</g>;
    case 'cachecol': return <g><path d="M74 194 Q120 220 166 194 L166 210 Q120 236 74 210 Z" fill="#18875A" /><rect x="138" y="206" width="20" height="46" rx="4" fill="#18875A" /><path d="M138 238 h20 M138 246 h20" stroke="#F9C71D" strokeWidth="4" /></g>;
    default: return null;
  }
}

function Body({ suit, main, light, wool }) {
  const s = SUIT[suit];
  const torso = 'M70 214 Q120 186 170 214 Q182 262 168 314 Q120 336 72 314 Q58 262 70 214 Z';
  return (
    <g>
      {wool ? <g fill={main}>{[[84, 222], [120, 210], [156, 222], [74, 262], [120, 252], [166, 262], [84, 300], [120, 308], [156, 300]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="30" />)}</g>
        : <path d={torso} fill={main} />}
      {!s && !wool && <ellipse cx="120" cy="274" rx="32" ry="40" fill={light} />}
      {suit === 'camiseta' && <><path d={torso} fill="#2B6CD8" /><path d="M96 252 h48 v20 h-48 z" fill="#F9C71D" opacity=".9" /><text x="120" y="267" textAnchor="middle" fontSize="15" fontWeight="900" fill="#1C4A9C">DBV</text></>}
      {suit === 'blusa' && <><path d={torso} fill="#F48FB1" /><path d="M72 300 q12 14 24 0 q12 14 24 0 q12 14 24 0 q12 14 24 0" fill="none" stroke="#fff" strokeWidth="5" /><circle cx="120" cy="250" r="9" fill="#fff" /></>}
      {suit === 'moletom' && <><path d={torso} fill="#E03B44" /><rect x="94" y="268" width="52" height="24" rx="10" fill="#C42E36" /><path d="M108 214 v26 M132 214 v26" stroke="#fff" strokeWidth="3" /></>}
      {suit === 'uniforme' && <><path d={torso} fill="#CDB47A" /><path d="M120 206 V320" stroke="#9C8550" strokeWidth="2.5" /><rect x="82" y="236" width="24" height="18" rx="3" fill="#BCA265" stroke="#9C8550" strokeWidth="2" /><rect x="134" y="236" width="24" height="18" rx="3" fill="#BCA265" stroke="#9C8550" strokeWidth="2" /><circle cx="146" cy="272" r="8" fill="#E92A2F" /><path d="M141 268 l5 9 l5 -9 z" fill="#F9C71D" /><rect x="72" y="300" width="96" height="10" fill="#4E3219" /></>}
      {(suit === 'pijama' || suit === 'macacao') && <><path d={torso} fill={s.sleeve} /><g fill={s.dots}>{[[92, 236], [140, 230], [118, 266], [88, 292], [150, 286], [120, 306]].map(([x, y]) => (suit === 'pijama' ? <path key={`${x}${y}`} d={`M${x} ${y - 7} l2.5 5 l5.5 .8 l-4 3.8 l1 5.5 l-5 -2.6 l-5 2.6 l1 -5.5 l-4 -3.8 l5.5 -.8 z`} /> : <circle key={`${x}${y}`} cx={x} cy={y} r="7" />))}</g><path d="M120 204 V318" stroke="rgba(0,0,0,.15)" strokeWidth="3" /></>}
      {suit === 'vestido' && <><path d="M76 210 Q120 190 164 210 L188 334 Q120 350 52 334 Z" fill="#E5383B" /><g fill="#fff">{[[96, 240], [140, 236], [118, 276], [80, 310], [160, 306], [118, 324]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="6" />)}</g><rect x="84" y="250" width="72" height="9" rx="4" fill="#FFD54F" /></>}
    </g>
  );
}

/**
 * O bichinho. kind: cachorro | gato | ovelha; gender: m | f; mood: feliz, fome, sono, sujo, triste,
 * apertado, dormindo; react: pat, laugh, jump, wave, chew, yawn, ouch (reação do momento).
 */
const CROP = { head: '-6 -24 252 236', body: '20 170 200 230', full: '-10 -20 260 420' };
export default function PetArt({ kind = 'cachorro', color, gender = 'm', mood = 'feliz', react, outfit = {}, dirty, wet, crop = 'full', className = '' }) {
  const [main, dark, light] = colorsOf(kind, color);
  const sheep = kind === 'ovelha';
  const face = sheep ? light : main;
  const fur = sheep ? '#4A3B33' : main;
  const suit = outfit.roupa;
  const s = SUIT[suit];
  const lip = outfit.rosto === 'batom' ? '#E0559A' : outfit.rosto === 'batom-vermelho' ? '#D62839' : gender === 'f' ? '#C2414F' : null;
  const hood = suit === 'macacao';
  return (
    <svg viewBox={CROP[crop]} className={`pet-art pet-${kind} pet-g-${gender} pet-mood-${mood}${react ? ` pet-react-${react}` : ''} ${className}`} role="img" aria-label="Bichinho">
      <ellipse className="pet-shadow" cx="120" cy="384" rx="78" ry="10" fill="rgba(0,0,0,.2)" />
      <g className="pet-all">
        {/* rabo e capa (atrás) */}
        <g className="pet-tail">
          {kind === 'cachorro' && <path d="M158 300 Q206 290 210 236" stroke={main} strokeWidth="16" fill="none" strokeLinecap="round" />}
          {kind === 'gato' && <path d="M160 310 Q222 312 214 250 Q210 222 192 232" stroke={main} strokeWidth="13" fill="none" strokeLinecap="round" />}
          {sheep && <circle cx="170" cy="306" r="16" fill={main} />}
        </g>
        {suit === 'capa' && <path className="pet-cape" d="M70 204 Q120 186 170 204 L196 362 Q120 378 44 362 Z" fill="#D62839" stroke="#8E1622" strokeWidth="2.5" />}
        {/* pernas e pés */}
        <g className="pet-legs">
          <rect x="88" y="296" width="28" height="70" rx="13" fill={s?.leg || fur} />
          <rect x="124" y="296" width="28" height="70" rx="13" fill={s?.leg || fur} />
          <ellipse cx="100" cy="370" rx="24" ry="13" fill={sheep ? '#3A2E28' : fur} stroke={dark} strokeWidth="2" />
          <ellipse cx="140" cy="370" rx="24" ry="13" fill={sheep ? '#3A2E28' : fur} stroke={dark} strokeWidth="2" />
          {!sheep && <g fill={dark} opacity=".45"><circle cx="92" cy="372" r="3" /><circle cx="100" cy="374" r="3" /><circle cx="108" cy="372" r="3" /><circle cx="132" cy="372" r="3" /><circle cx="140" cy="374" r="3" /><circle cx="148" cy="372" r="3" /></g>}
        </g>
        {/* tronco */}
        <g className="pet-body">
          <Body suit={suit} main={main} light={light} wool={sheep && !s} />
          <Neck id={outfit.pescoco} />
        </g>
        {/* braços */}
        {[['l', 76, 1], ['r', 164, -1]].map(([side, x, dir]) => (
          <g key={side} className={`pet-arm pet-arm-${side}`} style={{ transformOrigin: `${x}px 214px` }}>
            <path d={`M${x} 212 Q${x - dir * 18} 250 ${x - dir * 14} 292`} stroke={fur} strokeWidth="24" fill="none" strokeLinecap="round" />
            {s?.sleeve && <path d={`M${x} 212 Q${x - dir * 16} 236 ${x - dir * 15} 256`} stroke={s.sleeve} strokeWidth="27" fill="none" strokeLinecap="round" />}
            <circle cx={x - dir * 14} cy="296" r="15" fill={sheep ? light : main} stroke={dark} strokeWidth="2" />
          </g>
        ))}
        {/* cabeça */}
        <g className="pet-headg">
          {hood && <path d="M30 128 Q30 20 120 18 Q210 20 210 128 Q210 200 120 204 Q30 200 30 128 Z" fill="#8FD3F4" stroke="#5FB3DB" strokeWidth="3" />}
          {hood && <g fill="#8FD3F4" stroke="#5FB3DB" strokeWidth="3"><path d="M50 50 L40 0 L90 30 Z" /><path d="M190 50 L200 0 L150 30 Z" /></g>}
          {!hood && <Ears kind={kind} main={main} dark={dark} gender={gender} back />}
          <ellipse cx="120" cy="120" rx="82" ry="76" fill={face} stroke={sheep ? dark : 'none'} strokeWidth="2" />
          {sheep && !hood && <g fill={main}>{[[66, 58], [92, 44], [120, 40], [148, 44], [174, 58], [104, 60], [136, 60]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="20" />)}</g>}
          {!sheep && !hood && gender === 'f' && <path d="M84 52 Q104 30 128 44 Q146 32 160 56 Q136 50 124 62 Q106 48 84 52 Z" fill={dark} />}
          {!sheep && !hood && gender === 'm' && <path d="M110 46 q8 -16 18 -6 q4 -10 10 -2" stroke={dark} strokeWidth="5" fill="none" strokeLinecap="round" />}
          {!hood && <Ears kind={kind} main={main} dark={dark} gender={gender} />}
          {kind !== 'ovelha' && <ellipse cx="120" cy="154" rx="40" ry="30" fill={light} />}
          <ellipse cx="72" cy="150" rx="15" ry="9" fill="#F48FA4" opacity={outfit.rosto === 'blush' ? 0.85 : gender === 'f' ? 0.5 : 0.3} />
          <ellipse cx="168" cy="150" rx="15" ry="9" fill="#F48FA4" opacity={outfit.rosto === 'blush' ? 0.85 : gender === 'f' ? 0.5 : 0.3} />
          {outfit.rosto === 'sardas' && <g fill="#B5734A" opacity=".75">{[[66, 146], [74, 152], [80, 144], [160, 146], [166, 152], [174, 144]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="2.5" />)}</g>}
          <Eyes mood={mood} react={react} gender={gender} kind={kind} face={face} />
          {kind === 'cachorro' ? <ellipse cx="120" cy="142" rx="13" ry="9.5" fill={INK} /> : <path d="M110 138 h20 l-10 11 z" fill={sheep ? '#B5677A' : '#E57A93'} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />}
          {kind === 'cachorro' && <ellipse cx="116" cy="139" rx="4" ry="2.5" fill="#fff" opacity=".6" />}
          {kind === 'gato' && <g stroke={dark} strokeWidth="2.2" strokeLinecap="round"><path d="M92 150 l-38 -6 M92 158 l-38 6 M148 150 l38 -6 M148 158 l38 6" /></g>}
          <Mouth mood={mood} react={react} lip={lip} />
          {mood === 'triste' && react !== 'laugh' && <path className="pet-tear" d="M70 132 q-6 14 0 20 q6 -6 0 -20" fill="#7FC4FF" />}
          {mood === 'apertado' && <path d="M190 72 q-8 14 0 20 q8 -6 0 -20" fill="#7FC4FF" />}
          <Glasses id={outfit.oculos} />
          <Hat id={outfit.chapeu} />
        </g>
        {dirty && <g fill="#7A5A34" opacity=".75"><ellipse cx="96" cy="262" rx="12" ry="8" /><ellipse cx="150" cy="300" rx="10" ry="6" /><ellipse cx="160" cy="88" rx="8" ry="5" /><circle cx="108" cy="354" r="6" /><circle cx="72" cy="120" r="4" /></g>}
        {wet && <g fill="#9ED8FF" opacity=".9">{[[70, 90], [170, 120], [90, 250], [150, 230], [120, 330]].map(([x, y]) => <path key={`${x}${y}`} d={`M${x} ${y} q-5 10 0 14 q5 -4 0 -14`} />)}</g>}
      </g>
    </svg>
  );
}

/** Comidas da cozinha (desenhadas). */
export function FoodArt({ id, size = 56 }) {
  const plate = <ellipse cx="32" cy="44" rx="26" ry="9" fill="#F3F5F9" stroke="#C9D1DF" strokeWidth="1.5" />;
  const bowl = (c) => <><path d="M8 30 h48 q-2 22 -24 22 q-22 0 -24 -22 z" fill="#E9EEF6" stroke="#B9C3D4" strokeWidth="1.5" /><ellipse cx="32" cy="30" rx="24" ry="6" fill={c} /></>;
  const art = {
    frutas: <>{bowl('#FFE4B5')}<circle cx="22" cy="27" r="6" fill="#E5383B" /><circle cx="34" cy="25" r="6" fill="#8CC152" /><circle cx="44" cy="28" r="5" fill="#F9A03F" /><circle cx="28" cy="31" r="4" fill="#7B2CBF" /></>,
    sopa: <>{bowl('#F2A65A')}<circle cx="24" cy="29" r="2.5" fill="#5FA03A" /><circle cx="38" cy="30" r="2.5" fill="#E5383B" /><path d="M24 12 q4 -6 0 -10 M34 14 q4 -6 0 -10" stroke="#C9D1DF" strokeWidth="2" fill="none" /></>,
    arroz: <>{plate}<ellipse cx="24" cy="40" rx="13" ry="7" fill="#FFFFFF" stroke="#E0E4EA" /><ellipse cx="40" cy="41" rx="12" ry="6" fill="#6B3E26" /></>,
    panqueca: <>{plate}<ellipse cx="32" cy="40" rx="20" ry="6" fill="#E3A257" /><ellipse cx="32" cy="35" rx="20" ry="6" fill="#EDB36C" /><ellipse cx="32" cy="30" rx="20" ry="6" fill="#F2C07E" /><path d="M24 28 q8 6 16 0" stroke="#A0522D" strokeWidth="3" fill="none" /></>,
    pao: <>{plate}<path d="M10 40 q0 -20 22 -20 q22 0 22 20 z" fill="#D9934A" stroke="#A86428" strokeWidth="1.5" /><path d="M20 28 l4 6 M30 24 l4 6 M40 26 l4 6" stroke="#A86428" strokeWidth="2" /></>,
    bolo: <>{plate}<path d="M14 40 L50 40 L50 24 L14 30 Z" fill="#F29A4A" /><path d="M14 30 L50 24 L50 18 L14 25 Z" fill="#5E3A22" /><circle cx="44" cy="17" r="3" fill="#E5383B" /></>,
    suco: <><path d="M18 10 h28 l-4 44 h-20 z" fill="rgba(220,235,255,.7)" stroke="#9FB2CF" strokeWidth="1.5" /><path d="M20 22 h24 l-3 30 h-18 z" fill="#F9A03F" /><path d="M38 4 l-6 26" stroke="#E5383B" strokeWidth="3" /></>,
  }[id];
  return <svg viewBox="0 0 64 60" width={size} height={size} aria-hidden="true">{art}</svg>;
}

/** Cocô no chão. */
export function Poop() {
  return (
    <svg viewBox="0 0 40 32" className="pet-poop" aria-hidden="true">
      <ellipse cx="20" cy="27" rx="16" ry="4" fill="#5A3B1F" />
      <ellipse cx="20" cy="22" rx="14" ry="6" fill="#7A4E25" />
      <ellipse cx="20" cy="15" rx="10" ry="5" fill="#8B5A2B" />
      <path d="M16 10 q4 -8 8 -2 q-2 2 -4 2 z" fill="#9C6634" />
      <g stroke="#9AA3B5" strokeWidth="1.2" fill="none" opacity=".7"><path d="M8 6 q2 -4 0 -6" /><path d="M32 6 q2 -4 0 -6" /></g>
    </svg>
  );
}
