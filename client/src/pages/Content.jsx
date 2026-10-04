import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Award, Check, Lock, ShoppingCart } from 'lucide-react';
import { api } from '../api.js';
import { AppIcon } from '../icons.jsx';
import { useAuth } from '../auth.jsx';
import { fmtMoney } from '../format.js';
import { Badge, Button, Card, Empty, Loading, PageHeader, Section, useAsync, useLoad, notify } from '../ui.jsx';

const TITLES = {
  especialidade: ['Especialidades', 'Faça especialidades online, cumprindo as atividades no app'],
  classe: ['Classes', 'Requisitos de cada classe'],
  curso: ['Cursos', 'Cursos em aulas para desbravadores e liderança'],
};

function PriceTag({ c }) {
  if (c.completed) return <Badge kind="yellow"><span className="ico"><Award size={13} /> Concluída</span></Badge>;
  if (c.is_free) return <Badge kind="green">Grátis</Badge>;
  if (c.has_access) return <Badge kind="blue">Liberado</Badge>;
  if (c.purchase_pending) return <Badge kind="yellow">Pedido pendente</Badge>;
  return <span className="price">{fmtMoney(c.price_cents)}</span>;
}

function ContentCard({ c, base }) {
  const pct = c.items_count ? Math.round((c.done_count / c.items_count) * 100) : 0;
  return (
    <Link to={`${base}/conteudo/${c.id}`} className="list-item">
      <span className="content-icon"><AppIcon name={c.icon} size={26} /></span>
      <div className="grow">
        <div className="row between">
          <span className="title">{c.name}</span>
          <PriceTag c={c} />
        </div>
        <div className="sub">
          {c.type === 'classe' && !c.leader ? `${c.age} anos · ` : ''}
          {c.category ? c.category + ' · ' : ''}
          {c.items_count} {c.type === 'curso' ? 'aulas' : c.type === 'classe' ? 'requisitos' : 'atividades'}
        </div>
        {c.has_access && <div className={'progress' + (c.completed ? ' done' : '')}><span style={{ width: (c.completed ? 100 : pct) + '%' }} /></div>}
      </div>
    </Link>
  );
}

export function ContentList({ type, base }) {
  const { actor } = useAuth();
  const state = useLoad(() => api.get('/content?type=' + type), [type]);
  const [title, subtitle] = TITLES[type];
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <Loading {...state} empty="Nenhum conteúdo cadastrado ainda.">
        {(list) => {
          if (type !== 'classe') return <div className="list">{list.map((c) => <ContentCard key={c.id} c={c} base={base} />)}</div>;
          const mine = list.filter((c) => c.is_my_class);
          const regular = list.filter((c) => !c.leader && !c.is_my_class);
          const leader = list.filter((c) => c.leader);
          return (
            <>
              {actor.kind === 'desbravador' && (
                <Section title="Sua classe">
                  {mine.length ? <div className="list">{mine.map((c) => <ContentCard key={c.id} c={c} base={base} />)}</div> : <Empty>Não há classe cadastrada para a sua idade.</Empty>}
                </Section>
              )}
              {actor.kind === 'lideranca' && (
                <Section title="Classes de líder">
                  <div className="list">{leader.map((c) => <ContentCard key={c.id} c={c} base={base} />)}</div>
                </Section>
              )}
              <Section title={actor.kind === 'desbravador' ? 'Outras classes' : 'Classes regulares'}>
                <p className="muted small" style={{ marginTop: '-.3rem', marginBottom: '.6rem' }}>Qualquer membro pode adquirir classes além da sua.</p>
                <div className="list">{regular.map((c) => <ContentCard key={c.id} c={c} base={base} />)}</div>
              </Section>
            </>
          );
        }}
      </Loading>
    </>
  );
}

export function ContentDetail() {
  const { id } = useParams();
  const state = useLoad(() => api.get('/content/' + id), [id]);
  const [busy, run] = useAsync();
  const [buyMsg, setBuyMsg] = useState(null);

  const toggle = async (item) => {
    const r = await run(() => api.post(`/content/${id}/items/${item.id}/done`, { undo: !!item.done_at }));
    if (r.completed) notify('Parabéns! Concluído e já aparece no seu perfil.');
    state.reload();
  };
  const buy = async () => {
    const r = await run(() => api.post(`/content/${id}/buy`));
    setBuyMsg(r.message);
    if (r.checkout_url) location.href = r.checkout_url;
    state.reload();
  };

  return (
    <Loading {...state}>
      {(c) => {
        const verb = c.type === 'curso' ? 'Aula concluída' : 'Marcar como feito';
        return (
          <>
            <button className="back-link" style={{ border: 0, background: 'none', cursor: 'pointer', padding: 0 }} onClick={() => history.back()}><ArrowLeft size={16} /> Voltar</button>
            <div className="hero">
              <div className="row" style={{ position: 'relative', zIndex: 1 }}>
                <span className="content-icon" style={{ background: 'rgba(255,255,255,.18)', color: '#fff' }}><AppIcon name={c.icon} size={26} /></span>
                <div className="grow">
                  <h1>{c.name}</h1>
                  <div className="muted small">
                    {c.type === 'classe' ? (c.leader ? 'Classe de líder' : `Classe · ${c.age} anos`) : c.type === 'curso' ? 'Curso' : `Especialidade${c.category ? ' · ' + c.category : ''}`}
                  </div>
                </div>
              </div>
              {c.description && <p style={{ position: 'relative', zIndex: 1 }}>{c.description}</p>}
              {c.has_access && (
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div className={'progress' + (c.completed ? ' done' : '')}><span style={{ width: (c.items_count ? (c.done_count / c.items_count) * 100 : 0) + '%' }} /></div>
                  <small>{c.done_count} de {c.items_count} concluídos</small>
                </div>
              )}
            </div>

            {c.completed && <div className="summary-card gold mt"><span className="trophy-bg"><Award size={22} /></span><b>Concluído! Já aparece no seu perfil.</b></div>}

            {!c.has_access && (
              <Card className="mt center">
                <div className="price" style={{ fontSize: '1.6rem' }}>{fmtMoney(c.price_cents)}</div>
                <p className="muted small">Conteúdo pago. O acesso abre depois da compra.</p>
                {c.purchase_pending ? (
                  <p><Badge kind="yellow">Pedido registrado — aguardando liberação</Badge></p>
                ) : (
                  <Button variant="red" block busy={busy} onClick={buy}><ShoppingCart size={18} /> Comprar</Button>
                )}
                {buyMsg && <p className="small muted mt">{buyMsg}</p>}
              </Card>
            )}

            <Section title={c.type === 'curso' ? 'Aulas' : c.type === 'classe' ? 'Requisitos' : 'Atividades'}>
              <div className="stack">
                {c.items.map((it, i) => (
                  <div key={it.id} className={'item-step' + (it.done_at ? ' done' : '') + (!c.has_access ? ' locked' : '')}>
                    <span className="num">{it.done_at ? <Check size={16} strokeWidth={3} /> : i + 1}</span>
                    <div className="grow">
                      <b>{it.title}</b>
                      {c.has_access ? <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{it.body}</p> : <p className="small muted ico"><Lock size={14} /> Disponível após a compra</p>}
                      {c.has_access && (
                        <Button small variant={it.done_at ? 'secondary' : 'primary'} disabled={busy} onClick={() => toggle(it)}>
                          {it.done_at ? 'Desfazer' : verb}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </>
        );
      }}
    </Loading>
  );
}
