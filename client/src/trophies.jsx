// Troféus (rankings finalizados) e medalhas (mini-jogos) personalizados: quem finaliza escolhe o
// modelo, a cor, a base, o emblema, a fita, o título e o ano. O desenho é feito aqui, em SVG.
import { useId } from 'react';

export const TROPHY_MODELS = [
  ['classica', 'Taça clássica'], ['copa', 'Copa grande'], ['taca-alta', 'Taça alta'], ['louros', 'Taça com louros'],
  ['estrela', 'Estrela'], ['globo', 'Globo'], ['escudo', 'Escudo'], ['chama', 'Tocha'], ['livro', 'Bíblia aberta'],
];
export const MEDAL_MODELS = [
  ['redonda', 'Redonda'], ['louros', 'Com louros'], ['estrela', 'Estrela'], ['escudo', 'Escudo'], ['hexagono', 'Hexágono'], ['engrenagem', 'Engrenagem'],
];
export const COLORS = [
  ['podio', 'Ouro, prata e bronze'], ['ouro', 'Ouro'], ['prata', 'Prata'], ['bronze', 'Bronze'], ['ouro-rosa', 'Ouro rosé'],
  ['azul', 'Azul'], ['vermelho', 'Vermelho'], ['verde', 'Verde'], ['roxo', 'Roxo'], ['rosa', 'Rosa'], ['preto', 'Preto'], ['cristal', 'Cristal'],
];
export const BASES = [
  ['madeira', 'Madeira'], ['marmore-preto', 'Mármore preto'], ['marmore-branco', 'Mármore branco'], ['azul', 'Azul DBV'],
  ['vermelho', 'Vermelho'], ['dourada', 'Dourada'], ['cristal', 'Cristal'],
];
export const EMBLEMS = [
  ['estrela', 'Estrela'], ['dbv', 'Triângulo DBV'], ['biblia', 'Bíblia'], ['bussola', 'Bússola'], ['barraca', 'Barraca'],
  ['chama', 'Chama'], ['coroa', 'Coroa'], ['bandeira', 'Bandeira'], ['coracao', 'Coração'], ['controle', 'Controle'], ['nenhum', 'Nenhum'],
];
export const RIBBONS = [
  ['dbv', 'Vermelho e azul'], ['brasil', 'Verde e amarelo'], ['azul', 'Azul'], ['vermelho', 'Vermelho'], ['verde', 'Verde'], ['amarelo', 'Amarelo'], ['roxo', 'Roxo'],
];

const PAL = {
  ouro: ['#FFF3B0', '#F5B700', '#8A5A00'], prata: ['#FFFFFF', '#B8C2CD', '#4F5B68'], bronze: ['#FAD2AE', '#C9772F', '#5E2F0B'],
  'ouro-rosa': ['#FFE4E6', '#E8A598', '#8F4338'], azul: ['#BFDBFE', '#2563EB', '#1E3A8A'], vermelho: ['#FECACA', '#DC2626', '#7F1D1D'],
  verde: ['#BBF7D0', '#16A34A', '#14532D'], roxo: ['#E9D5FF', '#9333EA', '#4C1D95'], rosa: ['#FBCFE8', '#EC4899', '#831843'],
  preto: ['#9CA3AF', '#1F2937', '#030712'], cristal: ['#FFFFFF', '#BAE6FD', '#0EA5E9'],
};
const BASE_PAL = {
  madeira: ['#B07A47', '#5C3317'], 'marmore-preto': ['#4B5563', '#0F172A'], 'marmore-branco': ['#FFFFFF', '#CBD5E1'], azul: ['#2347A6', '#0B1F4D'],
  vermelho: ['#C62828', '#5F0F0F'], dourada: ['#FCD34D', '#A16207'], cristal: ['#F0F9FF', '#7DD3FC'],
};
const RIB = { dbv: ['#D62828', '#0B3D91'], brasil: ['#16A34A', '#FACC15'], azul: ['#3B82F6', '#1E3A8A'], vermelho: ['#EF4444', '#991B1B'], verde: ['#22C55E', '#14532D'], amarelo: ['#FACC15', '#B45309'], roxo: ['#A855F7', '#581C87'] };
const PODIO = { 1: 'ouro', 2: 'prata', 3: 'bronze' };

export const metalOf = (color, pos) => PAL[color === 'podio' || !PAL[color] ? PODIO[pos] || 'ouro' : color];

const starPts = (cx, cy, r, n = 5, inner = 0.45) => Array.from({ length: n * 2 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / n;
  const rr = i % 2 ? r * inner : r;
  return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
}).join(' ');

