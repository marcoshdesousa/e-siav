import { useState } from 'react';
import { CheckCheck, Copy, Eye, Link2, MapPin, MessageCircle, Users } from 'lucide-react';
import { api } from '../../api.js';
import { fmtCpf, fmtDateTime } from '../../format.js';
import { Button, Card, Empty, Loading, PageHeader, Tabs, notify, useAsync, useLoad } from '../../ui.jsx';

/** Link público para quem quer criar um clã (aparece na aba Clãs do admin). */
export function CreateClanLink() {
  const url = `${location.origin}/criar-cla`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); notify('Link copiado!'); } catch { notify('Não deu para copiar. Selecione o link e copie.', 'error'); }
  };
  return (
    <Card className="mt">
      <b>Link para criar clã</b>
      <p className="small muted" style={{ margin: '.2rem 0 .5rem' }}>Quem quer abrir um clã preenche este formulário. Os pedidos chegam em <b>Inscrição clã</b>.</p>
      <div className="signup-link"><Link2 size={16} /> <span className="ellipsis">{url}</span></div>
      <div className="row mt"><Button small onClick={copy}><Copy size={14} /> Copiar link</Button></div>
    </Card>
  );
}

const waLink = (a) => {
  const digits = a.whatsapp.replace(/\D/g, '');
  const phone = digits.length <= 11 ? '55' + digits : digits;
  const text = `Olá, ${a.name.split(' ')[0]}! Aqui é da equipe do Exploradores do Brasil. Recebemos o seu pedido para criar um clã em ${a.city}/${a.uf}.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
};

/** Pedidos para criar clã: não visualizados e visualizados (os mais antigos em cima). */
export default function ClanApplications() {
  const [tab, setTab] = useState('novos');
  const state = useLoad(() => api.get('/admin/cla-inscricoes' + (tab === 'vistos' ? '?visualizados=1' : '')), [tab]);
  const [, run] = useAsync();
  const unviewed = state.data?.unviewed;
  return (
    <>
      <PageHeader title="Inscrição clã" subtitle="Pedidos de quem quer criar um clã" />
      <Tabs tabs={[['novos', 'Não visualizados', unviewed], ['vistos', 'Visualizados']]} value={tab} onChange={setTab} />
      <Loading {...state}>
        {(d) => (d.items.length ? d.items.map((a) => (
          <Card key={a.id}>
            <div className="row between" style={{ alignItems: 'flex-start' }}>
              <h3 className="grow">{a.name}</h3>
              <span className="small muted">{fmtDateTime(a.created_at)}</span>
            </div>
            {a.clan_name && <p className="small" style={{ margin: '.2rem 0' }}>Nome do clã: <b>{a.clan_name}</b></p>}
            <p className="small muted ico"><MapPin size={14} /> {a.neighborhood} · {a.city}/{a.uf}</p>
            <p className="small muted">CPF {fmtCpf(a.cpf)} · WhatsApp {a.whatsapp}</p>
            <div className="app-counts">
              <span><Users size={13} /> <b>{a.adults}</b> com 18+</span>
              <span><b>{a.teens}</b> com 16 e 17</span>
              <span><b>{a.kids_6_9}</b> crianças de 6 a 9 no bairro</span>
              <span><b>{a.kids_10_15}</b> de 10 a 15 no bairro</span>
            </div>
            <div className="row wrap mt">
              <a href={waLink(a)} target="_blank" rel="noreferrer"><Button small variant="green"><MessageCircle size={14} /> Chamar no WhatsApp</Button></a>
              {!a.viewed_at
                ? <Button small variant="secondary" onClick={() => run(() => api.post(`/admin/cla-inscricoes/${a.id}/visualizar`), 'Marcado como visualizado').then(state.reload)}><Eye size={14} /> Marcar como visualizado</Button>
                : <span className="small muted ico"><CheckCheck size={14} /> Visualizado em {fmtDateTime(a.viewed_at)}</span>}
            </div>
          </Card>
        )) : <Empty>{tab === 'novos' ? 'Nenhum pedido novo.' : 'Nenhum pedido visualizado ainda.'}</Empty>)}
      </Loading>
    </>
  );
}
