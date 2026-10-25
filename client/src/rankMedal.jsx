// Medalhas e troféus do ranking finalizado (icon "rank:<tabela>:<colocação>"). Cada tabela tem o seu
// desenho (desbravador, liderança, unidade e clube); a cor é da colocação (ouro, prata, bronze) e o ano
// aparece na faixa.
import { useId } from 'react';

const METALS = {
  1: ['#FFF3B0', '#F5B700', '#8A5A00'],
  2: ['#FFFFFF', '#B8C2CD', '#4F5B68'],
  3: ['#FAD2AE', '#C9772F', '#5E2F0B'],
};
const RIBBON = {
  membros: ['#D62828', '#0B3D91'],
  lideranca: ['#0B3D91', '#F5B700'],
};

export const isRankIcon = (icon) => typeof icon === 'string' && icon.startsWith('rank:');

function Defs({ id, pos }) {
  const [hi, mid, lo] = METALS[pos] || METALS[1];
  return (
    <defs>
      <radialGradient id={`${id}m`} cx="35%" cy="28%" r="80%">
        <stop offset="0" stopColor={hi} />
        <stop offset=".55" stopColor={mid} />
        <stop offset="1" stopColor={lo} />
      </radialGradient>
      <linearGradient id={`${id}l`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={hi} />
        <stop offset=".5" stopColor={mid} />
        <stop offset="1" stopColor={lo} />
      </linearGradient>
    </defs>
  );
}

/** Faixa com o ano embaixo. */
const YearBand = ({ y, year, dark }) => (
  <g>
    <path d={`M14 ${y} h72 l-5 7 l5 7 h-72 l5 -7z`} fill={dark} />
    <text x="50" y={y + 10} textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff" fontFamily="Poppins, Inter, sans-serif" letterSpacing=".5">{year}</text>
  </g>
);

const Star = ({ cx, cy, r, fill }) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
  });
  return <polygon points={pts.join(' ')} fill={fill} />;
};

/** Ramos de louro em volta da medalha. */
const Laurel = ({ cx, cy, r, color }) => (
  <g fill={color} opacity=".9">
    {Array.from({ length: 7 }, (_, i) => {
      const a = (Math.PI * (0.62 + i * 0.075));
      const b = (Math.PI * (0.38 - i * 0.075));
      return [a, b].map((t, k) => (
        <ellipse key={`${i}${k}`} cx={cx + r * Math.cos(t)} cy={cy + r * Math.sin(t)} rx="2.2" ry="4.6"
          transform={`rotate(${(t * 180) / Math.PI + 90 + (k ? -25 : 25)} ${cx + r * Math.cos(t)} ${cy + r * Math.sin(t)})`} />
      ));
    })}
  </g>
);

function PersonMedal({ id, kind, pos, year }) {
  const [, , lo] = METALS[pos] || METALS[1];
  const [r1, r2] = RIBBON[kind];
  const leader = kind === 'lideranca';
  return (
    <>
      <path d="M30 0 h16 l10 34 h-16z" fill={r1} />
      <path d="M54 0 h16 l-10 34 h-16z" fill={r2} />
      <path d="M30 0 h16 l2 7 h-16z" fill="rgba(0,0,0,.18)" />
      {leader ? (
        // Liderança: estrela de 8 pontas com a bússola no meio.
        <g>
          <polygon points="50,28 57,40 71,37 66,51 78,59 66,67 71,81 57,78 50,90 43,78 29,81 34,67 22,59 34,51 29,37 43,40" fill={`url(#${id}l)`} stroke={lo} strokeWidth="1.2" />
          <circle cx="50" cy="59" r="16" fill={`url(#${id}m)`} stroke={lo} strokeWidth="1.2" />
          <polygon points="50,46 54,59 50,72 46,59" fill={lo} />
          <polygon points="37,59 50,55 63,59 50,63" fill={lo} opacity=".55" />
        </g>
      ) : (
        // Desbravador: medalha redonda com louros e estrela.
        <g>
          <circle cx="50" cy="60" r="27" fill={`url(#${id}m)`} stroke={lo} strokeWidth="1.5" />
          <circle cx="50" cy="60" r="21" fill="none" stroke={lo} strokeWidth="1" opacity=".55" />
          <Laurel cx={50} cy={60} r={23.5} color={lo} />
          <Star cx={50} cy={57} r={11} fill={lo} />
        </g>
      )}
      {!leader && <text x="50" y="76" textAnchor="middle" fontSize="8" fontWeight="900" fill={lo} fontFamily="Poppins, Inter, sans-serif">{pos}º</text>}
      <YearBand y={97} year={year} dark={lo} />
    </>
  );
}