/** Emblema no meio do troféu/medalha. */
function Emblem({ kind, cx, cy, r, fill, bg }) {
  const s = r / 12;
  const t = (x, y) => `${(cx + x * s).toFixed(1)},${(cy + y * s).toFixed(1)}`;
  switch (kind) {
    case 'nenhum': return null;
    case 'dbv': return <g><polygon points={`${t(0, -11)} ${t(11, 8)} ${t(-11, 8)}`} fill={fill} /><polygon points={`${t(0, -4)} ${t(5, 5)} ${t(-5, 5)}`} fill={bg} /></g>;
    case 'biblia': return <g><rect x={cx - 9 * s} y={cy - 11 * s} width={18 * s} height={22 * s} rx={2 * s} fill={fill} /><rect x={cx - 1.3 * s} y={cy - 7 * s} width={2.6 * s} height={12 * s} fill={bg} /><rect x={cx - 5 * s} y={cy - 3.5 * s} width={10 * s} height={2.6 * s} fill={bg} /></g>;
    case 'bussola': return <g><circle cx={cx} cy={cy} r={11 * s} fill="none" stroke={fill} strokeWidth={2.4 * s} /><polygon points={`${t(0, -9)} ${t(3, 0)} ${t(0, 9)} ${t(-3, 0)}`} fill={fill} /></g>;
    case 'barraca': return <g><polygon points={`${t(0, -10)} ${t(12, 9)} ${t(-12, 9)}`} fill={fill} /><polygon points={`${t(0, -1)} ${t(4, 9)} ${t(-4, 9)}`} fill={bg} /></g>;
    case 'chama': return <path d={`M${t(0, -12)} C${t(9, -3)} ${t(9, 6)} ${t(0, 11)} C${t(-9, 6)} ${t(-8, -2)} ${t(-3, -5)} C${t(-3, 0)} ${t(-1, 2)} ${t(1, 1)} C${t(3, -3)} ${t(1, -7)} ${t(0, -12)}Z`} fill={fill} />;
    case 'coroa': return <g><polygon points={`${t(-11, 7)} ${t(-12, -7)} ${t(-5, -1)} ${t(0, -10)} ${t(5, -1)} ${t(12, -7)} ${t(11, 7)}`} fill={fill} /><rect x={cx - 11 * s} y={cy + 8 * s} width={22 * s} height={3.2 * s} fill={fill} /></g>;
    case 'bandeira': return <g><rect x={cx - 8 * s} y={cy - 11 * s} width={2.4 * s} height={22 * s} fill={fill} /><path d={`M${cx - 5.6 * s} ${cy - 10 * s} H${cx + 10 * s} L${cx + 6 * s} ${cy - 5 * s} L${cx + 10 * s} ${cy} H${cx - 5.6 * s}Z`} fill={fill} /></g>;
    case 'coracao': return <path d={`M${t(0, 10)} C${t(-14, 0)} ${t(-10, -12)} ${t(0, -5)} C${t(10, -12)} ${t(14, 0)} ${t(0, 10)}Z`} fill={fill} />;
    case 'controle': return <g><rect x={cx - 12 * s} y={cy - 6 * s} width={24 * s} height={13 * s} rx={6 * s} fill={fill} /><rect x={cx - 8.5 * s} y={cy - 1.2 * s} width={7 * s} height={2.4 * s} fill={bg} /><rect x={cx - 6.2 * s} y={cy - 3.5 * s} width={2.4 * s} height={7 * s} fill={bg} /><circle cx={cx + 5 * s} cy={cy - 1.5 * s} r={1.6 * s} fill={bg} /><circle cx={cx + 8 * s} cy={cy + 1.5 * s} r={1.6 * s} fill={bg} /></g>;
    default: return <polygon points={starPts(cx, cy, 12 * s)} fill={fill} />;
  }
}

/** Ramos de louro em volta de um ponto. */
const Laurel = ({ cx, cy, r, color, from = 0.6, step = 0.08, n = 7 }) => (
  <g fill={color}>
    {Array.from({ length: n }, (_, i) => [Math.PI * (from + i * step), Math.PI * (1 - from - i * step)]).flat().map((a, i) => {
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      return <ellipse key={i} cx={x} cy={y} rx="2.6" ry="5.4" transform={`rotate(${(a * 180) / Math.PI + 90 + (i % 2 ? -28 : 28)} ${x} ${y})`} />;
    })}
  </g>
);

