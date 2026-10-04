import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, toForm } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useRealtime } from '../realtime.jsx';
import { fmtChatTime, fmtDate, fmtTime } from '../format.js';
import { Avatar, Button, Empty, Field, Loading, Modal, PageHeader, Spinner, useAsync, useLoad, notify } from '../ui.jsx';
import { Lightbox } from './Requirements.jsx';

const TYPE_ICON = { unidade: '🚩', diretoria: '🏕️', direta: '💬' };

function preview(last) {
  if (!last) return 'Nenhuma mensagem ainda';
  const body = last.kind === 'audio' ? '🎤 Áudio' : last.kind === 'foto' ? '📷 Foto' : last.body;
  return (last.mine ? 'Você: ' : '') + body;
}

/** Lista de conversas no estilo WhatsApp. */
export function ChatHome({ base }) {
  const { actor } = useAuth();
  const { subscribe } = useRealtime();
  const nav = useNavigate();
  const state = useLoad(() => api.get('/chat/conversations'));
  const [searching, setSearching] = useState(false);
  const reload = state.reload;

  useEffect(() => subscribe((e) => (e.type === 'message' || e.type === 'read') && reload()), [subscribe, reload]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  }, []);

  const openType = (type) => {
    const c = state.data?.find((x) => x.type === type);
    if (c) nav(`${base}/chat/${c.id}`);
    else notify(type === 'unidade' ? 'Você ainda não está em uma unidade.' : 'Conversa indisponível', 'error');
  };

  return (
    <>
      <PageHeader title={actor.type === 'club' ? 'Mensagens da diretoria' : 'Chat'} subtitle={actor.type === 'club' ? 'Mensagens que os membros enviam para a diretoria' : 'Converse sem sair da plataforma'} />
      {actor.type === 'member' && (
        <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: '1rem' }}>
          <button className="more-tile" onClick={() => openType('unidade')}><span>🚩</span>Unidade<small>Grupo</small></button>
          <button className="more-tile" onClick={() => openType('diretoria')}><span>🏕️</span>Diretoria<small>Do clube</small></button>
          <button className="more-tile" onClick={() => setSearching(true)}><span>💬</span>Direta<small>Nova conversa</small></button>
        </div>
      )}
      <Loading {...state} empty={actor.type === 'club' ? 'Nenhuma mensagem recebida ainda.' : 'Nenhuma conversa.'}>
        {(list) => (
          <div className="chat-list">
            {list.map((c) => (
              <Link key={c.id} to={`${base}/chat/${c.id}`} className="list-item">
                <Avatar src={c.photo} name={c.title} size={50} square={c.type !== 'direta' && !(actor.type === 'club')} />
                <div className="grow">
                  <div className="row between">
                    <span className="title ellipsis">{TYPE_ICON[c.type]} {c.title}</span>
                    <span className="chat-time">{c.last ? fmtChatTime(c.last.created_at) : ''}</span>
                  </div>
                  <div className="row between">
                    <span className="sub ellipsis">{c.type === 'unidade' && c.last && !c.last.mine ? c.last.sender_name.split(' ')[0] + ': ' : ''}{preview(c.last)}</span>
                    {c.unread > 0 && <span className="chat-unread">{c.unread}</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Loading>
      {searching && <DirectSearch base={base} onClose={() => setSearching(false)} />}
    </>
  );
}

function DirectSearch({ base, onClose }) {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [, run] = useAsync();
  useEffect(() => {
    if (q.trim().length < 2) return setResults([]);
    const t = setTimeout(() => api.get('/chat/search?q=' + encodeURIComponent(q.trim())).then(setResults).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q]);
  const start = async (m) => {
    const { id } = await run(() => api.post('/chat/direct', { member_id: m.id }));
    nav(`${base}/chat/${id}`);
  };
  return (
    <Modal title="Nova conversa direta" onClose={onClose}>
      <Field label="Código do membro ou nome" hint="Pelo nome você encontra membros do seu clube. De outros clubes, use o código (ex.: DBV-AB12C).">
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="DBV-XXXXX ou nome" />
      </Field>
      <div className="list mt">
        {results.map((m) => (
          <button key={m.id} className="list-item" style={{ border: 0, font: 'inherit', textAlign: 'left', cursor: 'pointer' }} onClick={() => start(m)}>
            <Avatar src={m.photo} name={m.name} size={42} />
            <div className="grow"><div className="title">{m.name}</div><div className="sub">{m.club_name} · {m.code}</div></div>
          </button>
        ))}
        {q.trim().length >= 2 && !results.length && <Empty icon="🔎">Ninguém encontrado.</Empty>}
      </div>
    </Modal>
  );
}

function ReportModal({ conv, message, onClose }) {
  const [reason, setReason] = useState('');
  const [target, setTarget] = useState(message ? `member:${message.sender_id}` : '');
  const [busy, run] = useAsync();
  const send = async () => {
    const [type, id] = target ? target.split(':') : [];
    await run(() => api.post('/chat/reports', { conversation_id: conv.id, message_id: message?.id, reported_type: type, reported_id: id, reason }), 'Denúncia enviada à diretoria e à administração.');
    onClose();
  };
  return (
    <Modal title="Denunciar" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button variant="red" busy={busy} onClick={send}>Enviar denúncia</Button></>}>
      <div className="form">
        <p className="muted small">A denúncia chega à diretoria do clube e ao Administrador Geral. Se você se sentir em perigo, fale também com um adulto de confiança.</p>
        {message && <div className="quiz-q small">“{message.kind === 'texto' ? message.body : message.kind === 'audio' ? 'Áudio' : 'Foto'}” — {message.sender?.name}</div>}
        {conv.members && !message && (
          <Field label="Quem você quer denunciar? (opcional)">
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Conversa em geral</option>
              {conv.members.map((m) => <option key={m.id} value={`member:${m.id}`}>{m.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="O que aconteceu?"><textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function BlockGroupModal({ conv, onClose }) {
  const blocks = useLoad(() => api.get('/chat/blocks'));
  const [, run] = useAsync();
  const isBlocked = (id) => blocks.data?.some((b) => b.blocked_type === 'member' && b.blocked_id === id);
  const toggle = (m) =>
    run(() => (isBlocked(m.id) ? api.del(`/chat/blocks/member/${m.id}`) : api.post('/chat/blocks', { type: 'member', id: m.id })), isBlocked(m.id) ? 'Desbloqueado' : 'Bloqueado: você não verá mais as mensagens dessa pessoa.').then(blocks.reload);
  return (
    <Modal title="Bloquear membro" onClose={onClose}>
      <p className="muted small">Você deixa de ver as mensagens da pessoa bloqueada e ela não pode iniciar conversa direta com você.</p>
      <div className="list mt">
        {conv.members.map((m) => (
          <div key={m.id} className="list-item">
            <Avatar src={m.photo} name={m.name} size={38} />
            <div className="grow title">{m.name}</div>
            <Button small variant={isBlocked(m.id) ? 'secondary' : 'danger'} onClick={() => toggle(m)}>{isBlocked(m.id) ? 'Desbloquear' : 'Bloquear'}</Button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function AudioRecorder({ onAudio, disabled }) {
  const [rec, setRec] = useState(null);
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [rec]);
  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (mr.cancelled) return;
        const type = (mr.mimeType || 'audio/webm').split(';')[0];
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        onAudio(new File(chunks, `audio.${ext}`, { type }));
      };
      mr.start();
      setSecs(0);
      setRec(mr);
    } catch {
      notify('Não foi possível acessar o microfone', 'error');
    }
  };
  const stop = (cancel) => {
    rec.cancelled = cancel;
    rec.stop();
    setRec(null);
  };
  if (rec) {
    return (
      <>
        <button className="round-btn light" onClick={() => stop(true)} aria-label="Cancelar">✕</button>
        <div className="recording">● Gravando {String(Math.floor(secs / 60)).padStart(2, '0')}:{String(secs % 60).padStart(2, '0')}</div>
        <button className="round-btn rec" onClick={() => stop(false)} aria-label="Enviar áudio">➤</button>
      </>
    );
  }
  return <button className="round-btn" onClick={start} disabled={disabled} aria-label="Gravar áudio">🎤</button>;
}

/** Conversa aberta (tela cheia). */
export function ChatConversation({ base }) {
  const { id } = useParams();
  const nav = useNavigate();
  const { actor } = useAuth();
  const { subscribe, setActiveConversation, refreshUnread } = useRealtime();
  const conv = useLoad(() => api.get('/chat/conversations/' + id), [id]);
  const [messages, setMessages] = useState(null);
  const [othersRead, setOthersRead] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState('');
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(null);
  const [blockGroup, setBlockGroup] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [sending, setSending] = useState(false);
  const bodyRef = useRef(null);
  const atBottom = useRef(true);

  const isMine = (m) => m.sender_type === actor.type && m.sender_id === actor.id;
  const markRead = (lastId) => api.post(`/chat/conversations/${id}/read`, { last_id: lastId }).then(refreshUnread).catch(() => {});

  useEffect(() => {
    setActiveConversation(Number(id));
    setMessages(null);
    api.get(`/chat/conversations/${id}/messages`).then((r) => {
      setMessages(r.messages);
      setOthersRead(r.others_read_id);
      setHasMore(r.messages.length >= 60);
      if (r.messages.length) markRead(r.messages[r.messages.length - 1].id);
    }).catch((e) => notify(e.message, 'error'));
    return () => setActiveConversation(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => subscribe((e) => {
    if (e.conversation_id !== Number(id)) return;
    if (e.type === 'message') {
      setMessages((ms) => (ms && !ms.some((m) => m.id === e.message.id) ? [...ms, e.message] : ms));
      if (!(e.message.sender_type === actor.type && e.message.sender_id === actor.id)) markRead(e.message.id);
    }
    if (e.type === 'read' && e.reader !== `${actor.type}:${actor.id}`) setOthersRead((x) => Math.max(x, e.last_read_id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [id, subscribe]);

  useEffect(() => {
    const el = bodyRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const loadOlder = async () => {
    const r = await api.get(`/chat/conversations/${id}/messages?before=${messages[0].id}`);
    atBottom.current = false;
    setMessages((ms) => [...r.messages, ...ms]);
    setHasMore(r.messages.length >= 60);
  };

  const send = async (payload) => {
    setSending(true);
    atBottom.current = true;
    try {
      const msg = await api.post(`/chat/conversations/${id}/messages`, toForm(payload));
      setMessages((ms) => (ms.some((m) => m.id === msg.id) ? ms : [...ms, msg]));
      return true;
    } catch (e) {
      notify(e.message, 'error');
      return false;
    } finally {
      setSending(false);
    }
  };
  const sendText = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    if (!(await send({ body }))) setText(body);
  };

  const c = conv.data;
  const peer = c?.peer;
  const toggleBlock = async () => {
    setMenu(false);
    if (c.i_blocked) await api.del(`/chat/blocks/${peer.type}/${peer.id}`);
    else if (confirm('Bloquear? Vocês não poderão trocar mensagens nesta conversa.')) await api.post('/chat/blocks', { type: peer.type, id: peer.id });
    else return;
    notify(c.i_blocked ? 'Desbloqueado' : 'Bloqueado');
    conv.reload();
  };
  const blocked = c && (c.i_blocked || c.blocked_me);

  let lastDay = null;
  return (
    <div className="chat-page">
      <div className="chat-head">
        <button className="icon-btn" onClick={() => nav(`${base}/chat`)} aria-label="Voltar">←</button>
        {c ? (
          <>
            <Avatar src={c.photo} name={c.title} size={40} square={c.type === 'unidade'} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="t ellipsis">{c.title}</div>
              <div className="s ellipsis">{c.subtitle}</div>
            </div>
            <button className="icon-btn" onClick={() => setMenu((x) => !x)} aria-label="Opções">⋮</button>
            {menu && (
              <div className="menu-pop" onMouseLeave={() => setMenu(false)}>
                <button className="danger" onClick={() => { setMenu(false); setReport({}); }}>🚩 Denunciar</button>
                {c.type === 'unidade'
                  ? <button className="danger" onClick={() => { setMenu(false); setBlockGroup(true); }}>⛔ Bloquear membro</button>
                  : <button className="danger" onClick={toggleBlock}>⛔ {c.i_blocked ? 'Desbloquear' : 'Bloquear'}</button>}
              </div>
            )}
          </>
        ) : <div className="grow" />}
      </div>

      <div className="chat-body" ref={bodyRef} onScroll={(e) => { const el = e.currentTarget; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
        {!messages ? <Spinner /> : (
          <>
            {hasMore && <button className="day-sep" style={{ border: 0, cursor: 'pointer' }} onClick={loadOlder}>Carregar mensagens anteriores</button>}
            {!messages.length && <div className="day-sep">Envie a primeira mensagem 👋</div>}
            {messages.map((m) => {
              const day = fmtDate(m.created_at);
              const sep = day !== lastDay;
              lastDay = day;
              const mine = isMine(m);
              return (
                <div key={m.id} style={{ display: 'contents' }}>
                  {sep && <div className="day-sep">{day}</div>}
                  <div className={'bubble' + (mine ? ' mine' : '')}>
                    {!mine && c?.type !== 'direta' && <div className="who">{m.sender?.name}</div>}
                    {!mine && <button className="bubble-menu" title="Denunciar mensagem" onClick={() => setReport({ message: m })}>⚑</button>}
                    {m.kind === 'texto' && <div style={{ whiteSpace: 'pre-wrap', paddingRight: mine ? 0 : 14 }}>{m.body}</div>}
                    {m.kind === 'foto' && <img className="photo" src={m.media} alt="Foto" onClick={() => setPhoto(m.media)} />}
                    {m.kind === 'audio' && <audio controls preload="none" src={m.media} />}
                    {m.kind !== 'texto' && m.body && <div>{m.body}</div>}
                    <div className="meta">
                      {fmtTime(m.created_at)}
                      {mine && <span className={'ticks' + (othersRead >= m.id ? ' read' : '')} title={othersRead >= m.id ? 'Lida' : 'Enviada'}>{othersRead >= m.id ? '✓✓' : '✓'}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {blocked ? (
        <div className="chat-blocked">{c.i_blocked ? 'Você bloqueou esta conversa.' : 'Não é possível enviar mensagens nesta conversa.'}</div>
      ) : (
        <div className="chat-input">
          <label className="round-btn light" aria-label="Enviar foto" style={{ cursor: 'pointer' }}>
            📷
            <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) send({ media: f }); }} />
          </label>
          {text.trim() ? (
            <>
              <textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="Mensagem" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } }} />
              <button className="round-btn" onClick={sendText} disabled={sending} aria-label="Enviar">➤</button>
            </>
          ) : (
            <>
              <textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="Mensagem" />
              <AudioRecorder disabled={sending} onAudio={(f) => send({ media: f })} />
            </>
          )}
        </div>
      )}

      {report && c && <ReportModal conv={c} message={report.message} onClose={() => setReport(null)} />}
      {blockGroup && c && <BlockGroupModal conv={c} onClose={() => { setBlockGroup(false); api.get(`/chat/conversations/${id}/messages`).then((r) => setMessages(r.messages)); }} />}
      <Lightbox src={photo} onClose={() => setPhoto(null)} />
    </div>
  );
}

/** Denúncias recebidas (diretoria do clube e Administrador Geral). */
export function ReportsPanel() {
  const state = useLoad(() => api.get('/reports'));
  const [, run] = useAsync();
  const TYPE = { unidade: 'Grupo da unidade', diretoria: 'Conversa com a diretoria', direta: 'Conversa direta' };
  return (
    <>
      <PageHeader title="Denúncias" subtitle="Denúncias feitas no chat" />
      <Loading {...state} empty="Nenhuma denúncia. 🙌">
        {(list) => list.map((r) => (
          <div key={r.id} className="card">
            <div className="row between">
              <b>{r.status === 'aberta' ? '🚩 Aberta' : '✅ Resolvida'}</b>
              <span className="small muted">{fmtDate(r.created_at)} {fmtTime(r.created_at)}</span>
            </div>
            <p className="small"><b>Quem denunciou:</b> {r.reporter?.name}{r.reporter_club ? ` (${r.reporter_club})` : ''}</p>
            {r.reported && <p className="small"><b>Denunciado:</b> {r.reported.name}</p>}
            <p className="small"><b>Onde:</b> {TYPE[r.conversation_type] || '—'}</p>
            {r.message && <div className="quiz-q small">Mensagem: {r.message.kind === 'texto' ? `“${r.message.body}”` : r.message.kind === 'foto' ? <a href={r.message.media} target="_blank" rel="noreferrer">ver foto</a> : <audio controls src={r.message.media} />}</div>}
            <p style={{ whiteSpace: 'pre-wrap' }}>{r.reason}</p>
            {r.status === 'aberta' && <Button small variant="green" onClick={() => run(() => api.post(`/reports/${r.id}/resolve`), 'Marcada como resolvida').then(state.reload)}>Marcar como resolvida</Button>}
          </div>
        ))}
      </Loading>
    </>
  );
}
