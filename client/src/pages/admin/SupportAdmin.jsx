import { useEffect, useState } from 'react';
import { Globe, MessageCircle } from 'lucide-react';
import { api } from '../../api.js';
import { fmtDateTime } from '../../format.js';
import { Avatar, Badge, Button, Card, Empty, Field, Loading, Modal, PageHeader, useAsync, useLoad } from '../../ui.jsx';
import { ChatBox, ChatMessages } from '../Shared.jsx';

const TIPO = { club: 'Clube', unit: 'Unidade', member: 'Membro' };

/** Equipe: conversas do suporte de todos os clubes, unidades e membros. */
export default function SupportAdmin() {
  const state = useLoad(() => api.get('/admin/suporte'));
  const [open, setOpen] = useState(null);
  useEffect(() => {
    const t = setInterval(() => state.reload(), 15000);
    return () => clearInterval(t);
  }, []);
  return (
    <>
      <PageHeader title="Suporte" subtitle="Mensagens dos clubes, unidades e membros" />
      <Loading {...state}>
        {(rows) => (rows.length ? (
          <div className="list">
            {rows.map((t) => (
              <button type="button" key={t.id} className="list-item" onClick={() => setOpen(t.id)}>
                <Avatar src={t.photo} name={t.name} size={42} square={t.type !== 'member'} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="title">{t.name} <Badge>{TIPO[t.type]}</Badge></div>
                  <div className="sub ellipsis">{t.last ? `${t.last.sender === 'admin' ? 'Você: ' : ''}${t.last.text}` : t.sub}</div>
                  {t.last && <div className="sub small">{fmtDateTime(t.last.created_at)}</div>}
                </div>
                {t.unread > 0 && <span className="nav-badge static">{t.unread}</span>}
              </button>
            ))}
          </div>
        ) : <Empty icon={MessageCircle}>Nenhuma mensagem ainda.</Empty>)}
      </Loading>
      {open && <Conversation id={open} onClose={() => { setOpen(null); state.reload(); }} />}
    </>
  );
}

function Conversation({ id, onClose }) {
  const state = useLoad(() => api.get('/admin/suporte/' + id), [id]);
  useEffect(() => {
    const t = setInterval(() => state.reload(), 8000);
    return () => clearInterval(t);
  }, [id]);
  return (
    <Modal title={state.data ? state.data.name : 'Conversa'} onClose={onClose}>
      <Loading {...state}>
        {(d) => (
          <>
            <p className="small muted" style={{ marginTop: 0 }}>{TIPO[d.type]} · {d.sub}</p>
            <ChatMessages messages={d.messages} mine="admin" />
            <ChatBox onSend={(text) => api.post('/admin/suporte/' + id, { text }).then(state.reload)} />
          </>
        )}
      </Loading>
    </Modal>
  );
}

/** Links dos sites que abrem dentro do app. */
export function LinksAdmin() {
  const state = useLoad(() => api.get('/admin/configuracoes'));
  const [f, setF] = useState(null);
  const [busy, run] = useAsync();
  return (
    <>
      <PageHeader title="Links dos sites" subtitle="Os sites abrem dentro do app, sem sair" />
      <Loading {...state}>
        {(c) => {
          const v = f || c;
          const set = (k) => (e) => setF({ ...v, [k]: e.target.value });
          return (
            <Card>
              <div className="form">
                <Field label="SGC (aparece só para o clube)"><input value={v.link_sgc} onChange={set('link_sgc')} placeholder="https://..." inputMode="url" /></Field>
                <Field label="Cantinho da Unidade (aparece para as unidades)"><input value={v.link_cantinho} onChange={set('link_cantinho')} placeholder="https://..." inputMode="url" /></Field>
                <Field label="Cartão DBV (aparece para os membros)"><input value={v.link_cartao} onChange={set('link_cartao')} placeholder="https://..." inputMode="url" /></Field>
                <p className="small muted"><Globe size={13} style={{ verticalAlign: '-2px' }} /> Sem link, a pasta mostra “Em breve”. Alguns sites não deixam abrir dentro de outro; nesse caso aparece o botão “Abrir fora”.</p>
                <Button busy={busy} disabled={!f} onClick={() => run(() => api.put('/admin/configuracoes', v), 'Links salvos!').then(() => { setF(null); state.reload(); })}>Salvar</Button>
              </div>
            </Card>
          );
        }}
      </Loading>
    </>
  );
}

