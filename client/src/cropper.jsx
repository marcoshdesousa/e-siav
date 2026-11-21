// Recortar a imagem antes de enviar (logo do clube, da unidade e foto de perfil): a pessoa arrasta
// para posicionar e dá zoom (pinça no celular, roda do mouse ou a barrinha). Sai um quadrado.
// Abre por evento (ui.jsx → pickImage), então não precisa de nada além do <CropHost /> no App.
import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, RotateCw } from 'lucide-react';
import { Button, Modal } from './ui.jsx';

const OUT = 800; // lado da imagem final (px)
const MAX_ZOOM = 5;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não deu para abrir essa imagem. Escolha uma foto em JPG ou PNG.')); };
    img.src = url;
  });
}

/** Imagem girada (0, 90, 180 ou 270 graus) num canvas, para recortar já na posição certa. */
function rotated(img, turn) {
  if (!turn) return img;
  const c = document.createElement('canvas');
  const side = turn % 180 !== 0;
  c.width = side ? img.naturalHeight : img.naturalWidth;
  c.height = side ? img.naturalWidth : img.naturalHeight;
  const ctx = c.getContext('2d');
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((turn * Math.PI) / 180);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  return c;
}
const sizeOf = (src) => [src.naturalWidth || src.width, src.naturalHeight || src.height];

function Cropper({ job, onDone }) {
  const { file, round, title } = job;
  const [loaded, setLoaded] = useState(null);
  const [turn, setTurn] = useState(0);
  const [box, setBox] = useState(() => Math.min(320, window.innerWidth - 72));
  const [view, setView] = useState({ z: 1, x: 0, y: 0 });
  const pointers = useRef(new Map());
  const pinch = useRef(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    let alive = true;
    let url;
    loadImage(file).then((r) => { url = r.url; if (alive) setLoaded(r.img); }).catch((e) => doneRef.current(null, e));
    const onResize = () => setBox(Math.min(320, window.innerWidth - 72));
    window.addEventListener('resize', onResize);
    return () => { alive = false; if (url) URL.revokeObjectURL(url); window.removeEventListener('resize', onResize); };
  }, [file]);

  const src = loaded ? rotated(loaded, turn) : null;
  const [w, h] = src ? sizeOf(src) : [1, 1];
  const base = Math.max(box / w, box / h);
  const clamp = (v) => {
    const s = base * v.z;
    return { z: v.z, x: Math.min(0, Math.max(box - w * s, v.x)), y: Math.min(0, Math.max(box - h * s, v.y)) };
  };
  // Começa centralizada (e de novo ao girar).
  useEffect(() => {
    if (!src) return;
    const [iw, ih] = sizeOf(src);
    const b = Math.max(box / iw, box / ih);
    setView({ z: 1, x: (box - iw * b) / 2, y: (box - ih * b) / 2 });
  }, [loaded, turn, box]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Zoom mantendo fixo o ponto (cx, cy) da caixa. */
  const zoomTo = (z, cx = box / 2, cy = box / 2) => setView((v) => {
    const nz = Math.min(MAX_ZOOM, Math.max(1, z));
    const k = nz / v.z;
    return clamp({ z: nz, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k });
  });

  const local = (e) => { const r = e.currentTarget.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const onDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: view.z };
    }
  };
  const onMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId);
    const cur = local(e);
    pointers.current.set(e.pointerId, cur);
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      zoomTo(pinch.current.z * (d / pinch.current.d), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    } else {
      setView((v) => clamp({ ...v, x: v.x + cur[0] - prev[0], y: v.y + cur[1] - prev[1] }));
    }
  };
  const onUp = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };
  const onWheel = (e) => {
    const [cx, cy] = local(e);
    zoomTo(view.z * (e.deltaY < 0 ? 1.1 : 1 / 1.1), cx, cy);
  };

  const save = () => {
    const s = base * view.z;
    const sx = -view.x / s;
    const sy = -view.y / s;
    const side = box / s;
    const out = Math.round(Math.min(OUT, Math.max(256, side)));
    const keepAlpha = ['image/png', 'image/webp', 'image/gif'].includes(file.type);
    const c = document.createElement('canvas');
    c.width = out;
    c.height = out;
    const ctx = c.getContext('2d');
    if (!keepAlpha) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, out, out); }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, sx, sy, side, side, 0, 0, out, out);
    const type = keepAlpha ? 'image/png' : 'image/jpeg';
    c.toBlob((blob) => {
      if (!blob) return onDone(null, new Error('Não deu para recortar a imagem'));
      const name = (file.name || 'imagem').replace(/\.[^.]+$/, '') + (keepAlpha ? '.png' : '.jpg');
      onDone(new File([blob], name, { type }));
    }, type, 0.9);
  };

  const s = base * view.z;
  return (
    <Modal
      title={title || 'Ajustar imagem'}
      onClose={() => onDone(null)}
      footer={<><Button variant="secondary" onClick={() => onDone(null)}>Cancelar</Button><Button disabled={!src} onClick={save}>Usar imagem</Button></>}
    >
      <p className="small muted center" style={{ marginTop: 0 }}>Arraste para posicionar e use o zoom para enquadrar.</p>
      <div
        className={'crop-stage' + (round ? ' round' : '')}
        style={{ width: box, height: box }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
      >
        {src && (
          <canvas
            className="crop-img"
            ref={(el) => {
              if (!el || el.dataset.turn === `${turn}:${loaded?.src}`) return;
              el.dataset.turn = `${turn}:${loaded?.src}`;
              el.width = w;
              el.height = h;
              el.getContext('2d').drawImage(src, 0, 0);
            }}
            style={{ width: w * s, height: h * s, transform: `translate(${view.x}px, ${view.y}px)` }}
          />
        )}
        <span className="crop-frame" aria-hidden="true"><i /><i /></span>
      </div>
      <div className="crop-tools">
        <button type="button" className="icon-btn" aria-label="Diminuir" onClick={() => zoomTo(view.z / 1.2)}><Minus size={18} /></button>
        <input type="range" min="1" max={MAX_ZOOM} step="0.01" value={view.z} onChange={(e) => zoomTo(Number(e.target.value))} aria-label="Zoom" />
        <button type="button" className="icon-btn" aria-label="Aumentar" onClick={() => zoomTo(view.z * 1.2)}><Plus size={18} /></button>
        <button type="button" className="icon-btn" aria-label="Girar" onClick={() => setTurn((t) => (t + 90) % 360)}><RotateCw size={18} /></button>
      </div>
    </Modal>
  );
}

/** Fica no App: abre o recorte quando alguém escolhe uma imagem (evento 'dbv-crop'). */
export function CropHost() {
  const [job, setJob] = useState(null);
  useEffect(() => {
    const on = (e) => setJob(e.detail);
    window.addEventListener('dbv-crop', on);
    return () => window.removeEventListener('dbv-crop', on);
  }, []);
  if (!job) return null;
  const done = (file, err) => { setJob(null); job.resolve({ file, err }); };
  return <Cropper key={job.id} job={job} onDone={done} />;
}
