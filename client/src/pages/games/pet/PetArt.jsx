// Desenho do bichinho (cachorro, gato ou ovelha) sentado, com expressões e roupinhas.
// Tudo em SVG: as animações (respirar, piscar, abanar o rabo) ficam no pet.css.

const PALETTE = {
  cachorro: { caramelo: ['#D9A066', '#A86F3A', '#F5D9B5'], chocolate: ['#8A5A3B', '#5E3A22', '#D9B48F'], branco: ['#F4F1EA', '#C9C1B1', '#FFFFFF'], cinza: ['#9AA3AF', '#6B7380', '#DDE2E8'] },
  gato: { laranja: ['#F2A65A', '#C97A2E', '#FBE3C4'], cinza: ['#9AA3AF', '#6B7380', '#E3E7EC'], preto: ['#3A3F4B', '#22252D', '#8A92A3'], branco: ['#F7F5F0', '#CFC8BA', '#FFFFFF'] },
  ovelha: { branca: ['#FBF8F1', '#D8D0BF', '#F3DCCB'], creme: ['#F3E3C3', '#D6BF92', '#EED3BE'], cinza: ['#D3D7DE', '#A7AEBA', '#E9D6CC'], rosa: ['#F8D7E3', '#E3A9BF', '#F6D2C8'] },
};
export const colorsOf = (kind, color) => PALETTE[kind]?.[color] || Object.values(PALETTE[kind] || PALETTE.cachorro)[0];
export const swatch = (kind, color) => colorsOf(kind, color)[0];

function Eyes({ mood }) {
  if (mood === 'dormindo') {
    return (
      <g stroke="#2A2230" strokeWidth="3.5" fill="none" strokeLinecap="round">
        <path d="M70 84 q10 8 20 0" /><path d="M110 84 q10 8 20 0" />
      </g>
    );
  }
  const sleepy = mood === 'sono';
  const squint = mood === 'apertado';
  return (
    <g className="pet-eyes">
      {[80, 120].map((cx) => (
        <g key={cx}>
          <ellipse cx={cx} cy="82" rx="13" ry={squint ? 7 : 15} fill="#fff" stroke="#2A2230" strokeWidth="2" />
          <circle cx={cx + 2} cy="84" r={squint ? 5 : 8} fill="#2A2230" />
          <circle cx={cx + 5} cy="79" r="3" fill="#fff" />
          {sleepy && <path d={`M${cx - 14} 80 Q${cx} 70 ${cx + 14} 80 L${cx + 14} 66 L${cx - 14} 66 Z`} fill="var(--pet-main)" stroke="#2A2230" strokeWidth="2" />}
        </g>
      ))}
      {(mood === 'triste' || mood === 'fome') && <g stroke="#2A2230" strokeWidth="3" strokeLinecap="round"><path d="M68 62 l18 6" /><path d="M132 62 l-18 6" /></g>}
    </g>
  );
}

function Mouth({ mood, kind }) {
  const y = kind === 'cachorro' ? 112 : 108;
  if (mood === 'dormindo') return <path d={`M94 ${y} q6 4 12 0`} stroke="#2A2230" strokeWidth="2.5" fill="none" strokeLinecap="round" />;
  if (mood === 'fome') return <ellipse cx="100" cy={y + 4} rx="8" ry="9" fill="#7A2A35" stroke="#2A2230" strokeWidth="2" />;
  if (mood === 'triste' || mood === 'sujo') return <path d={`M88 ${y + 8} q12 -10 24 0`} stroke="#2A2230" strokeWidth="3" fill="none" strokeLinecap="round" />;
  if (mood === 'apertado') return <path d={`M88 ${y + 4} l6 -3 l6 3 l6 -3 l6 3`} stroke="#2A2230" strokeWidth="2.5" fill="none" strokeLinecap="round" />;
  return (
    <g>
      <path d={`M86 ${y} q14 16 28 0`} fill="#C2414F" stroke="#2A2230" strokeWidth="2.5" strokeLinejoin="round" />
      <path d={`M93 ${y + 7} q7 6 14 0`} fill="#F28B9A" />
    </g>
  );
}

