import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Award, Check, Clock, Lock, RotateCcw, ShoppingCart, XCircle } from 'lucide-react';
import { api, toForm } from '../api.js';
import { useAuth } from '../auth.jsx';
import { fmtMoney } from '../format.js';
import {
  Badge, Button, Card, ContentIcon, Empty, Gallery, Loading, Modal, PageHeader, Section, modesLabel, notify, useAsync, useLoad,
} from '../ui.jsx';
import { ResponseFields } from './Requirements.jsx';

const TITLES = {
  especialidade: ['Especialidades', 'Faça especialidades online, cumprindo os requisitos no app'],
  classe: ['Classes', 'Requisitos de cada classe'],
  curso: ['Cursos', 'Cursos em aulas para desbravadores e liderança'],
};

function PriceTag({ c }) {
  if (c.completed) return <Badge kind="yellow"><Award size={13} /> Concluída</Badge>;
  if (c.is_free) return <Badge kind="green">Grátis</Badge>;
  if (c.has_access) return <Badge kind="blue">Liberado</Badge>;
  if (c.purchase_pending) return <Badge kind="yellow">Pedido pendente</Badge>;
  return <span className="price">{fmtMoney(c.price_cents)}</span>;
}

function ContentCard({ c, base }) {
  const pct = c.items_count ? Math.round((c.done_count / c.items_count) * 100) : 0;
  return (
    <Link to={`${base}/conteudo/${c.id}`} className="list-item">
      <span className="content-icon"><ContentIcon c={c} /></span>
      <div className="grow">
        <div className="row between">
          <span className="title">{c.name}</span>
          <PriceTag c={c} />
        </div>
        <div className="sub">
          {c.type === 'classe' && !c.leader ? `${c.age} anos · ` : ''}
          {c.category ? c.category + ' · ' : ''}
          {c.items_count} {c.type === 'curso' ? 'aulas' : 'requisitos'}
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

const ITEM_STATE = {
  enviado: ['yellow', Clock, 'Em análise'],
  aprovado: ['green', Check, 'Aprovado'],
  recusado: ['red', XCircle, 'Recusado'],
};

function ItemSubmitModal({ contentId, item, onClose, onDone }) {
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState([]);
  const [answers, setAnswers] = useState(item.questions.map(() => null));
  const [busy, run] = useAsync();
  const send = async () => {
    if (item.modes.includes('quiz') && answers.some((a) => a === null)) return notify('Responda todas as perguntas', 'error');
    await run(() => api.post(`/content/${contentId}/items/${item.id}/submit`, toForm({ text, photos, answers: item.modes.includes('quiz') ? answers : undefined })), 'Enviado para análise!');
    onDone();
  };
  return (
    <Modal title={item.title} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button busy={busy} onClick={send}>Enviar</Button></>}>
      <div className="form">
        {item.body && <p style={{ whiteSpace: 'pre-wrap' }}>{item.body}</p>}
        <Gallery images={item.images} />
        <ResponseFields modes={item.modes} questions={item.questions} text={text} setText={setText} photos={photos} setPhotos={setPhotos} answers={answers} setAnswers={setAnswers} />
      </div>
    </Modal>
  );
}

export function ContentDetail() {
  const { id } = useParams();
  const state = useLoad(() => api.get('/content/' + id), [id]);
  const [busy, run] = useAsync();
  const [buyMsg, setBuyMsg] = useState(null);
  const [sending, setSending] = useState(null);

  const markDone = async (item, undo = false) => {
    const r = await run(() => api.post(`/content/${id}/items/${item.id}/submit`, { undo }));
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
      {(c) => (
        <>
          <button type="button" className="back-link" onClick={() => history.back()}><ArrowLeft size={16} /> Voltar</button>
          <div className="hero">
            <div className="row" style={{ position: 'relative', zIndex: 1 }}>
              <span className="content-icon" style={{ background: 'rgba(255,255,255,.95)', width: 64, height: 64 }}><ContentIcon c={c} size={30} /></span>
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
                <small>{c.done_count} de {c.items_count} aprovados</small>
              </div>
            )}
          </div>

          {c.completed && <div className="summary-card gold mt"><span className="trophy-bg"><Award size={22} /></span><b>Concluído! Já aparece no seu perfil.</b></div>}

          {!c.has_access && (
            <Card className="mt center">
              <div className="price" style={{ fontSize: '1.6rem' }}>{fmtMoney(c.price_cents)}</div>
              <p className="muted small">Conteúdo pago. O acesso abre depois da compra.</p>
              {c.purchase_pending ? (
                <p><Badge kind="yellow">Pedido registrado — aguardando aprovação</Badge></p>
              ) : (
                <Button variant="red" block busy={busy} onClick={buy}><ShoppingCart size={18} /> Comprar</Button>
              )}
              {buyMsg && <p className="small muted mt">{buyMsg}</p>}
            </Card>
          )}

          <Section title={c.type === 'curso' ? 'Aulas' : 'Requisitos'}>
            <div className="stack">
              {c.items.map((it, i) => {
                const sub = it.submission;
                const st = sub && ITEM_STATE[sub.status];
                const needsSend = it.modes.length > 0;
                return (
                  <div key={it.id} className={'item-step' + (sub?.status === 'aprovado' ? ' done' : '') + (!c.has_access ? ' locked' : '')}>
                    <span className="num">{sub?.status === 'aprovado' ? <Check size={16} strokeWidth={3} /> : i + 1}</span>
                    <div className="grow">
                      <div className="row between" style={{ alignItems: 'flex-start' }}>
                        <b>{it.title}</b>
                        {st && <Badge kind={st[0]}>{(() => { const I = st[1]; return <I size={12} />; })()} {st[2]}</Badge>}
                      </div>
                      {c.has_access ? (
                        <>
                          {it.body && <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{it.body}</p>}
                          <Gallery images={it.images} />
                          {needsSend && <p className="small muted">Enviar: {modesLabel(it.modes)}</p>}
                          {sub?.status === 'recusado' && <p className="small" style={{ color: 'var(--red-ink)' }}>{sub.feedback ? `“${sub.feedback}” — ` : ''}Envie de novo.</p>}
                          {sub?.status === 'aprovado' && sub.feedback && <p className="small muted">Comentário: “{sub.feedback}”</p>}
                          <div className="row" style={{ marginTop: '.4rem' }}>
                            {needsSend ? (
                              (!sub || sub.status === 'recusado') && <Button small onClick={() => setSending(it)}>{sub ? 'Enviar novamente' : 'Responder'}</Button>
                            ) : sub ? (
                              <Button small variant="secondary" disabled={busy} onClick={() => markDone(it, true)}><RotateCcw size={14} /> Desfazer</Button>
                            ) : (
                              <Button small disabled={busy} onClick={() => markDone(it)}>{c.type === 'curso' ? 'Aula concluída' : 'Marcar como feito'}</Button>
                            )}
                          </div>
                        </>
                      ) : <p className="small muted ico"><Lock size={14} /> Disponível após a compra</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
          {sending && <ItemSubmitModal contentId={c.id} item={sending} onClose={() => setSending(null)} onDone={() => { setSending(null); state.reload(); }} />}
        </>
      )}
    </Loading>
  );
}
