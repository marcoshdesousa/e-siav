import { useId } from 'react';
import './albumcover.css';

/* =========================================================
   Capas dos álbuns + emblema do Álbum Bíblico
   BibleEmblem: Bíblia aberta com raios de luz, moldura dourada em louros.
   AlbumCover: capa de livro em couro com ornamentos em dourado.
   Tudo em SVG/CSS puro (classes cov-). Não importa StickerArt.jsx.
   ========================================================= */

const GOLD_STOPS = [
  ['0', '#FFF3BF'],
  ['.28', '#F9C71D'],
  ['.52', '#B9800F'],
  ['.74', '#F6D466'],
  ['1', '#8F6209'],
];

function useSvgId(prefix) {
  return prefix + useId().replace(/[^a-zA-Z0-9_-]/g, '');
}

function GoldGradient({ id, x1 = 0, y1 = 0, x2 = 1, y2 = 1 }) {
  return (
    <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
      {GOLD_STOPS.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />)}
    </linearGradient>
  );
}

function starPath(cx, cy, R, r, n = 5, rot = -90) {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const rad = ((rot + (i * 180) / n) * Math.PI) / 180;
    const len = i % 2 ? r : R;
    d += `${i ? 'L' : 'M'}${(cx + len * Math.cos(rad)).toFixed(2)} ${(cy + len * Math.sin(rad)).toFixed(2)}`;
  }
  return d + 'Z';
}

const LEAF = 'M0 0C2.6-2.6 3-7.4 0-12C-3-7.4-2.6-2.6 0 0Z';

/* folhas de louro ao longo de um círculo (cx, cy, r), dos dois lados, subindo até o topo */
function laurelLeaves(cx, cy, r, from = 100, to = 250, step = 11, spread = 3.2, scale = 1) {
  const out = [];
  for (let t = from; t <= to; t += step) {
    for (const side of [-1, 1]) {
      // lado esquerdo: ângulo t (sobe por 180°); lado direito: espelhado (180 - t)
      const ang = side < 0 ? t : 180 - t;
      const rot = side < 0 ? t + 180 : ang;
      for (const k of [-1, 1]) {
        const rr = r + k * spread;
        const rad = (ang * Math.PI) / 180;
        const x = cx + rr * Math.cos(rad);
        const y = cy + rr * Math.sin(rad);
        const tilt = rot + k * side * -22;
        out.push(`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${tilt.toFixed(1)}) scale(${scale})`);
      }
    }
  }
  return out;
}

const EMBLEM_LEAVES = laurelLeaves(100, 100, 88, 104, 256, 10.5, 3.4, 0.82);
const RAYS = Array.from({ length: 18 }, (_, i) => {
  const a = ((i * 20 - 90) * Math.PI) / 180;
  const w = (3.6 * Math.PI) / 180;
  const R = 95;
  const cx = 100;
  const cy = 112;
  return `M${cx} ${cy}L${(cx + R * Math.cos(a - w)).toFixed(2)} ${(cy + R * Math.sin(a - w)).toFixed(2)}L${(cx + R * Math.cos(a + w)).toFixed(2)} ${(cy + R * Math.sin(a + w)).toFixed(2)}Z`;
});

