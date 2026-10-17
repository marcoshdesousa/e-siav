// Voz da leitura (Ano Bíblico e Bom Líder): toca, em sequência, um áudio pequeno por item (versículo
// ou parágrafo), preparado pelo servidor. Mostra quanto já está pronto e, se a voz do servidor
// falhar ou demorar demais, continua com a voz do próprio aparelho (nunca fica travado).
import { useEffect, useRef, useState } from 'react';
import { api } from '../../api.js';

/** Um décimo de segundo de silêncio (WAV): toca no toque do botão para o celular liberar o som. */
const SILENCE = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';
const WAIT_MS = 8000;
const hasSpeech = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

function bestVoice() {
  const vs = window.speechSynthesis.getVoices().filter((v) => /^pt/i.test(v.lang));
  const score = (v) => (/natural|neural|online|premium|enhanced|aprimorad/i.test(v.name) ? 4 : 0) + (/google|luciana|francisca|thalita|antonio|felipe/i.test(v.name) ? 2 : 0) + (/BR/i.test(v.lang) ? 1 : 0);
  return vs.sort((x, y) => score(y) - score(x))[0] || null;
}

/**
 * seq: [{ name, text }] na ordem da leitura. url: rota da voz (POST pede, GET acompanha).
 * Devolve o estado e as funções; renderize `audio` (os elementos de áudio) em algum lugar da página.
 */
export function useVoice({ seq, url, initial }) {
  const [voice, setVoice] = useState(initial || { total: seq.length, done: 0, ready: '', failing: false });
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [device, setDevice] = useState(false);
  const [pos, setPos] = useState(-1);
  const [rate, setRate] = useState(() => {
    try { return Number(localStorage.getItem('bible-rate')) || 1; } catch { return 1; }
  });
  const audioRef = useRef(null);
  const preRef = useRef(null);
  const posRef = useRef(-1);
  const playingRef = useRef(false);
  const rateRef = useRef(rate);
  const deviceRef = useRef(false);
  const voiceRef = useRef(voice);
  const waitTimer = useRef(0);
  rateRef.current = rate;
  voiceRef.current = voice;
  const isReady = (i) => voiceRef.current.ready?.[i] === '1';
  const percent = voice.total ? Math.round((voice.done / voice.total) * 100) : 0;

  // Pede a voz ao abrir e acompanha até ficar tudo pronto.
  useEffect(() => {
    let alive = true;
    let timer = 0;
    const tick = (first) => {
      (first ? api.post(url) : api.get(url))
        .then((v) => { if (!alive) return; setVoice(v); if (v.done < v.total && !v.failing) timer = window.setTimeout(() => tick(false), 1500); })
        .catch(() => { if (alive) timer = window.setTimeout(() => tick(true), 4000); });
    };
    tick(true);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [url]);

  const useDevice = () => { deviceRef.current = true; setDevice(true); };

  const stop = () => {
    playingRef.current = false;
    window.clearTimeout(waitTimer.current);
    setPlaying(false);
    setWaiting(false);
    audioRef.current?.pause();
    if (hasSpeech()) window.speechSynthesis.cancel();
  };
  const finish = () => { stop(); posRef.current = -1; setPos(-1); };

  /** Toca o item i (ou espera ele ficar pronto). */
  const playAt = (i) => {
    window.clearTimeout(waitTimer.current);
    if (!playingRef.current) return;
    if (i >= seq.length) { finish(); return; }
    posRef.current = i;
    setPos(i);
    if (deviceRef.current) {
      setWaiting(false);
      if (!hasSpeech()) { finish(); return; }
      const u = new window.SpeechSynthesisUtterance(seq[i].text);
      const v = bestVoice();
      if (v) u.voice = v;
      u.lang = 'pt-BR';
      u.rate = rateRef.current;
      u.onend = () => { if (playingRef.current && posRef.current === i) playAt(i + 1); };
      u.onerror = (e) => { if (e.error !== 'interrupted' && e.error !== 'canceled' && playingRef.current && posRef.current === i) playAt(i + 1); };
      window.speechSynthesis.speak(u);
      return;
    }
    if (!isReady(i)) {
      setWaiting(true);
      // Demorou demais (ou a voz do servidor falhou): segue com a voz do aparelho.
      waitTimer.current = window.setTimeout(() => {
        if (playingRef.current && posRef.current === i && !isReady(i) && hasSpeech()) { useDevice(); playAt(i); }
      }, voiceRef.current.failing ? 0 : WAIT_MS);
      return;
    }
    setWaiting(false);
    const a = audioRef.current;
    a.src = `/api/ano-biblico/voz/${seq[i].name}.mp3`;
    a.playbackRate = rateRef.current;
    a.play().catch(() => { if (hasSpeech()) { useDevice(); playAt(i); } });
    if (isReady(i + 1) && preRef.current) { preRef.current.src = `/api/ano-biblico/voz/${seq[i + 1].name}.mp3`; preRef.current.load(); }
  };
  // Chegou a voz que faltava (ou o servidor avisou que falhou): continua.
  useEffect(() => {
    if (!playingRef.current || !waiting || posRef.current < 0 || deviceRef.current) return;
    if (isReady(posRef.current)) playAt(posRef.current);
    else if (voice.failing && hasSpeech()) { useDevice(); playAt(posRef.current); }
  }, [voice]);

  const startAt = (i) => {
    if (i < 0) i = 0;
    stop();
    playingRef.current = true;
    setPlaying(true);
    // Destrava o som (e a voz do aparelho) ainda dentro do toque.
    const a = audioRef.current;
    if (!deviceRef.current && a && !isReady(i)) { a.src = SILENCE; a.play().catch(() => {}); }
    if (hasSpeech() && (deviceRef.current || !isReady(i))) {
      const u = new window.SpeechSynthesisUtterance(' ');
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
    if (voiceRef.current.failing && hasSpeech()) useDevice();
    playAt(i);
  };
  const changeRate = () => {
    const r = rate === 1 ? 1.25 : rate === 1.25 ? 1.5 : rate === 1.5 ? 2 : 1;
    setRate(r);
    rateRef.current = r;
    try { localStorage.setItem('bible-rate', String(r)); } catch { /* sem armazenamento */ }
    if (audioRef.current) audioRef.current.playbackRate = r;
    if (deviceRef.current && playingRef.current) { window.speechSynthesis.cancel(); playAt(posRef.current); }
  };
  useEffect(() => () => {
    playingRef.current = false;
    window.clearTimeout(waitTimer.current);
    audioRef.current?.pause();
    if (hasSpeech()) window.speechSynthesis.cancel();
  }, []);

  return {
    voice, playing, waiting, device, pos, rate, percent, startAt, stop, changeRate,
    loading: !device && voice.done < voice.total,
    onEnded: () => { if (playingRef.current) playAt(posRef.current + 1); },
    audioRef, preRef,
  };
}
