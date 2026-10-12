import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Copy, QrCode, Receipt, Users } from 'lucide-react';
import { api } from '../api.js';
import { fmtDate, fmtMoney } from '../format.js';
import { Badge, Button, Card, Confirm, Field, Loading, Modal, PageHeader, Section, Tabs, notify, useAsync, useLoad } from '../ui.jsx';

const STATE = { paga: ['green', 'Paga'], aberta: ['', 'Em aberto'], vencida: ['red', 'Vencida'] };

function PixCard({ pixKey }) {
  const copy = async () => {
    try { await navigator.clipboard.writeText(pixKey); notify('Chave Pix copiada!'); } catch { notify('Não deu para copiar.', 'error'); }
  };
  return (
    <Card>
      <div className="row"><span className="trophy-bg"><QrCode size={20} /></span><div className="grow"><b>Pagamento só no Pix</b><div className="small muted">Pague pelo Pix. A equipe do Exploradores do Brasil confirma o recebimento.</div></div></div>
      {pixKey ? (
        <div className="row mt"><div className="signup-link grow"><span className="ellipsis">{pixKey}</span></div><Button small onClick={copy}><Copy size={14} /> Copiar</Button></div>
      ) : <p className="small muted">A chave Pix aparece aqui quando a equipe cadastrar.</p>}
    </Card>
  );
}

function Installments({ list, admin, onToggle }) {
  return (
    <div className="list">
      {list.map((i) => (
        <div key={i.id} className="list-item">
          <span className={'pay-n' + (i.paid_at ? ' ok' : '')}>{i.paid_at ? <CheckCircle2 size={18} /> : i.n}</span>
          <div className="grow">
            <div className="title">Parcela {i.n} · {fmtMoney(i.amount_cents)}</div>
            <div className="sub">Vence em {fmtDate(i.due_date)}{i.paid_at ? ` · paga em ${fmtDate(i.paid_at)}` : ''}</div>
          </div>
          <Badge kind={STATE[i.state][0]}>{STATE[i.state][1]}</Badge>
          {admin && <Button small variant="secondary" onClick={() => onToggle(i)}>{i.paid_at ? 'Desfazer' : 'Paga'}</Button>}
        </div>
      ))}
    </div>
  );
}

function MemberFees({ fee, admin, onMark }) {
  return (
    <>
      <p className="small muted">{fmtMoney(fee.amount_cents)} por membro, por ano · {fee.paid_count} de {fee.members.length} pagos · falta {fmtMoney(fee.due_cents)}</p>
      <div className="list">
        {fee.members.map((m) => (
          <div key={m.id} className="list-item">
            <div className="grow"><div className="title">{m.name}</div><div className="sub">Código {m.code}</div></div>
            {feeBadge(m)}
            {admin && <Button small variant="secondary" onClick={() => onMark([m.id], !m.paid_at)}>{m.paid_at ? 'Desfazer' : 'Pago'}</Button>}
          </div>
        ))}
      </div>
    </>
  );
}

/** Situação da inscrição do ano de um membro. */
const feeBadge = (m) => (m.paid_at ? <Badge kind="green">Pago</Badge>
  : m.order_id ? <Badge kind="blue">Esperando confirmação</Badge>
    : m.needs_approval ? <Badge>Aprove a inscrição primeiro</Badge>
      : <Badge kind="yellow">{m.renewal ? 'Falta renovar' : 'Falta pagar'}</Badge>);

