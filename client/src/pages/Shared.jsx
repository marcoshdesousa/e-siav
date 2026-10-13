// Peças usadas em todos os portais: site que abre dentro do app (SGC, Cantinho da Unidade,
// Cartão DBV) e o chat de suporte com a equipe.
import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Globe, Send } from 'lucide-react';
import { api } from '../api.js';
import { fmtDateTime } from '../format.js';
import { Button, Card, Loading, PageHeader, useAsync, useLoad } from '../ui.jsx';

/** Site de fora aberto dentro do app. Sem link cadastrado, mostra "em breve". */
export function EmbeddedSite({ title, linkKey, subtitle }) {
  const state = useLoad(() => api.get('/links'));
  return (
    <Loading {...state}>
      {(links) => {
        const url = links[linkKey];
        if (!url) {
          return (
            <>
              <PageHeader title={title} subtitle={subtitle} />
              <Card className="center embed-soon">
                <Globe size={44} />
                <h2>Em breve</h2>
                <p className="muted">O {title} vai abrir aqui dentro do app, sem precisar sair. O link ainda vai ser cadastrado pela equipe.</p>
              </Card>
            </>
          );
        }
        return (
          <div className="embed">
            <div className="embed-bar">
              <b>{title}</b>
              <a href={url} target="_blank" rel="noreferrer"><Button small variant="secondary"><ExternalLink size={14} /> Abrir fora</Button></a>
            </div>
            <iframe src={url} title={title} className="embed-frame" allow="clipboard-write; camera; geolocation; fullscreen" referrerPolicy="no-referrer-when-downgrade" />
            <p className="small muted center embed-hint">Se a página não aparecer, toque em <b>Abrir fora</b>: alguns sites não deixam abrir dentro de outro.</p>
          </div>
        );
      }}
    </Loading>
  );
}

/** Lista de mensagens (bolhas) da conversa. */
export function ChatMessages({ messages, mine }) {
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);
  return (
    <div className="chat-list">
      {messages.map((m) => (
        <div key={m.id} className={'chat-msg' + (m.sender === mine ? ' mine' : '')}>
          <span>{m.text}</span>
          <small>{m.sender === mine ? 'Você' : mine === 'user' ? 'Equipe App do DBV' : 'Mensagem'} · {fmtDateTime(m.created_at)}</small>
        </div>
      ))}
      <div ref={end} />
    </div>
  );
}

export function ChatBox({ onSend }) {
  const [text, setText] = useState('');
  const [busy, run] = useAsync();
  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    await run(() => onSend(text.trim()), null);
    setText('');
  };
  return (
    <form className="chat-box" onSubmit={send}>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva sua mensagem" maxLength={2000} />
      <Button busy={busy} disabled={!text.trim()}><Send size={16} /></Button>
    </form>
  );
}

/** Suporte: conversa com a equipe do App do DBV (clube, unidade, liderança e desbravadores). */
export function SupportChat() {
  const state = useLoad(() => api.get('/suporte'));
  useEffect(() => {
    const t = setInterval(() => state.reload(), 10000);
    return () => clearInterval(t);
  }, []);
  return (
    <>
      <PageHeader title="Suporte" subtitle="Fale com a equipe do App do DBV. A gente responde por aqui." />
      <Card className="chat-card">
        <Loading {...state}>
          {(d) => (d.messages.length
            ? <ChatMessages messages={d.messages} mine="user" />
            : <p className="muted small center">Mande sua dúvida, problema ou sugestão. A equipe responde aqui mesmo.</p>)}
        </Loading>
        <ChatBox onSend={(text) => api.post('/suporte', { text }).then(state.reload)} />
      </Card>
    </>
  );
}