function Clothes({ outfit, layer }) {
  const o = outfit || {};
  if (layer === 'back') return o.roupa === 'capa' ? <path d="M58 132 Q100 118 142 132 L156 206 Q100 216 44 206 Z" fill="#D62839" stroke="#8E1622" strokeWidth="2" /> : null;
  if (layer === 'body') {
    if (o.roupa === 'camiseta') return <path d="M56 140 Q100 124 144 140 L148 182 Q100 192 52 182 Z" fill="#2B6CD8" stroke="#1C4A9C" strokeWidth="2" />;
    if (o.roupa === 'uniforme') {
      return (
        <g>
          <path d="M56 140 Q100 124 144 140 L148 182 Q100 192 52 182 Z" fill="#CDB47A" stroke="#9C8550" strokeWidth="2" />
          <path d="M100 132 V186" stroke="#9C8550" strokeWidth="2" />
          <rect x="64" y="150" width="18" height="12" rx="2" fill="#BCA265" stroke="#9C8550" strokeWidth="1.5" />
          <rect x="118" y="150" width="18" height="12" rx="2" fill="#BCA265" stroke="#9C8550" strokeWidth="1.5" />
          <circle cx="127" cy="170" r="5" fill="#E92A2F" /><path d="M124 168 l3 5 l3 -5 z" fill="#F9C71D" />
        </g>
      );
    }
    if (o.roupa === 'moletom') return <g><path d="M54 138 Q100 120 146 138 L150 186 Q100 196 50 186 Z" fill="#E03B44" stroke="#9E1F27" strokeWidth="2" /><rect x="80" y="160" width="40" height="16" rx="6" fill="#C42E36" /></g>;
    return null;
  }
  if (layer === 'neck') {
    if (o.pescoco === 'lenco') return <g><path d="M70 128 Q100 140 130 128 L100 162 Z" fill="#F9C71D" stroke="#C99400" strokeWidth="2" strokeLinejoin="round" /><circle cx="100" cy="138" r="5.5" fill="#7A5230" /></g>;
    if (o.pescoco === 'gravata') return <g><path d="M92 128 L100 136 L108 128 L104 140 L96 140 Z" fill="#1C2E5E" /><path d="M96 140 L104 140 L108 168 L100 176 L92 168 Z" fill="#2B54B0" /></g>;
    if (o.pescoco === 'cachecol') return <g><path d="M64 126 Q100 144 136 126 L136 138 Q100 156 64 138 Z" fill="#18875A" /><rect x="118" y="134" width="14" height="30" rx="3" fill="#18875A" /><path d="M118 156 h14" stroke="#F9C71D" strokeWidth="3" /></g>;
    return null;
  }
  if (layer === 'face') {
    if (o.oculos === 'redondo') return <g fill="rgba(200,230,255,.25)" stroke="#3A2A1A" strokeWidth="3"><circle cx="80" cy="82" r="17" /><circle cx="120" cy="82" r="17" /><path d="M97 82 h6" /></g>;
    if (o.oculos === 'sol') return <g><path d="M60 72 h36 l-4 20 q-14 6 -28 0 z M104 72 h36 l-4 20 q-14 6 -28 0 z" fill="#1A1D26" /><path d="M96 76 h8" stroke="#1A1D26" strokeWidth="3" /><path d="M66 76 l8 0" stroke="#fff" strokeWidth="2" opacity=".5" /></g>;
    return null;
  }
  if (layer === 'head') {
    if (o.chapeu === 'bone') return <g><path d="M52 52 Q100 6 148 52 Z" fill="#2B6CD8" stroke="#1C4A9C" strokeWidth="2" /><path d="M120 50 Q150 46 168 56 Q146 60 120 56 Z" fill="#1C4A9C" /><circle cx="100" cy="24" r="4" fill="#1C4A9C" /></g>;
    if (o.chapeu === 'chapeu-dbv') {
      return (
        <g>
          <ellipse cx="100" cy="46" rx="66" ry="11" fill="#7A5230" stroke="#4E3219" strokeWidth="2" />
          <path d="M66 46 Q68 10 100 8 Q132 10 134 46 Z" fill="#A87545" stroke="#4E3219" strokeWidth="2" />
          <path d="M84 12 l16 14 l16 -14" stroke="#4E3219" strokeWidth="2" fill="none" />
          <rect x="66" y="36" width="68" height="7" fill="#18875A" />
        </g>
      );
    }
    if (o.chapeu === 'gorro') return <g><path d="M54 52 Q100 -6 146 52 Z" fill="#7B2CBF" /><rect x="52" y="44" width="96" height="12" rx="6" fill="#F7F5F0" /><circle cx="100" cy="12" r="9" fill="#F7F5F0" /></g>;
    if (o.chapeu === 'coroa') return <g><path d="M64 46 L60 14 L80 30 L100 6 L120 30 L140 14 L136 46 Z" fill="#F6C343" stroke="#B88A10" strokeWidth="2" strokeLinejoin="round" /><circle cx="100" cy="34" r="4.5" fill="#D62839" /><circle cx="80" cy="38" r="3" fill="#1D63C9" /><circle cx="120" cy="38" r="3" fill="#1F8A4C" /></g>;
  }
  return null;
}