/** Inscrição do ano: o clã marca uma ou várias pessoas e paga tudo de uma vez no Pix. */
function ClubMemberFees({ p, onDone }) {
  const fee = p.member_fee;
  const payable = fee.members.filter((m) => !m.paid_at && !m.order_id && !m.needs_approval);
  const [sel, setSel] = useState(new Set());
  const [paying, setPaying] = useState(false);
  const [busy, run] = useAsync();
  const toggle = (id) => { const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); setSel(n); };
  const all = sel.size === payable.length && payable.length > 0;
  const total = sel.size * fee.amount_cents;
  const send = async () => {
    await run(() => api.post('/club/pagamentos/inscricoes', { member_ids: [...sel] }), 'Pagamento enviado! Assim que o Pix for confirmado, os membros são liberados.');
    setSel(new Set()); setPaying(false); onDone();
  };
  return (
    <>
      <p className="small muted">Inscrição de {fee.year}: {fmtMoney(fee.amount_cents)} por membro. Marque quem vai participar e pague tudo de uma vez. Quem é novo ou não foi renovado só usa o app depois disso.</p>
      {p.orders.map((o) => (
        <Card key={o.id} className="small">
          <div className="row">
            <div className="grow"><b>Pagamento de {o.member_ids.length} inscrição{o.member_ids.length > 1 ? 'ões' : ''} · {fmtMoney(o.amount_cents)}</b><div className="muted">Enviado em {fmtDate(o.created_at)} · esperando a confirmação do Pix</div></div>
            <Confirm text="Cancelar este pagamento?" onYes={() => run(() => api.post(`/club/pagamentos/inscricoes/${o.id}/cancelar`), 'Pagamento cancelado').then(onDone)}>Cancelar</Confirm>
          </div>
        </Card>
      ))}
      {payable.length > 0 && (
        <label className="row check-all"><input type="checkbox" checked={all} onChange={() => setSel(all ? new Set() : new Set(payable.map((m) => m.id)))} /> Selecionar todos que faltam ({payable.length})</label>
      )}
      <div className="list">
        {fee.members.map((m) => {
          const can = payable.includes(m);
          return (
            <label key={m.id} className={'list-item' + (can ? ' pick' : '')}>
              {can ? <input type="checkbox" checked={sel.has(m.id)} onChange={() => toggle(m.id)} /> : <span style={{ width: 18 }} />}
              <div className="grow"><div className="title">{m.name}</div><div className="sub">Código {m.code}</div></div>
              {feeBadge(m)}
            </label>
          );
        })}
      </div>
      {sel.size > 0 && (
        <div className="pay-bar">
          <span><b>{sel.size}</b> selecionado{sel.size > 1 ? 's' : ''} · <b>{fmtMoney(total)}</b></span>
          <Button onClick={() => setPaying(true)}>Pagar inscrição</Button>
        </div>
      )}
      {paying && (
        <Modal title="Pagar inscrição" onClose={() => setPaying(false)}
          footer={<><Button variant="secondary" onClick={() => setPaying(false)}>Voltar</Button><Button busy={busy} onClick={send}><CheckCircle2 size={16} /> Já fiz o Pix</Button></>}>
          <p className="center" style={{ margin: 0 }}>{sel.size} membro{sel.size > 1 ? 's' : ''} × {fmtMoney(fee.amount_cents)}</p>
          <div className="code-big">{fmtMoney(total)}</div>
          <PixCard pixKey={p.pix_key} />
          <p className="small muted">Faça o Pix desse valor e toque em <b>Já fiz o Pix</b>. Quando a equipe confirmar, os membros são liberados no app.</p>
        </Modal>
      )}
    </>
  );
}

/** Sistema do Clã: parcelas mensais do clã e inscrição anual dos membros. */
export function ClubPayments() {
  const state = useLoad(() => api.get('/club/pagamentos'));
  const [tab, setTab] = useState(new URLSearchParams(location.search).get('aba') === 'membros' ? 'membros' : 'cla');
  return (
    <>
      <PageHeader title="Pagamentos" subtitle="Plano do clã e inscrição dos membros no Exploradores do Brasil" />
      <Loading {...state}>
        {(p) => (
          <>
            <div className="stats">
              <div className="stat"><span className="stat-icon"><Receipt size={20} /></span><b>{fmtMoney(p.installments_open_cents)}</b><span>Em aberto do clã</span></div>
              <div className="stat"><span className="stat-icon"><Users size={20} /></span><b>{fmtMoney(p.member_fee.due_cents)}</b><span>Inscrições de {p.member_fee.year}</span></div>
            </div>
            <Tabs tabs={[['cla', 'Plano do clã'], ['membros', 'Inscrição dos membros']]} value={tab} onChange={setTab} />
            {tab === 'cla' ? (
              <>
                <PixCard pixKey={p.pix_key} />
                <p className="small muted">São {p.installments.length} parcelas mensais. Dá para pagar uma por vez, as restantes ou todas de uma vez.</p>
                <Installments list={p.installments} />
              </>
            ) : <ClubMemberFees p={p} onDone={state.reload} />}
          </>
        )}
      </Loading>
    </>
  );
}

