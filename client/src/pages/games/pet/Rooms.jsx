// Cenários do Meu Bichinho (SVG em tela cheia, 400 x 700): sala, cozinha, banheiro, quarto e closet.
// Os objetos que ficam NA FRENTE do bichinho (mesa, banheira, cobertor, vaso) estão em RoomFront.

const W = 400;
const H = 700;
const FLOOR = 520;

function Wall({ c1, c2, pattern }) {
  return (
    <>
      <defs>
        <linearGradient id={`wall-${c1}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c1} /><stop offset="1" stopColor={c2} /></linearGradient>
      </defs>
      <rect width={W} height={FLOOR} fill={`url(#wall-${c1})`} />
      {pattern}
    </>
  );
}
const Floor = ({ c1, c2, lines }) => (
  <>
    <defs><linearGradient id={`floor-${c1}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c1} /><stop offset="1" stopColor={c2} /></linearGradient></defs>
    <rect y={FLOOR} width={W} height={H - FLOOR} fill={`url(#floor-${c1})`} />
    {lines}
    <rect y={FLOOR - 6} width={W} height="10" fill="rgba(0,0,0,.12)" />
  </>
);
const Window = ({ x, y, w = 130, h = 150, night }) => (
  <g>
    <rect x={x - 8} y={y - 8} width={w + 16} height={h + 16} rx="10" fill="#FFFFFF" />
    <defs><linearGradient id={`sky-${x}-${night ? 'n' : 'd'}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={night ? '#0B1A44' : '#6FB6FF'} /><stop offset="1" stopColor={night ? '#2B3F7A' : '#CFEBFF'} /></linearGradient></defs>
    <rect x={x} y={y} width={w} height={h} fill={`url(#sky-${x}-${night ? 'n' : 'd'})`} />
    {night ? <><circle cx={x + w * 0.7} cy={y + 36} r="16" fill="#FFF6C8" /><circle cx={x + w * 0.7 + 7} cy={y + 31} r="14" fill="#14255A" /><g fill="#fff">{[[0.2, 0.3], [0.4, 0.15], [0.3, 0.6], [0.8, 0.7]].map(([a, b]) => <circle key={a} cx={x + w * a} cy={y + h * b} r="2" />)}</g></>
      : <><circle cx={x + w * 0.75} cy={y + 34} r="18" fill="#FFE58A" /><ellipse cx={x + w * 0.35} cy={y + h * 0.45} rx="30" ry="12" fill="#fff" opacity=".9" /><path d={`M${x} ${y + h} q${w * 0.3} -50 ${w * 0.6} -20 q${w * 0.25} -30 ${w * 0.4} 0 v20 h-${w} z`} fill="#6CC27A" /></>}
    <rect x={x + w / 2 - 3} y={y} width="6" height={h} fill="#fff" />
    <rect x={x} y={y + h / 2 - 3} width={w} height="6" fill="#fff" />
  </g>
);
const Curtains = ({ x, w, y, c }) => (
  <g fill={c}>
    <path d={`M${x - 26} ${y - 20} h40 q-10 90 6 ${180} h-46 z`} />
    <path d={`M${x + w + 26} ${y - 20} h-40 q10 90 -6 ${180} h46 z`} />
    <rect x={x - 34} y={y - 30} width={w + 68} height="14" rx="7" fill="#8B5A2B" />
  </g>
);

function Sala() {
  return (
    <>
      <Wall c1="#BFE3F2" c2="#9FD0E8" pattern={<g fill="#fff" opacity=".25">{Array.from({ length: 30 }, (_, i) => <path key={i} d={`M${(i % 6) * 72 + ((i / 6) % 2 ? 36 : 0)} ${Math.floor(i / 6) * 100 + 30} l12 22 h-24 z`} />)}</g>} />
      <Window x={40} y={80} />
      <Curtains x={40} w={130} y={80} c="#F2A65A" />
      <g><rect x="270" y="110" width="80" height="96" rx="6" fill="#C9A06A" /><rect x="278" y="118" width="64" height="80" fill="#E8D7B9" /><path d="M290 186 q20 -40 40 0 z" fill="#18875A" /><circle cx="310" cy="146" r="12" fill="#F9C71D" /></g>
      <Floor c1="#D9A066" c2="#B07842" lines={<g stroke="rgba(0,0,0,.08)" strokeWidth="2">{Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${i * 50} ${FLOOR} L${i * 70 - 80} ${H}`} />)}</g>} />
      <g><rect x="-20" y="420" width="120" height="110" rx="24" fill="#E8735C" /><rect x="-20" y="400" width="110" height="50" rx="20" fill="#F08A72" /><rect x="0" y="520" width="14" height="20" fill="#7A4E25" /></g>
      <g><rect x="312" y="380" width="70" height="64" rx="8" fill="#5A6578" /><rect x="320" y="388" width="54" height="40" rx="5" fill="#9EE6C0" /><rect x="340" y="444" width="14" height="40" fill="#7A4E25" /><rect x="320" y="482" width="54" height="10" rx="4" fill="#7A4E25" /></g>
      <g><path d="M60 360 q-20 -50 0 -90 q10 40 0 90 M60 360 q25 -40 40 -70 q-10 50 -40 70 M60 360 q-40 -30 -50 -60 q30 20 50 60" fill="#3FA34D" /><path d="M42 360 h36 l-6 40 h-24 z" fill="#C8642C" /></g>
      <ellipse cx="200" cy="625" rx="170" ry="40" fill="#F9C71D" opacity=".85" /><ellipse cx="200" cy="625" rx="130" ry="28" fill="#F2A65A" opacity=".85" />
    </>
  );
}

function Cozinha() {
  return (
    <>
      <Wall c1="#FFE9C7" c2="#FFDDA8" pattern={<g fill="#F2A65A" opacity=".18">{Array.from({ length: 24 }, (_, i) => <circle key={i} cx={(i % 6) * 72 + 30} cy={Math.floor(i / 6) * 110 + 50} r="22" />)}</g>} />
      <rect x="0" y="0" width={W} height="110" fill="#E2A766" /><g stroke="#B9813F" strokeWidth="4">{[100, 200, 300].map((x) => <path key={x} d={`M${x} 0 V110`} />)}</g>
      <g fill="#8B5A2B">{[50, 150, 250, 350].map((x) => <circle key={x} cx={x} cy="94" r="5" />)}</g>
      <Window x={135} y={150} w={130} h={120} />
      <Curtains x={135} w={130} y={150} c="#E5383B" />
      <g><rect x="0" y="300" width="96" height="230" rx="10" fill="#E9EEF6" /><rect x="6" y="306" width="84" height="90" rx="6" fill="#DCE3EE" /><rect x="76" y="330" width="6" height="40" rx="3" fill="#9AA6BD" /><rect x="76" y="420" width="6" height="40" rx="3" fill="#9AA6BD" /></g>
      <g><rect x="296" y="360" width="104" height="170" rx="8" fill="#F4F6FA" /><rect x="306" y="372" width="84" height="18" rx="4" fill="#2A2F3A" /><circle cx="324" cy="381" r="6" fill="#4A5160" /><circle cx="348" cy="381" r="6" fill="#4A5160" /><circle cx="372" cy="381" r="6" fill="#4A5160" /><rect x="310" y="408" width="76" height="70" rx="6" fill="#2A2F3A" /><path d="M318 330 h60 v30 h-60 z" fill="#C9D1DF" /></g>
      <Floor c1="#EDE6DA" c2="#D8CFC0" lines={<g fill="rgba(0,0,0,.06)">{Array.from({ length: 30 }, (_, i) => ((i + Math.floor(i / 8)) % 2 ? <rect key={i} x={(i % 8) * 50} y={FLOOR + Math.floor(i / 8) * 50} width="50" height="50" /> : null))}</g>} />
    </>
  );
}

function Banheiro() {
  return (
    <>
      <Wall c1="#CDEFF5" c2="#A8DDE8" pattern={<g stroke="#fff" strokeWidth="2" opacity=".6">{Array.from({ length: 14 }, (_, i) => <path key={`h${i}`} d={`M0 ${i * 40} H${W}`} />)}{Array.from({ length: 11 }, (_, i) => <path key={`v${i}`} d={`M${i * 40} 0 V${FLOOR}`} />)}</g>} />
      <g><rect x="140" y="70" width="120" height="150" rx="60" fill="#fff" /><rect x="150" y="80" width="100" height="130" rx="50" fill="#DDF3FF" /><path d="M170 120 q20 -20 40 0" stroke="#fff" strokeWidth="6" opacity=".7" fill="none" /></g>
      <g><path d="M320 40 V140 H290" stroke="#9AA6BD" strokeWidth="8" fill="none" strokeLinecap="round" /><path d="M270 140 h44 l-6 14 h-32 z" fill="#C9D1DF" /></g>
      <g fill="#F48FB1"><rect x="30" y="200" width="90" height="10" rx="4" /><rect x="40" y="170" width="18" height="30" rx="6" fill="#7FC4FF" /><rect x="66" y="160" width="14" height="40" rx="5" fill="#FFD54F" /><rect x="88" y="176" width="20" height="24" rx="6" fill="#B98CF0" /></g>
      <Floor c1="#B9DDE6" c2="#93C7D4" lines={<g stroke="rgba(255,255,255,.45)" strokeWidth="2">{Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${i * 50} ${FLOOR} V${H}`} />)}{[560, 610, 660].map((y) => <path key={y} d={`M0 ${y} H${W}`} />)}</g>} />
      <ellipse cx="200" cy="640" rx="120" ry="30" fill="#F8BBD0" opacity=".85" />
    </>
  );
}

function Toalete() {
  return (
    <>
      <Wall c1="#FFF3B0" c2="#F6DE7A" pattern={<rect y="300" width={W} height="220" fill="#5FB3DB" />} />
      <g stroke="#fff" strokeWidth="2" opacity=".6">{Array.from({ length: 6 }, (_, i) => <path key={`h${i}`} d={`M0 ${300 + i * 40} H${W}`} />)}{Array.from({ length: 11 }, (_, i) => <path key={`v${i}`} d={`M${i * 40} 300 V${FLOOR}`} />)}</g>
      <Window x={135} y={70} w={130} h={150} />
      <g><rect x="320" y="330" width="60" height="70" rx="6" fill="#fff" /><rect x="330" y="340" width="40" height="40" rx="4" fill="#E9EEF6" /></g>
      <Floor c1="#4E9CC4" c2="#3A7FA6" lines={<g stroke="rgba(255,255,255,.35)" strokeWidth="2">{Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${i * 50} ${FLOOR} V${H}`} />)}{[570, 620, 670].map((y) => <path key={y} d={`M0 ${y} H${W}`} />)}</g>} />
      {/* caixa e vaso (o assento fica em RoomFront) */}
      <g><rect x="152" y="330" width="96" height="80" rx="10" fill="#fff" stroke="#DCE3EE" strokeWidth="3" /><rect x="186" y="318" width="28" height="12" rx="5" fill="#C9D1DF" /></g>
    </>
  );
}

function Quarto({ night }) {
  return (
    <>
      <Wall c1="#C7B8F0" c2="#A894E0" pattern={<g stroke="#fff" strokeWidth="10" opacity=".14">{Array.from({ length: 10 }, (_, i) => <path key={i} d={`M${i * 44} 0 V${FLOOR}`} />)}</g>} />
      <Window x={240} y={80} w={120} h={140} night={night} />
      <g><circle cx="70" cy="140" r="34" fill={night ? '#3B3F7A' : '#FFD54F'} opacity={night ? 0.6 : 0.95} /><path d="M50 140 l40 0" stroke="#fff" strokeWidth="3" opacity=".6" /></g>
      <Floor c1="#9C7BC0" c2="#7A5AA0" lines={<g stroke="rgba(255,255,255,.12)" strokeWidth="2">{Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${i * 50} ${FLOOR} L${i * 64 - 60} ${H}`} />)}</g>} />
      {/* cabeceira da cama */}
      <g><rect x="40" y="350" width="320" height="140" rx="22" fill="#B07842" /><rect x="56" y="366" width="288" height="110" rx="16" fill="#C98E54" /><g stroke="#9C6634" strokeWidth="6">{[100, 150, 200, 250, 300].map((x) => <path key={x} d={`M${x} 370 V472`} />)}</g></g>
      <ellipse cx="200" cy="470" rx="110" ry="30" fill="#EAF4FF" />
    </>
  );
}

function Closet() {
  return (
    <>
      <Wall c1="#FCE1D2" c2="#F6C6B0" />
      <g><rect x="90" y="60" width="220" height="380" rx="110" fill="#E9B98C" /><rect x="104" y="74" width="192" height="352" rx="96" fill="#D9C8F5" /><rect x="104" y="74" width="192" height="352" rx="96" fill="url(#mirror)" opacity=".7" />
        <defs><linearGradient id="mirror" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" /><stop offset=".5" stopColor="#B69CEB" /><stop offset="1" stopColor="#fff" /></linearGradient></defs></g>
      <g fill="#C98E54"><rect x="0" y="80" width="70" height="440" /><rect x="330" y="80" width="70" height="440" /></g>
      <g>{[130, 210, 290, 370].map((y, i) => <g key={y}><rect x="4" y={y} width="62" height="8" fill="#9C6634" /><rect x="12" y={y - 26} width="20" height="26" rx="4" fill={['#E5383B', '#2B6CD8', '#F9C71D', '#18875A'][i]} /><rect x="36" y={y - 20} width="24" height="20" rx="4" fill={['#F48FB1', '#8FD3F4', '#B98CF0', '#F2A65A'][i]} /></g>)}</g>
      <g>{[130, 210, 290, 370].map((y, i) => <g key={y}><rect x="334" y={y} width="62" height="8" fill="#9C6634" /><path d={`M346 ${y} q8 -26 18 0 M372 ${y} q8 -20 16 0`} stroke={['#7B2CBF', '#E03B44', '#2B6CD8', '#F9C71D'][i]} strokeWidth="10" fill="none" /></g>)}</g>
      <Floor c1="#F2D2B6" c2="#E2B48E" />
      <ellipse cx="200" cy="610" rx="150" ry="36" fill="#fff" opacity=".35" />
      <g fill="#fff" opacity=".8">{[[110, 40], [290, 40]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="16" />)}</g>
    </>
  );
}

export function RoomBack({ room, night }) {
  const body = { sala: <Sala />, cozinha: <Cozinha />, banho: <Banheiro />, toalete: <Toalete />, quarto: <Quarto night={night} />, closet: <Closet /> }[room];
  return <svg className="pet-room-bg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">{body}</svg>;
}

/** O que fica na frente do bichinho: mesa da cozinha, banheira, assento do vaso, cobertor. */
export function RoomFront({ room, sleeping, seated }) {
  let body = null;
  if (room === 'cozinha') {
    body = (
      <g>
        <rect x="-10" y="560" width="420" height="150" fill="#C0392B" />
        <path d="M-10 560 h420 v18 h-420 z" fill="#E74C3C" />
        <g fill="rgba(255,255,255,.18)">{Array.from({ length: 12 }, (_, i) => <rect key={i} x={i * 36} y="578" width="18" height="130" />)}</g>
      </g>
    );
  } else if (room === 'banho') {
    body = (
      <g>
        <path d="M40 520 h320 q0 110 -90 120 h-140 q-90 -10 -90 -120 z" fill="#FFD54F" stroke="#E0A800" strokeWidth="4" />
        <path d="M40 520 h320" stroke="#FFE58A" strokeWidth="12" strokeLinecap="round" />
        <path d="M90 640 l-14 30 M310 640 l14 30" stroke="#E0A800" strokeWidth="10" strokeLinecap="round" />
        <g fill="#fff" opacity=".9">{[[80, 516], [120, 508], [170, 514], [230, 506], [280, 514], [330, 510]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="20" />)}</g>
      </g>
    );
  } else if (room === 'toalete' && seated) {
    body = (
      <g>
        <ellipse cx="200" cy="520" rx="78" ry="20" fill="#2EC07F" />
        <path d="M128 520 q0 70 40 90 h64 q40 -20 40 -90 z" fill="#fff" stroke="#DCE3EE" strokeWidth="3" />
        <rect x="170" y="606" width="60" height="40" rx="6" fill="#F4F6FA" stroke="#DCE3EE" strokeWidth="3" />
      </g>
    );
  } else if (room === 'quarto') {
    body = (
      <g>
        <path d="M30 480 h340 v160 h-340 z" fill="#3FA9F5" />
        <path d={sleeping ? 'M30 470 q170 -40 340 0 v30 h-340 z' : 'M30 500 q170 -20 340 0 v20 h-340 z'} fill="#5FC0FF" />
        <g stroke="#8FD3F4" strokeWidth="4" fill="none" opacity=".8">{[540, 580, 620].map((y) => <path key={y} d={`M40 ${y} q40 -14 80 0 t80 0 t80 0 t80 0`} />)}</g>
        <rect x="20" y="630" width="360" height="40" rx="10" fill="#B07842" />
      </g>
    );
  }
  if (!body) return null;
  return <svg className="pet-room-front" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">{body}</svg>;
}