/** O bichinho. kind: cachorro | gato | ovelha; mood: feliz, fome, sono, sujo, triste, apertado, dormindo. */
export default function PetArt({ kind = 'cachorro', color, mood = 'feliz', outfit, dirty, className = '' }) {
  const [main, dark, light] = colorsOf(kind, color);
  const sheep = kind === 'ovelha';
  const face = sheep ? light : main;
  return (
    <svg viewBox="0 0 200 222" className={`pet-art pet-${kind} pet-mood-${mood} ${className}`} style={{ '--pet-main': face }} role="img" aria-label="Bichinho">
      <ellipse cx="100" cy="212" rx="60" ry="8" fill="rgba(0,0,0,.18)" />
      {/* rabo */}
      <g className="pet-tail">
        {kind === 'cachorro' && <path d="M140 186 Q176 172 172 140" stroke={main} strokeWidth="12" fill="none" strokeLinecap="round" />}
        {kind === 'gato' && <path d="M142 192 Q186 190 178 150 Q174 132 162 140" stroke={main} strokeWidth="10" fill="none" strokeLinecap="round" />}
        {sheep && <circle cx="150" cy="184" r="11" fill={main} />}
      </g>
      <Clothes outfit={outfit} layer="back" />
      {/* corpo */}
      <g className="pet-body">
        {sheep ? (
          <g fill={main}>
            {[[70, 150], [100, 140], [130, 150], [62, 176], [100, 180], [138, 176], [80, 196], [120, 196]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="24" />)}
          </g>
        ) : <ellipse cx="100" cy="168" rx="50" ry="44" fill={main} />}
        {!sheep && <ellipse cx="100" cy="176" rx="30" ry="28" fill={light} />}
        <Clothes outfit={outfit} layer="body" />
        {/* braços e pés */}
        <ellipse cx="62" cy="176" rx="12" ry="20" fill={sheep ? '#4A3B33' : main} stroke={dark} strokeWidth="1.5" transform="rotate(14 62 176)" />
        <ellipse cx="138" cy="176" rx="12" ry="20" fill={sheep ? '#4A3B33' : main} stroke={dark} strokeWidth="1.5" transform="rotate(-14 138 176)" />
        <ellipse cx="76" cy="206" rx="20" ry="11" fill={sheep ? '#4A3B33' : main} stroke={dark} strokeWidth="1.5" />
        <ellipse cx="124" cy="206" rx="20" ry="11" fill={sheep ? '#4A3B33' : main} stroke={dark} strokeWidth="1.5" />
        {!sheep && <g fill={dark} opacity=".5"><circle cx="70" cy="208" r="2.5" /><circle cx="78" cy="210" r="2.5" /><circle cx="122" cy="210" r="2.5" /><circle cx="130" cy="208" r="2.5" /></g>}
        <Clothes outfit={outfit} layer="neck" />
      </g>
      {/* cabeça */}
      <g className="pet-head">
        {kind === 'cachorro' && <g fill={dark}><path d="M48 54 Q30 70 36 112 Q50 118 58 96 Z" /><path d="M152 54 Q170 70 164 112 Q150 118 142 96 Z" /></g>}
        {kind === 'gato' && <g><path d="M52 62 L50 14 L90 38 Z" fill={main} stroke={dark} strokeWidth="2" strokeLinejoin="round" /><path d="M148 62 L150 14 L110 38 Z" fill={main} stroke={dark} strokeWidth="2" strokeLinejoin="round" /><path d="M58 52 L57 26 L80 40 Z M142 52 L143 26 L120 40 Z" fill="#F4A6B8" /></g>}
        {sheep && <g fill={dark}><ellipse cx="42" cy="82" rx="18" ry="9" transform="rotate(-20 42 82)" /><ellipse cx="158" cy="82" rx="18" ry="9" transform="rotate(20 158 82)" /></g>}
        <circle cx="100" cy="84" r="56" fill={face} stroke={sheep ? dark : 'none'} strokeWidth="1.5" />
        {sheep && <g fill={main}>{[[64, 40], [86, 30], [110, 28], [134, 38], [74, 52], [124, 50], [100, 44]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="16" />)}</g>}
        {kind === 'cachorro' && <ellipse cx="100" cy="104" rx="26" ry="20" fill={light} />}
        {kind === 'gato' && <ellipse cx="100" cy="102" rx="22" ry="16" fill={light} />}
        <ellipse cx="72" cy="102" rx="9" ry="5" fill="#F48FA4" opacity=".55" />
        <ellipse cx="128" cy="102" rx="9" ry="5" fill="#F48FA4" opacity=".55" />
        <Eyes mood={mood} />
        {kind === 'cachorro' && <ellipse cx="100" cy="98" rx="9" ry="6.5" fill="#2A2230" />}
        {kind !== 'cachorro' && <path d="M94 96 h12 l-6 7 z" fill={sheep ? '#B5677A' : '#E57A93'} />}
        {kind === 'gato' && <g stroke={dark} strokeWidth="1.8" strokeLinecap="round"><path d="M84 100 l-26 -4 M84 106 l-26 4 M116 100 l26 -4 M116 106 l26 4" /></g>}
        <Mouth mood={mood} kind={kind} />
        {mood === 'triste' && <path d="M68 96 q-4 10 0 14 q4 -4 0 -14" fill="#7FC4FF" />}
        {mood === 'apertado' && <path d="M146 54 q-6 10 0 14 q6 -4 0 -14" fill="#7FC4FF" />}
        <Clothes outfit={outfit} layer="face" />
        <Clothes outfit={outfit} layer="head" />
      </g>
      {dirty && (
        <g fill="#7A5A34" opacity=".75" className="pet-dirt">
          <ellipse cx="70" cy="160" rx="9" ry="6" /><ellipse cx="130" cy="186" rx="8" ry="5" /><ellipse cx="128" cy="60" rx="6" ry="4" /><circle cx="86" cy="196" r="4" />
        </g>
      )}
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

/** Cocô e xixi no chão. */
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
