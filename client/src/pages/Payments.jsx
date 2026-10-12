import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Copy, QrCode, Receipt, Users } from 'lucide-react';
import { api } from '../api.js';
import { fmtDate, fmtMoney } from '../format.js';
import { Badge, Button, Card, Confirm, Field, Loading, PageHeader, Section, Tabs, notify, useAsync, useLoad } from '../ui.jsx';

const STATE = { paga: ['green', 'Paga'], aberta: ['', 'Em aberto'], vencida: ['red', 'Vencida'] };

function PixCard({ pixKey }) {
  const copy = async () => {
    try { await navigator.clipboard.writeText(pixKey); notify('Chave Pix copiada!'); } catch { notify('Não deu para copiar.', 'error'); }
  };
  return (
    <Card>
      <div className="row"><span className="trophy-bg"><QrCode size={20} /></span><div className="grow"><b>Pagamento só no Pix</b><div className="small muted">Pague pelo Pix e envie o comprovante para a equipe do Exploradores do Brasil.</div></div></div>
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
            {m.paid_at ? <Badge kind="green">Pago</Badge> : <Badge>Em aberto</Badge>}
            {admin && <Button small variant="secondary" onClick={() => onMark([m.id], !m.paid_at)}>{m.paid_at ? 'Desfazer' : 'Pago'}</Button>}
          </div>
        ))}
      </div>
    </>
  );
}

/** Sistema do Clã: parcelas mensais do clã e taxa anual dos membros. */
export function ClubPayments() {
  const state = useLoad(() => api.get('/club/pagamentos'));
  const [tab, setTab] = useState('cla');
  return (
    <>
      <PageHeader title="Pagamentos" subtitle="Taxas para o clã ficar ativo no Exploradores do Brasil" />
      <Loading {...state}>
        {(p) => (
          <>
            <div className="stats">
              <div className="stat"><span className="stat-icon"><Receipt size={20} /></span><b>{fmtMoney(p.installments_open_cents)}</b><span>Em aberto do clã</span></div>
              <div className="stat"><span className="stat-icon"><Users size={20} /></span><b>{fmtMoney(p.member_fee.due_cents)}</b><span>Taxa dos membros ({p.member_fee.year})</span></div>
            </div>
            <PixCard pixKey={p.pix_key} />
            <Tabs tabs={[['cla', 'Parcelas do clã'], ['membros', 'Taxa dos membros']]} value={tab} onChange={setTab} />
            {tab === 'cla' ? (
              <>
                <p className="small muted">São {p.installments.length} parcelas mensais. Dá para pagar uma por vez, as restantes ou todas de uma vez.</p>
                <Installments list={p.installments} />
              </>
            ) : <MemberFees fee={p.member_fee} />}
          </>
        )}
      </Loading>
    </>
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
              <Section title="Valores">
                <Card>
                  <div className="form">
                    <div className="grid2">
                      <Field label="Parcela mensal do clã (R$)"><input inputMode="decimal" value={v.fee_club_month} onChange={(e) => setF({ ...v, fee_club_month: e.target.value })} /></Field>
                      <Field label="Nº de parcelas"><input type="number" min="1" value={v.club_installments} onChange={(e) => setF({ ...v, club_installments: e.target.value })} /></Field>
                    </div>
                    <Field label="Taxa anual por membro (R$)"><input inputMode="decimal" value={v.fee_member_year} onChange={(e) => setF({ ...v, fee_member_year: e.target.value })} /></Field>
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
                        <div className="sub">Parcelas {c.paid}/{c.total}{c.next_due ? ` · próxima ${fmtDate(c.next_due.due_date)}` : ''} · membros {c.members_total - c.members_unpaid}/{c.members_total}</div>
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
            <Tabs tabs={[['cla', 'Parcelas do clã'], ['membros', 'Taxa dos membros']]} value={tab} onChange={setTab} />
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