function Defs({ id, metal, base, ribbon }) {
  const [hi, mid, lo] = metal;
  return (
    <defs>
      <linearGradient id={`${id}m`} x1="0" y1="0" x2="1" y2="0.3">
        <stop offset="0" stopColor={lo} /><stop offset=".22" stopColor={mid} /><stop offset=".42" stopColor={hi} />
        <stop offset=".62" stopColor={mid} /><stop offset="1" stopColor={lo} />
      </linearGradient>
      <radialGradient id={`${id}r`} cx="38%" cy="30%" r="80%"><stop offset="0" stopColor={hi} /><stop offset=".55" stopColor={mid} /><stop offset="1" stopColor={lo} /></radialGradient>
      {base && <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={base[0]} /><stop offset="1" stopColor={base[1]} /></linearGradient>}
      {ribbon && <linearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={ribbon[0]} /><stop offset=".5" stopColor={ribbon[0]} /><stop offset=".5" stopColor={ribbon[1]} /><stop offset="1" stopColor={ribbon[1]} /></linearGradient>}
    </defs>
  );
}

/** Corpo do troféu (de cima até y=118) e onde fica o emblema. */
function Body({ model, id, lo, hi }) {
  const M = `url(#${id}m)`;
  const R = `url(#${id}r)`;
  const handle = (d, w = 5) => <path d={d} fill="none" stroke={M} strokeWidth={w} strokeLinecap="round" />;
  const stem = (y1, y2, w = 10) => <rect x={60 - w / 2} y={y1} width={w} height={y2 - y1} fill={M} />;
  const foot = <path d="M42 106 h36 l5 12 h-46z" fill={M} stroke={lo} strokeWidth=".8" />;
  switch (model) {
    case 'copa': return { emb: [60, 46, 14], el: (
      <g>
        {handle('M24 26 c-20 2 -18 36 8 40', 6)}{handle('M96 26 c20 2 18 36 -8 40', 6)}
        <path d="M22 20 h76 v8 c0 34 -18 50 -38 52 c-20 -2 -38 -18 -38 -52z" fill={M} stroke={lo} strokeWidth="1" />
        <ellipse cx="60" cy="20" rx="38" ry="5" fill={R} stroke={lo} strokeWidth=".8" /><circle cx="60" cy="11" r="5" fill={R} />
        {stem(80, 106, 9)}<ellipse cx="60" cy="92" rx="9" ry="4" fill={R} />{foot}
      </g>) };
    case 'taca-alta': return { emb: [60, 34, 11], el: (
      <g>
        <path d="M36 8 h48 c0 40 -9 58 -24 62 c-15 -4 -24 -22 -24 -62z" fill={M} stroke={lo} strokeWidth="1" />
        <ellipse cx="60" cy="8" rx="24" ry="3.4" fill={lo} opacity=".5" />
        {stem(70, 106, 6)}<circle cx="60" cy="88" r="6" fill={R} />{foot}
      </g>) };
    case 'louros': return { emb: [60, 40, 12], el: (
      <g>
        <Laurel cx={60} cy={52} r={42} color={`url(#${id}m)`} from={0.55} step={0.09} n={6} />
        {handle('M34 24 c-12 0 -12 22 4 26')}{handle('M86 24 c12 0 12 22 -4 26')}
        <path d="M32 18 h56 v8 c0 24 -12 38 -28 40 c-16 -2 -28 -16 -28 -40z" fill={M} stroke={lo} strokeWidth="1" />
        {stem(66, 106, 9)}{foot}
      </g>) };
    case 'estrela': return { emb: [60, 48, 9], el: (
      <g>
        <polygon points={starPts(60, 48, 40, 5, 0.47)} fill={M} stroke={lo} strokeWidth="1.2" strokeLinejoin="round" />
        <polygon points={starPts(60, 48, 30, 5, 0.47)} fill="none" stroke={hi} strokeOpacity=".5" strokeWidth="1" />
        {stem(80, 106, 10)}<rect x="52" y="86" width="16" height="4" rx="2" fill={R} /><rect x="52" y="96" width="16" height="4" rx="2" fill={R} />{foot}
      </g>) };
    case 'globo': return { emb: [60, 46, 11], el: (
      <g>
        <circle cx="60" cy="46" r="34" fill={R} stroke={lo} strokeWidth="1.2" />
        <ellipse cx="60" cy="46" rx="14" ry="34" fill="none" stroke={lo} strokeOpacity=".45" strokeWidth="1.2" />
        <path d="M27 36 h66 M27 56 h66 M60 12 v68" stroke={lo} strokeOpacity=".45" strokeWidth="1.2" fill="none" />
        <path d="M22 50 a38 38 0 0 0 76 0" fill="none" stroke={M} strokeWidth="4" />
        {stem(84, 106, 10)}{foot}
      </g>) };
    case 'escudo': return { emb: [60, 48, 15], el: (
      <g>
        <path d="M28 12 h64 v34 c0 26 -14 40 -32 50 c-18 -10 -32 -24 -32 -50z" fill={M} stroke={lo} strokeWidth="1.2" />
        <path d="M35 19 h50 v27 c0 21 -11 32 -25 40 c-14 -8 -25 -19 -25 -40z" fill="none" stroke={hi} strokeOpacity=".55" strokeWidth="1.2" />
        {stem(94, 106, 12)}{foot}
      </g>) };
    case 'chama': return { emb: [60, 66, 8], el: (
      <g>
        <path d="M60 2 C80 22 78 42 60 54 C42 42 40 26 52 16 C52 28 58 30 60 26 C66 18 62 10 60 2Z" fill="#F97316" />
        <path d="M60 18 C70 30 68 42 60 50 C52 42 52 34 56 28 C57 34 60 34 61 31 C63 26 62 22 60 18Z" fill="#FDE047" />
        <path d="M40 52 h40 l-6 24 h-28z" fill={M} stroke={lo} strokeWidth="1" />
        <path d="M48 76 h24 l-6 30 h-12z" fill={M} stroke={lo} strokeWidth=".8" />{foot}
      </g>) };
    case 'livro': return { emb: [60, 92, 7], el: (
      <g>
        <path d="M60 30 C46 22 30 22 18 26 v40 c12 -4 28 -4 42 4z" fill={R} stroke={lo} strokeWidth="1" />
        <path d="M60 30 C74 22 90 22 102 26 v40 c-12 -4 -28 -4 -42 4z" fill={M} stroke={lo} strokeWidth="1" />
        {[34, 40, 46, 52].map((y) => <path key={y} d={`M26 ${y} c10 -3 20 -3 28 1 M66 ${y + 1} c8 -4 18 -4 28 -1`} stroke={lo} strokeOpacity=".4" strokeWidth="1.2" fill="none" />)}
        <path d="M56 70 h8 v4 h-8z" fill={lo} />
        {stem(74, 106, 14)}{foot}
      </g>) };
    default: return { emb: [60, 42, 13], el: (
      <g>
        {handle('M30 22 c-15 0 -15 26 5 30')}{handle('M90 22 c15 0 15 26 -5 30')}
        <path d="M28 14 h64 v10 c0 26 -14 42 -32 44 c-18 -2 -32 -18 -32 -44z" fill={M} stroke={lo} strokeWidth="1" />
        <ellipse cx="60" cy="14" rx="32" ry="4" fill={lo} opacity=".45" />
        {stem(68, 106, 9)}<ellipse cx="60" cy="84" rx="8" ry="3.4" fill={`url(#${id}r)`} />{foot}
      </g>) };
  }
}

