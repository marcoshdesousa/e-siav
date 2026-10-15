// Chat de voz entre os jogadores da sala (WebRTC, de celular para celular; o servidor só repassa os sinais).
// - Microfone começa desligado. Ligar pede permissão uma vez.
// - "Silenciar" um jogador: deixa de ouvir ele.
// - "Não falar com" um jogador: ele deixa de ouvir você (os outros continuam ouvindo).
import { useEffect, useRef, useState } from 'react';

const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

export function useVoice({ me, players, send, listen }) {
  const peers = useRef(new Map()); // id -> { pc, audio, sender }
  const micRef = useRef(null);
  const [mic, setMic] = useState(false);
  const [micError, setMicError] = useState('');
  const [mutedPeers, setMutedPeers] = useState(() => new Set()); // não ouço
  const [blocked, setBlocked] = useState(() => new Set()); // não me ouvem
  const [talking, setTalking] = useState(() => new Set()); // quem ligou o microfone
  const state = useRef({ mutedPeers, blocked, mic });
  state.current = { mutedPeers, blocked, mic };

  const applyOut = (id, p) => {
    const track = state.current.mic && !state.current.blocked.has(id) ? micRef.current?.getAudioTracks()[0] || null : null;
    p.sender?.replaceTrack(track).catch(() => {});
  };

  const close = (id) => {
    const p = peers.current.get(id);
    if (!p) return;
    p.pc.close();
    p.audio.srcObject = null;
    peers.current.delete(id);
  };

  const create = (id, offerer) => {
    close(id);
    const pc = new window.RTCPeerConnection({ iceServers: ICE });
    const audio = new window.Audio();
    audio.autoplay = true;
    audio.muted = state.current.mutedPeers.has(id);
    const p = { pc, audio, sender: null };
    peers.current.set(id, p);
    pc.onicecandidate = (e) => e.candidate && send({ t: 'rtc', to: id, data: { kind: 'ice', candidate: e.candidate } });
    pc.ontrack = (e) => { audio.srcObject = e.streams[0] || new window.MediaStream([e.track]); audio.play().catch(() => {}); };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' && offerer && peers.current.get(id)?.pc === pc) create(id, true);
    };
    if (offerer) {
      const tr = pc.addTransceiver('audio', { direction: 'sendrecv' });
      p.sender = tr.sender;
      applyOut(id, p);
      pc.createOffer().then((o) => pc.setLocalDescription(o)).then(() => send({ t: 'rtc', to: id, data: { kind: 'offer', sdp: pc.localDescription } })).catch(() => {});
    }
    return p;
  };

  // Sinais vindos dos outros jogadores.
  useEffect(() => listen(async (m) => {
    if (m.t === 'voice') {
      setTalking((s) => { const n = new Set(s); if (m.on) n.add(m.from); else n.delete(m.from); return n; });
      return;
    }
    if (m.t !== 'rtc') return;
    const { kind } = m.data || {};
    try {
      if (kind === 'offer') {
        const p = create(m.from, false);
        await p.pc.setRemoteDescription(m.data.sdp);
        const tr = p.pc.getTransceivers()[0];
        if (tr) { tr.direction = 'sendrecv'; p.sender = tr.sender; applyOut(m.from, p); }
        const ans = await p.pc.createAnswer();
        await p.pc.setLocalDescription(ans);
        send({ t: 'rtc', to: m.from, data: { kind: 'answer', sdp: p.pc.localDescription } });
      } else if (kind === 'answer') {
        await peers.current.get(m.from)?.pc.setRemoteDescription(m.data.sdp);
      } else if (kind === 'ice') {
        await peers.current.get(m.from)?.pc.addIceCandidate(m.data.candidate);
      }
    } catch { /* sinal fora de ordem: a conexão se refaz sozinha */ }
  }), [listen, send]);

  // Liga com quem está na sala (quem tem o número menor chama). Quem voltou depois de cair é chamado de novo.
  const seen = useRef(new Map());
  useEffect(() => {
    if (!me || !players) return;
    const ids = new Set(players.filter((p) => p.id !== me).map((p) => p.id));
    for (const id of [...peers.current.keys()]) if (!ids.has(id)) close(id);
    for (const pl of players) {
      if (pl.id === me) continue;
      const was = seen.current.get(pl.id);
      seen.current.set(pl.id, pl.connected);
      if (me < pl.id && pl.connected && (!peers.current.has(pl.id) || was === false)) create(pl.id, true);
    }
  }, [me, players]);

  useEffect(() => () => {
    for (const id of [...peers.current.keys()]) close(id);
    micRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const toggleMic = async () => {
    setMicError('');
    if (mic) {
      micRef.current?.getTracks().forEach((t) => t.stop());
      micRef.current = null;
      state.current.mic = false;
      setMic(false);
      for (const [id, p] of peers.current) applyOut(id, p);
      send({ t: 'voice', on: false });
      return;
    }
    try {
      micRef.current = await window.navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      state.current.mic = true;
      setMic(true);
      for (const [id, p] of peers.current) applyOut(id, p);
      send({ t: 'voice', on: true });
    } catch {
      setMicError('Não deu para ligar o microfone. Permita o microfone nas configurações do navegador.');
    }
  };
  const toggleMute = (id) => setMutedPeers((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    const p = peers.current.get(id);
    if (p) p.audio.muted = n.has(id);
    return n;
  });
  const toggleBlock = (id) => setBlocked((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    state.current.blocked = n;
    const p = peers.current.get(id);
    if (p) applyOut(id, p);
    return n;
  });
  return { mic, micError, toggleMic, mutedPeers, toggleMute, blocked, toggleBlock, talking };
}