/** Equipe: pagamentos de inscrição enviados pelos clãs, esperando a confirmação do Pix. */
function PendingOrders({ onDone }) {
  const state = useLoad(() => api.get('/admin/pagamentos/inscricoes'));
  const [busy, run] = useAsync();
  const act = (o, what) => run(() => api.post(`/admin/pagamentos/inscricoes/${o.id}/${what}`), what === 'confirmar' ? 'Confirmado! Membros liberados.' : 'Pagamento recusado').then(() => { state.reload(); onDone(); });
  if (!state.data?.length) return null;
  return (
    <Section title={`Inscrições para confirmar (${state.data.length})`}>
      <div className="list">
        {state.data.map((o) => (
          <div key={o.id} className="list-item">
            <div className="grow">
              <div className="title">{o.club_name} · {fmtMoney(o.amount_cents)}</div>
              <div className="sub">{o.members.length} membro{o.members.length > 1 ? 's' : ''} ({o.year}): {o.members.map((m) => m.name).join(', ')} · enviado em {fmtDate(o.created_at)}</div>
              <div className="row wrap" style={{ marginTop: '.45rem', gap: '.35rem' }}>
                <Button small busy={busy} onClick={() => act(o, 'confirmar')}><CheckCircle2 size={14} /> Pix recebido</Button>
                <Confirm text={`Recusar o pagamento de ${o.club_name}?`} onYes={() => act(o, 'recusar')}>Recusar</Confirm>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/** Administrador: valores, chave Pix e situação de cada clã. */
export function AdminPayments({ base }) {
  const state = useLoad(() => api.get('/admin/pagamentos'));
  const [f, setF] = useState(null);
  const [busy, run] = useAsync();
  const cents = (c) => (c / 100).toFixed(2).replace('.', ',');
  return (
    <>
      <PageHeader title="Pagamentos" subtitle="Taxas dos clãs e dos membros (Pix)" />
      <Loading {...state}>
        {({ config, clubs }) => {
          const v = f || { fee_member_year: cents(config.fee_member_year_cents), fee_club_month: cents(config.fee_club_month_cents), club_installments: config.club_installments, pix_key: config.pix_key };
          return (
            <>
              <PendingOrders onDone={state.reload} />
              <Section title="Valores">
                <Card>
                  <div className="form">
                    <div className="grid2">
                      <Field label="Plano mensal do clã (R$)"><input inputMode="decimal" value={v.fee_club_month} onChange={(e) => setF({ ...v, fee_club_month: e.target.value })} /></Field>
                      <Field label="Nº de parcelas"><input type="number" min="1" value={v.club_installments} onChange={(e) => setF({ ...v, club_installments: e.target.value })} /></Field>
                    </div>
                    <Field label="Inscrição anual por membro (R$)"><input inputMode="decimal" value={v.fee_member_year} onChange={(e) => setF({ ...v, fee_member_year: e.target.value })} /></Field>
                    <Field label="Chave Pix" hint="Aparece para os clãs na tela de pagamentos"><input value={v.pix_key} onChange={(e) => setF({ ...v, pix_key: e.target.value })} /></Field>
                    <p className="small muted">Os valores novos valem para os clãs criados daqui pra frente. Para mudar as parcelas em aberto de um clã, abra o clã abaixo.</p>
                    <Button busy={busy} disabled={!f} onClick={() => run(() => api.put('/admin/pagamentos/config', v), 'Valores salvos!').then(() => { setF(null); state.reload(); })}>Salvar</Button>
                  </div>
                </Card>
              </Section>
              <Section title="Clãs">
                <div className="list">
                  {clubs.map((c) => (
                    <Link key={c.id} to={`${base}/pagamentos/${c.id}`} className="list-item">
                      <div className="grow">
                        <div className="title">{c.name}</div>
                        <div className="sub">Parcelas {c.paid}/{c.total}{c.next_due ? ` · próxima ${fmtDate(c.next_due.due_date)}` : ''} · inscrições {c.members_total - c.members_unpaid}/{c.members_total}</div>
                      </div>
                      {c.overdue ? <Badge kind="red">{c.overdue} vencida{c.overdue > 1 ? 's' : ''}</Badge> : c.paid === c.total ? <Badge kind="green">Em dia</Badge> : null}
                    </Link>
                  ))}
                </div>
              </Section>
            </>
          );
        }}
      </Loading>
    </>
  );
}

/** Administrador: parcelas e taxa dos membros de um clã. */
export function AdminClubPayments({ base }) {
  const { id } = useParams();
  const state = useLoad(() => api.get(`/admin/pagamentos/${id}`), [id]);
  const [tab, setTab] = useState('cla');
  const [amount, setAmount] = useState('');
  const [busy, run] = useAsync();
  const toggle = (i) => run(() => api.post(`/admin/pagamentos/parcela/${i.id}`, { paid: !i.paid_at }), i.paid_at ? 'Desfeito' : 'Parcela paga!').then(state.reload);
  const mark = (ids, paid) => run(() => api.post('/admin/pagamentos/membros', { member_ids: ids, paid, year: state.data.member_fee.year }), paid ? 'Marcado como pago' : 'Desfeito').then(state.reload);
  return (
    <>
      <Link to={`${base}/pagamentos`} className="back-link"><ArrowLeft size={16} /> Pagamentos</Link>
      <Loading {...state}>
        {(p) => (
          <>
            <PageHeader title={p.club.name} subtitle={`Código ${p.club.code} · em aberto ${fmtMoney(p.installments_open_cents)}`} />
            <Tabs tabs={[['cla', 'Plano do clã'], ['membros', 'Inscrição dos membros']]} value={tab} onChange={setTab} />
            {tab === 'cla' ? (
              <>
                <div className="row wrap" style={{ marginBottom: '.7rem' }}>
                  <Confirm text="Marcar todas as parcelas em aberto como pagas?" onYes={() => run(() => api.post(`/admin/pagamentos/${id}/pagar-tudo`), 'Tudo pago!').then(state.reload)}>Pagou tudo</Confirm>
                  <input style={{ width: 110 }} placeholder="Novo valor" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  <Button small variant="secondary" busy={busy} disabled={!amount} onClick={() => run(() => api.put(`/admin/pagamentos/${id}/valor`, { amount }), 'Valor das parcelas em aberto alterado').then(() => { setAmount(''); state.reload(); })}>Mudar parcelas em aberto</Button>
                </div>
                <Installments list={p.installments} admin onToggle={toggle} />
              </>
            ) : (
              <>
                <Button small onClick={() => mark(p.member_fee.members.filter((m) => !m.paid_at).map((m) => m.id), true)}>Marcar todos como pagos</Button>
                <MemberFees fee={p.member_fee} admin onMark={mark} />
              </>
            )}
          </>
        )}
      </Loading>
    </>
  );
}
