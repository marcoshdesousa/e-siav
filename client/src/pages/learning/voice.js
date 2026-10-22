// Áudio gravado da leitura (Ano Bíblico, Meditação e Bom Líder): um arquivo por dia/aula e o momento
// em que cada trecho (versículo ou parágrafo) começa. Toca na hora; a marcação segue a voz.
import { useEffect, useRef, useState } from 'react';

/** audio: { url, starts, duration } (ou null, sem áudio). */
export function useNarration(audio) {
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(-1);
  const [rate, setRate] = useState(() => {
    try { return Number(localStorage.getItem('bible-rate')) || 1; } catch { return 1; }
  });
  const audioRef = useRef(null);
  const starts = audio?.starts || [];

  const seek = (i) => {
    const a = audioRef.current;
    const t = starts[Math.max(0, i)] || 0;
    if (a.readyState >= 1) a.currentTime = t;
    else a.addEventListener('loadedmetadata', () => { a.currentTime = t; }, { once: true });
  };
  const startAt = (i) => {
    const a = audioRef.current;
    if (!a || !audio) return;
    if (i >= 0) seek(i);
    a.playbackRate = rate;
    a.play().catch(() => setPlaying(false));
  };
  const stop = () => audioRef.current?.pause();
  const changeRate = () => {
    const r = rate === 1 ? 1.25 : rate === 1.25 ? 1.5 : rate === 1.5 ? 2 : 1;
    setRate(r);
    try { localStorage.setItem('bible-rate', String(r)); } catch { /* sem armazenamento */ }
    if (audioRef.current) audioRef.current.playbackRate = r;
  };
  const onTime = () => {
    const t = audioRef.current.currentTime + 0.05;
    let i = -1;
    for (let k = 0; k < starts.length; k++) { if (starts[k] <= t) i = k; else break; }
    if (i !== pos) setPos(i);
  };
  useEffect(() => () => audioRef.current?.pause(), []);

  return {
    available: !!audio, playing, pos, rate, startAt, stop, changeRate,
    audioProps: audio ? {
      ref: audioRef, src: audio.url, preload: 'auto',
      onPlay: () => setPlaying(true), onPause: () => setPlaying(false), onTimeUpdate: onTime,
      onEnded: () => { setPlaying(false); setPos(-1); },
    } : null,
  };
}