function Trophy({ id, kind, pos, year }) {
  const [, , lo] = METALS[pos] || METALS[1];
  const club = kind === 'clubes';
  return (
    <>
      {/* Alças */}
      <path d={club ? 'M24 22 c-16 0 -16 26 6 30' : 'M28 24 c-12 0 -12 20 4 24'} fill="none" stroke={`url(#${id}l)`} strokeWidth="5" strokeLinecap="round" />
      <path d={club ? 'M76 22 c16 0 16 26 -6 30' : 'M72 24 c12 0 12 20 -4 24'} fill="none" stroke={`url(#${id}l)`} strokeWidth="5" strokeLinecap="round" />
      {/* Taça */}
      <path d={club ? 'M22 14 h56 v10 c0 22 -12 34 -28 36 c-16 -2 -28 -14 -28 -36z' : 'M27 16 h46 v8 c0 19 -10 30 -23 32 c-13 -2 -23 -13 -23 -32z'} fill={`url(#${id}m)`} stroke={lo} strokeWidth="1.4" />
      <ellipse cx="50" cy={club ? 14 : 16} rx={club ? 28 : 23} ry="3.4" fill={lo} opacity=".45" />
      {/* Emblema: barraca (clube) ou bandeira (unidade) */}
      {club
        ? <g fill={lo}><polygon points="50,24 38,46 62,46" /><polygon points="50,32 45,46 55,46" fill={`url(#${id}m)`} /></g>
        : <g fill={lo}><rect x="43" y="24" width="2.4" height="22" /><path d="M45.4 25 h13 l-3.5 5 l3.5 5 h-13z" /></g>}
      {/* Haste e base */}
      <rect x="46" y={club ? 59 : 55} width="8" height={club ? 12 : 13} fill={`url(#${id}l)`} />
      <path d={club ? 'M34 71 h32 l4 10 h-40z' : 'M37 68 h26 l3 9 h-32z'} fill={`url(#${id}l)`} stroke={lo} strokeWidth="1" />
      <rect x={club ? 24 : 28} y={club ? 81 : 77} width={club ? 52 : 44} height="10" rx="2" fill={lo} />
      <text x="50" y={club ? 89 : 85} textAnchor="middle" fontSize="7.5" fontWeight="900" fill="#fff" fontFamily="Poppins, Inter, sans-serif">{pos}º LUGAR</text>
      <YearBand y={97} year={year} dark={lo} />
    </>
  );
}

/** Desenho da medalha/troféu do ranking. icon = "rank:membros:1". */
export function RankMedal({ icon, year, size = 64 }) {
  const id = useId().replace(/:/g, '');
  const [, kind, p] = String(icon).split(':');
  const pos = Number(p) || 1;
  const Art = kind === 'unidades' || kind === 'clubes' ? Trophy : PersonMedal;
  return (
    <svg viewBox="0 0 100 114" width={size} height={size * 1.14} role="img" aria-label={`${pos}º lugar${year ? ` em ${year}` : ''}`} className="rank-medal">
      <Defs id={id} pos={pos} />
      <Art id={id} kind={RIBBON[kind] || kind === 'unidades' || kind === 'clubes' ? kind : 'membros'} pos={pos} year={year || ''} />
    </svg>
  );
}