/** Troféu personalizado. design: { model, color, base, emblem, year }, pos: 1, 2 ou 3. */
export function Trophy({ design = {}, pos = 1, size = 90 }) {
  const id = useId().replace(/:/g, '');
  const metal = metalOf(design.color || 'podio', pos);
  const base = BASE_PAL[design.base] || BASE_PAL.madeira;
  const { el, emb } = Body({ model: design.model, id, lo: metal[2], hi: metal[0] });
  const plaqueText = design.base === 'marmore-branco' || design.base === 'cristal' || design.base === 'dourada' ? '#1F2937' : '#FDE68A';
  return (
    <svg viewBox="0 0 120 152" width={size} height={size * 152 / 120} role="img" aria-label={`Troféu de ${pos}º lugar`} className="trophy-svg">
      <Defs id={id} metal={metal} base={base} />
      <ellipse cx="60" cy="148" rx="46" ry="3.5" fill="#000" opacity=".18" />
      {el}
      {emb && <Emblem kind={design.emblem || 'estrela'} cx={emb[0]} cy={emb[1]} r={emb[2]} fill={metal[2]} bg={metal[1]} />}
      {/* Base com a plaquinha */}
      <path d="M26 118 h68 l4 8 h-76z" fill={`url(#${id}b)`} />
      <rect x="20" y="126" width="80" height="20" rx="3" fill={`url(#${id}b)`} />
      <rect x="34" y="129.5" width="52" height="13" rx="2" fill="#000" opacity=".22" />
      <text x="60" y="136.6" textAnchor="middle" fontSize="6.4" fontWeight="900" fill={plaqueText} fontFamily="Poppins, Inter, sans-serif">{pos}º LUGAR</text>
      <text x="60" y="141.8" textAnchor="middle" fontSize="4.6" fontWeight="700" fill={plaqueText} fontFamily="Poppins, Inter, sans-serif" letterSpacing=".6">{design.year || ''}</text>
    </svg>
  );
}