/* conteúdo do emblema em coordenadas 0..200 (para reutilizar dentro da capa) */
function EmblemGraphic({ uid }) {
  const g = (n) => `${uid}-${n}`;
  const url = (n) => `url(#${g(n)})`;
  return (
    <g>
      <defs>
        <GoldGradient id={g('gold')} />
        <GoldGradient id={g('gold2')} x1={1} y1={0} x2={0} y2={1} />
        <radialGradient id={g('disk')} cx="50%" cy="54%" r="55%">
          <stop offset="0" stopColor="#4F7BD6" />
          <stop offset=".45" stopColor="#2B54B0" />
          <stop offset="1" stopColor="#0B1F55" />
        </radialGradient>
        <radialGradient id={g('ray')} cx="100" cy="112" r="82" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFF1B3" stopOpacity=".95" />
          <stop offset=".55" stopColor="#F9C71D" stopOpacity=".38" />
          <stop offset="1" stopColor="#F9C71D" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={g('glow')} cx="100" cy="104" r="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFBE6" stopOpacity=".95" />
          <stop offset=".5" stopColor="#FFE37A" stopOpacity=".45" />
          <stop offset="1" stopColor="#FFE37A" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={g('pageL')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFDF4" />
          <stop offset=".75" stopColor="#F8EED3" />
          <stop offset="1" stopColor="#D9C59A" />
        </linearGradient>
        <linearGradient id={g('pageR')} x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#FFFDF4" />
          <stop offset=".75" stopColor="#F8EED3" />
          <stop offset="1" stopColor="#D9C59A" />
        </linearGradient>
        <linearGradient id={g('cover')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#B3262C" />
          <stop offset="1" stopColor="#6E1015" />
        </linearGradient>
        <clipPath id={g('clip')}><circle cx="100" cy="100" r="79" /></clipPath>
      </defs>

      {/* moldura: aro dourado + faixa escura com louros + filete interno */}
      <circle cx="100" cy="100" r="99" fill={url('gold')} />
      <circle cx="100" cy="100" r="95.2" fill="#0A1C4A" />
      <circle cx="100" cy="100" r="95.2" fill="none" stroke="#000" strokeOpacity=".35" strokeWidth="1" />
      <g fill={url('gold2')}>
        {EMBLEM_LEAVES.map((t) => <path key={t} d={LEAF} transform={t} />)}
      </g>
      <path d="M100 8.2l3.2 3.6-3.2 3.6-3.2-3.6z" fill={url('gold')} />
      <circle cx="100" cy="190.6" r="3" fill={url('gold')} />
      <circle cx="100" cy="100" r="82.4" fill={url('gold2')} />

      {/* céu com raios de luz */}
      <circle cx="100" cy="100" r="79" fill={url('disk')} />
      <g clipPath={url('clip')}>
        <g fill={url('ray')}>
          {RAYS.map((d) => <path key={d} d={d} />)}
        </g>
        <circle cx="100" cy="104" r="46" fill={url('glow')} />

        {/* chama / estrela de luz */}
        <circle cx="100" cy="58" r="13" fill="#FFF6C8" opacity=".35" />
        <path d="M100 37C101.6 51 103.4 55.6 113 58C103.4 60.4 101.6 65 100 79C98.4 65 96.6 60.4 87 58C96.6 55.6 98.4 51 100 37Z" fill={url('gold')} />
        <path d="M100 47C100.8 54.4 101.8 56.6 106 58C101.8 59.4 100.8 61.6 100 69C99.2 61.6 98.2 59.4 94 58C98.2 56.6 99.2 54.4 100 47Z" fill="#FFFDF0" />

        {/* Bíblia aberta */}
        <g>
          <path d="M100 163C87 154.5 66 153 41 157.5L41 112C66 107.5 87 110 100 119Z" fill={url('cover')} />
          <path d="M100 163C113 154.5 134 153 159 157.5L159 112C134 107.5 113 110 100 119Z" fill={url('cover')} />
          <path d="M100 158.5C87.5 150.5 68 149 46 153L46 110C68 106 87.5 108 100 116Z" fill={url('gold')} />
          <path d="M100 158.5C112.5 150.5 132 149 154 153L154 110C132 106 112.5 108 100 116Z" fill={url('gold2')} />
          <g fill="none" stroke="#8F6209" strokeWidth=".7" strokeOpacity=".7">
            <path d="M100 155.6C87.5 147.8 68 146.4 47 150.3" />
            <path d="M100 155.6C112.5 147.8 132 146.4 153 150.3" />
          </g>
          <path d="M100 153C88 145 69.5 143.5 49 147.5L49 105.5C69.5 101.5 88 103 100 111Z" fill={url('pageL')} />
          <path d="M100 153C112 145 130.5 143.5 151 147.5L151 105.5C130.5 101.5 112 103 100 111Z" fill={url('pageR')} />
          <g fill="none" stroke="#5A6B8F" strokeOpacity=".45" strokeWidth="1.5" strokeLinecap="round">
            <path d="M56 113.5C70 111 83 112 93 117" />
            <path d="M56 120.5C70 118 83 119 93 124" />
            <path d="M56 127.5C70 125 83 126 93 131" />
            <path d="M56 134.5C68 132 78 133 86 136.5" />
            <path d="M144 113.5C130 111 117 112 107 117" />
            <path d="M144 120.5C130 118 117 119 107 124" />
            <path d="M144 127.5C130 125 117 126 107 131" />
            <path d="M144 134.5C132 132 122 133 114 136.5" />
          </g>
          <path d="M100 111V153" stroke="#B89A62" strokeWidth="1.2" />
          {/* fitinha marcadora */}
          <path d="M101 150L105 176L101.5 172L98 177L99 151Z" fill="#E92A2F" stroke="#8A1216" strokeWidth=".6" />
        </g>
      </g>
      {/* brilho do aro */}
      <circle cx="100" cy="100" r="98" fill="none" stroke="#FFF7D6" strokeOpacity=".55" strokeWidth=".8" />
    </g>
  );
}

export function BibleEmblem({ size = 120 }) {
  const uid = useSvgId('be');
  return (
    <svg
      className="cov-emblem"
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="img"
      aria-label="Emblema do Álbum Bíblico"
      focusable="false"
    >
      <EmblemGraphic uid={uid} />
    </svg>
  );
}

/* ---------- capa ---------- */

const BODY = 'M10 0H286Q300 0 300 14V386Q300 400 286 400H10Q0 400 0 390V10Q0 0 10 0Z';
const FILIGREE = [
  'M7 7C7 21 18 31 29 24C35 20 31 12 25.5 15C22 17 24.5 21.5 27.5 19.5',
  'M7 7C21 7 31 18 24 29C20 35 12 31 15 25.5C17 22 21.5 24.5 19.5 27.5',
  'M30 7H56M7 30V56',
  'M40 7C44 3 49 3 51 7M7 40C3 44 3 49 7 51',
];
const CORNERS = [
  'translate(57 25)',
  'translate(275 25) scale(-1 1)',
  'translate(57 375) scale(1 -1)',
  'translate(275 375) scale(-1 -1)',
];

const VARIANTS = {
  biblico: {
    label: 'Álbum Bíblico — 100 personagens da Bíblia',
    leather: ['#2B54B0', '#163A8A', '#0B2160'],
    spine: ['#081A45', '#1A3A86', '#06143A'],
  },
  palmares27: {
    label: 'Palmares 27 — Figurinhas dos desbravadores, em breve',
    leather: ['#D8343A', '#A8171E', '#6E0B10'],
    spine: ['#081A45', '#1A3A86', '#06143A'],
  },
};

function Divider({ y, fill }) {
  return (
    <g fill={fill}>
      <path d={`M120 ${y}H156`} stroke={fill} strokeWidth=".9" />
      <path d={`M176 ${y}H212`} stroke={fill} strokeWidth=".9" />
      <path d={`M166 ${y - 5}L171 ${y}L166 ${y + 5}L161 ${y}Z`} />
      <circle cx="154" cy={y} r="1.6" />
      <circle cx="178" cy={y} r="1.6" />
    </g>
  );
}

/* texto em dourado com relevo (sombra escura embaixo + luz em cima) */
function FoilText({ x = 166, y, size, fill, className = 'cov-t-serif', spacing = 0, weight = 700, style, children }) {
  const common = { x, textAnchor: 'middle', fontSize: size, fontWeight: weight, letterSpacing: spacing, className, style };
  return (
    <g>
      <text {...common} y={y + size * 0.045} fill="#000" fillOpacity=".55">{children}</text>
      <text {...common} y={y - size * 0.025} fill="#FFF8DC" fillOpacity=".45">{children}</text>
      <text {...common} y={y} fill={fill}>{children}</text>
    </g>
  );
}

function PathfinderMark({ uid }) {
  const g = (n) => `${uid}-${n}`;
  return (
    <g>
      <defs>
        <linearGradient id={g('tri')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E92A2F" />
          <stop offset="1" stopColor="#8E1016" />
        </linearGradient>
      </defs>
      <path d="M124 116H208L166 189Z" fill={`url(#${g('tri')})`} stroke={`url(#${g('gold')})`} strokeWidth="4" strokeLinejoin="round" />
      <path d="M135.5 122.5H196.5L166 175.5Z" fill="none" stroke="#FFE9A8" strokeOpacity=".7" strokeWidth="1" strokeLinejoin="round" />
      <path d={starPath(166, 141, 15, 6.3)} fill={`url(#${g('gold')})`} stroke="#7A5208" strokeWidth=".6" />
    </g>
  );
}

export function AlbumCover({ variant = 'biblico', width = 260, logo }) {
  const v = VARIANTS[variant] ? variant : 'biblico';
  const cfg = VARIANTS[v];
  const uid = useSvgId('cv');
  const g = (n) => `${uid}-${n}`;
  const url = (n) => `url(#${g(n)})`;
  const height = Math.round((width * 4) / 3);

  return (
    <div
      className={`cov cov-${v}`}
      style={{ width, height, '--cov-w': `${width}px` }}
      role="img"
      aria-label={cfg.label}
    >
      <svg className="cov-svg" viewBox="0 0 300 400" width={width} height={height} aria-hidden="true" focusable="false">
        <defs>
          <GoldGradient id={g('gold')} />
          <GoldGradient id={g('goldV')} x1={0} y1={0} x2={0} y2={1} />
          <linearGradient id={g('leather')} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={cfg.leather[0]} />
            <stop offset=".5" stopColor={cfg.leather[1]} />
            <stop offset="1" stopColor={cfg.leather[2]} />
          </linearGradient>
          <radialGradient id={g('vignette')} cx="58%" cy="42%" r="75%">
            <stop offset=".45" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity=".5" />
          </radialGradient>
          <linearGradient id={g('spine')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={cfg.spine[0]} />
            <stop offset=".4" stopColor={cfg.spine[1]} />
            <stop offset="1" stopColor={cfg.spine[2]} />
          </linearGradient>
          <linearGradient id={g('band')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity=".28" />
            <stop offset=".5" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity=".45" />
          </linearGradient>
          <filter id={g('grain')} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="3" seed="7" result="n" />
            <feDiffuseLighting in="n" surfaceScale="1.6" lightingColor="#fff" result="l">
              <feDistantLight azimuth="235" elevation="58" />
            </feDiffuseLighting>
            <feBlend in="SourceGraphic" in2="l" mode="multiply" result="m" />
            <feComposite in="m" in2="SourceGraphic" operator="in" />
          </filter>
          <clipPath id={g('body')}><path d={BODY} /></clipPath>
          <clipPath id={g('medal')}><circle cx="166" cy="140" r="50" /></clipPath>
          <radialGradient id={g('medalBg')} cx="50%" cy="45%" r="60%">
            <stop offset="0" stopColor="#2B54B0" />
            <stop offset="1" stopColor="#0A1C4A" />
          </radialGradient>
        </defs>

        {/* couro */}
        <g clipPath={url('body')}>
          <rect width="300" height="400" fill={url('leather')} filter={url('grain')} />
          <rect width="300" height="400" fill={url('vignette')} />
          {/* lombada arredondada */}
          <rect width="34" height="400" fill={url('spine')} filter={url('grain')} />
          <rect width="34" height="400" fill="none" />
          <path d="M0 0H34V400H0Z" fill="#fff" fillOpacity=".04" />
          <path d="M4 0V400" stroke="#fff" strokeOpacity=".1" strokeWidth="3" />
          {[58, 128, 272, 342].map((y) => (
            <g key={y}>
              <rect x="0" y={y} width="34" height="7" fill={url('spine')} />
              <rect x="0" y={y} width="34" height="7" fill={url('band')} />
            </g>
          ))}
          {/* dobradiça + costura */}
          <path d="M34 0V400" stroke="#000" strokeOpacity=".55" strokeWidth="2.4" />
          <path d="M37 0V400" stroke="#fff" strokeOpacity=".14" strokeWidth="1.4" />
          <path d="M42 8V392" stroke="#E9D9A6" strokeOpacity=".85" strokeWidth="1.3" strokeDasharray="5 3.5" strokeLinecap="round" />
          <path d="M43 8.6V392" stroke="#000" strokeOpacity=".35" strokeWidth=".8" strokeDasharray="5 3.5" />
          <path d="M28 8V392" stroke="#E9D9A6" strokeOpacity=".55" strokeWidth="1.1" strokeDasharray="5 3.5" strokeLinecap="round" />
          {/* costura do contorno */}
          <path d="M42 8H286Q292 8 292 14V386Q292 392 286 392H42" fill="none" stroke="#E9D9A6" strokeOpacity=".55" strokeWidth="1" strokeDasharray="5 3.5" strokeLinecap="round" />
          {/* bisel da borda */}
          <path d={BODY} fill="none" stroke="#fff" strokeOpacity=".18" strokeWidth="2" />
        </g>

        {/* filetes e cantoneiras dourados */}
        <g className="cov-foil">
          <rect x="51" y="19" width="230" height="362" rx="3" fill="none" stroke={url('goldV')} strokeWidth="2.2" />
          <rect x="57" y="25" width="218" height="350" fill="none" stroke={url('goldV')} strokeWidth=".8" />
          {CORNERS.map((t) => (
            <g key={t} transform={t} fill="none" stroke={url('gold')} strokeWidth="1.5" strokeLinecap="round">
              {FILIGREE.map((d) => <path key={d} d={d} />)}
              <path d="M9 9Q22 13 26 26Q13 22 9 9Z" fill={url('gold')} stroke="none" />
              <circle cx="5" cy="5" r="2.2" fill={url('gold')} stroke="none" />
            </g>
          ))}
          <path d="M156 25L166 19L176 25L166 31Z" fill={url('gold')} />
          <path d="M156 375L166 369L176 375L166 381Z" fill={url('gold')} />
        </g>

        {v === 'biblico' ? (
          <g>
            <g transform="translate(93.5 60) scale(.73)" className="cov-emblem-wrap">
              <EmblemGraphic uid={`${uid}e`} />
            </g>
            <FoilText y={248} size={16} spacing={7} fill={url('goldV')} weight={600}>ÁLBUM</FoilText>
            <FoilText y={294} size={44} fill={url('goldV')} style={{ fontStyle: 'italic' }}>Bíblico</FoilText>
            <Divider y={311} fill={url('gold')} />
            <FoilText y={334} size={9.6} spacing={.8} fill={url('goldV')} weight={600} className="cov-t-sans">100 personagens da Bíblia</FoilText>
          </g>
        ) : (
          <g>
            {/* medalhão: logo do distrito (ou emblema provisório) */}
            <circle cx="166" cy="140" r="61" fill={url('gold')} />
            <circle cx="166" cy="140" r="56" fill="#0A1C4A" />
            <circle cx="166" cy="140" r="56" fill="none" stroke={url('gold')} strokeWidth="1" strokeDasharray="1.5 3" />
            <circle cx="166" cy="140" r="51.5" fill={url('gold')} />
            <circle cx="166" cy="140" r="50" fill={logo ? '#fff' : url('medalBg')} />
            {logo ? (
              <image href={logo} x="116" y="90" width="100" height="100" preserveAspectRatio="xMidYMid slice" clipPath={url('medal')} />
            ) : (
              <g transform="translate(0 -8)"><PathfinderMark uid={uid} /></g>
            )}
            <FoilText y={228} size={19} spacing={8} fill={url('goldV')} weight={600}>PALMARES</FoilText>
            <g fill={url('gold')} transform="translate(0 -2)">
              {laurelLeaves(166, 280, 62, 142, 218, 12, 2.8, .95).map((t) => <path key={t} d={LEAF} transform={t} />)}
            </g>
            <FoilText y={306} size={80} fill={url('goldV')} weight={800}>27</FoilText>
            <FoilText y={327} size={9.6} spacing={.6} fill={url('goldV')} weight={600} className="cov-t-sans">Figurinhas dos desbravadores</FoilText>
            <g>
              <rect x="135" y="336" width="62" height="13" rx="6.5" fill="#0A1C4A" stroke={url('gold')} strokeWidth=".9" />
              <text x="166" y="345.6" textAnchor="middle" fontSize="7.6" fontWeight="700" letterSpacing="1.6" fill="#F9C71D" className="cov-t-sans">EM BREVE</text>
            </g>
          </g>
        )}
      </svg>
      <span className="cov-shine" aria-hidden="true" />
    </div>
  );
}

export default AlbumCover;
