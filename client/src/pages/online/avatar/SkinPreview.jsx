// Prévia 3D da skin (girando e se mexendo). mode: 'surf' | 'stumble' | 'board'.
import { useEffect, useRef } from 'react';
import { mountPreview } from './preview.js';
import './skin.css';

export default function SkinPreview({ mode, skin, board = 'b01', label, cycle, className = '' }) {
  const ref = useRef(null);
  const view = useRef(null);
  useEffect(() => {
    let v = null;
    try { v = mountPreview(ref.current, { mode, cycle }); } catch { /* sem WebGL */ }
    view.current = v;
    return () => { v?.dispose(); view.current = null; };
  }, [mode, cycle]);
  useEffect(() => { view.current?.set({ skin, board }); }, [skin, board, mode, cycle]);
  return (
    <div className={`skin-stage ${mode} ${className}`}>
      <canvas ref={ref} />
      {label && <span className="skin-stage-tag">{label}</span>}
    </div>
  );
}