/** Corpo da medalha (centro em 60,92). */
function MedalShape({ model, id, lo, hi }) {
  const M = `url(#${id}r)`;
  switch (model) {
    case 'estrela': return <polygon points={starPts(60, 94, 40, 8, 0.72)} fill={M} stroke={lo} strokeWidth="1.2" strokeLinejoin="round" />;
    case 'escudo': return <path d="M28 60 h64 v30 c0 24 -14 36 -32 44 c-18 -8 -32 -20 -32 -44z" fill={M} stroke={lo} strokeWidth="1.2" />;
    case 'hexagono': return <polygon points="60,54 94,74 94,114 60,134 26,114 26,74" fill={M} stroke={lo} strokeWidth="1.2" />;
    case 'engrenagem': return (
      <g>
        {Array.from({ length: 12 }, (_, i) => <rect key={i} x="55" y="52" width="10" height="12" rx="2" fill={M} transform={`rotate(${i * 30} 60 94)`} />)}
        <circle cx="60" cy="94" r="34" fill={M} stroke={lo} strokeWidth="1.2" />
      </g>);
    case 'louros': return <g><Laurel cx={60} cy={94} r={36} color={lo} from={0.58} step={0.075} n={7} /><circle cx="60" cy="94" r="30" fill={M} stroke={lo} strokeWidth="1.2" /></g>;
    default: return <g><circle cx="60" cy="94" r="36" fill={M} stroke={lo} strokeWidth="1.4" /><circle cx="60" cy="94" r="29" fill="none" stroke={hi} strokeOpacity=".6" strokeWidth="1.2" /></g>;
  }
}

/** Medalha personalizada dos mini-jogos. design: { model, color, ribbon, emblem, year }. */
export function GameMedal({ design = {}, pos = 1, size = 80 }) {
  const id = useId().replace(/:/g, '');
  const metal = metalOf(design.color || 'podio', pos);
  const rib = RIB[design.ribbon] || RIB.dbv;
  return (
    <svg viewBox="0 0 120 150" width={size} height={size * 150 / 120} role="img" aria-label={`Medalha de ${pos}º lugar`} className="trophy-svg">
      <Defs id={id} metal={metal} />
      <path d="M36 0 h20 l14 52 h-20z" fill={rib[0]} />
      <path d="M64 0 h20 l-14 52 h-20z" fill={rib[1]} />
      <path d="M36 0 h20 l3 10 h-20z M64 0 h20 l-3 10 h-20z" fill="#000" opacity=".15" />
      <rect x="44" y="48" width="32" height="8" rx="3" fill={`url(#${id}m)`} />
      <MedalShape model={design.model} id={id} lo={metal[2]} hi={metal[0]} />
      <Emblem kind={design.emblem || 'controle'} cx={60} cy={88} r={13} fill={metal[2]} bg={metal[1]} />
      <text x="60" y="114" textAnchor="middle" fontSize="10" fontWeight="900" fill={metal[2]} fontFamily="Poppins, Inter, sans-serif">{pos}º</text>
      {design.year ? (
        <g>
          <path d="M30 132 h60 l-4 6 l4 6 h-60 l4 -6z" fill={metal[2]} />
          <text x="60" y="141" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="#fff" fontFamily="Poppins, Inter, sans-serif" letterSpacing=".5">{design.year}</text>
        </g>
      ) : null}
    </svg>
  );
}

/** Mostra o prêmio certo: medalha (jogos) ou troféu (rankings). */
export const Prize = ({ kind, design, pos, size }) => (kind === 'medalha' ? <GameMedal design={design} pos={pos} size={size} /> : <Trophy design={design} pos={pos} size={size} />);

/** Amostra de cor (para os botões de escolha). */
export const colorSwatch = (c) => (c === 'podio'
  ? 'conic-gradient(#F5B700 0 33%, #B8C2CD 0 66%, #C9772F 0)'
  : `linear-gradient(135deg, ${PAL[c][0]}, ${PAL[c][1]} 55%, ${PAL[c][2]})`);
export const baseSwatch = (b) => `linear-gradient(180deg, ${BASE_PAL[b][0]}, ${BASE_PAL[b][1]})`;
export const ribbonSwatch = (r) => `linear-gradient(90deg, ${RIB[r][0]} 50%, ${RIB[r][1]} 50%)`;
