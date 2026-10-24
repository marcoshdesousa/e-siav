import { useState } from 'react';
import { ArrowLeftRight, ArrowRight, Check, Search, X } from 'lucide-react';
import { api } from '../../api.js';
import { fmtDate } from '../../format.js';
import { Avatar, Badge, Button, Card, Confirm, Empty, Field, Loading, PageHeader, Section, Tabs, notify, useAsync, useLoad } from '../../ui.jsx';

const STATUS = {
  pendente_origem: ['yellow', 'Esperando o clube atual'],
  pendente_destino: ['blue', 'Esperando confirmação'],
  concluida: ['green', 'Concluída'],
  recusada: ['red', 'Recusada'],
  cancelada: ['', 'Cancelada'],
};

function Row({ t, children }) {
  const [kind, label] = STATUS[t.status];
  return (
    <Card>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <Avatar src={t.member_photo} name={t.member_name} size={44} />
        <div className="grow">
          <div className="row between" style={{ alignItems: 'flex-start' }}><b>{t.member_name}</b><Badge kind={kind}>{label}</Badge></div>
          <div className="small muted ico" style={{ flexWrap: 'wrap' }}>{t.from_club_name} <ArrowRight size={13} /> {t.to_club_name}</div>
          <div className="small muted">Pedido em {fmtDate(t.created_at)}</div>
          {t.reason && <div className="small" style={{ marginTop: '.25rem' }}><b>Motivo:</b> {t.reason}</div>}
          {children && <div className="row wrap" style={{ marginTop: '.5rem', gap: '.35rem' }}>{children}</div>}
        </div>
      </div>
    </Card>
  );
}

/**
 * Transferências: o clube novo pede com o código do membro, o nome do clube atual e o motivo;
 * o clube atual aceita ou recusa. Os dados e as conquistas vão junto com a pessoa.
 */
export default function TransfersPage() {
  const state = useLoad(() => api.get('/club/transfers'));
  const [tab, setTab] = useState('pedir');
  const [f, setF] = useState({ code: '', club_name: '', reason: '' });
  const [busy, run] = useAsync();
  const request = async () => {
    const r = await run(() => api.post('/club/transfers', f), null);
    if (!r) return null;
    notify(r.done ? `Pronto! ${r.member_name.split(' ')[0]} já é do seu clube.` : `Pedido enviado para o ${r.from_club_name}. Quando aceitarem, ${r.member_name.split(' ')[0]} entra no seu clube.`);
    setF({ code: '', club_name: '', reason: '' });
    state.reload();
    setTab(r.done ? 'vieram' : 'pendentes');
    return r;
  };
  const act = (t, side, accept, msg) => run(() => api.post(`/club/transfers/${t.id}/${side}`, { accept }), msg).then(state.reload);
  const received = state.data?.received || [];
  const sent = state.data?.sent || [];
  const waitingMe = received.filter((t) => t.status === 'pendente_origem').length;
  return (
    <>
      <PageHeader title="Transferências" subtitle="Cada pessoa está em um clube só. Para trazer alguém, peça a transferência." />
      <Tabs tabs={[['pedir', 'Pedir'], ['pendentes', 'Pendentes', waitingMe], ['vieram', 'Que vieram'], ['foram', 'Que foram'], ['pedidos', 'Pedidos']]} value={tab} onChange={setTab} />
      {waitingMe > 0 && tab === 'pedir' && <Card className="small"><b>{waitingMe}</b> pedido{waitingMe > 1 ? 's' : ''} esperando o seu clube.</Card>}

      {tab === 'pedir' && (
        <Card>
          <div className="form">
            <p className="small muted" style={{ marginTop: 0 }}>O pedido vai para o clube atual da pessoa aceitar. Quando ele aceitar, ela já entra no seu clube com tudo o que conquistou. Quem criou a conta pelo app (Clube App Brasil) entra na hora.</p>
            <Field label="Código do membro (6 números)"><input inputMode="numeric" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.replace(/\D/g, '').slice(0, 6) })} placeholder="000000" /></Field>
            <Field label="Nome do clube em que ele está agora" hint="Ex.: Águias do Vale (ou Clube App Brasil)"><input value={f.club_name} onChange={(e) => setF({ ...f, club_name: e.target.value })} /></Field>
            <Field label="Motivo da transferência"><textarea rows={3} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Ex.: mudou de cidade e agora frequenta a nossa igreja" /></Field>
            <Button block busy={busy} disabled={f.code.length !== 6 || f.club_name.trim().length < 3 || f.reason.trim().length < 5} onClick={request}><Search size={16} /> Pedir transferência</Button>
          </div>
        </Card>
      )}

      {tab !== 'pedir' && (
        <Loading {...state}>
          {() => {
            const pend = (t) => ['pendente_origem', 'pendente_destino'].includes(t.status);
            const lists = {
              pendentes: [...received.filter(pend).map((t) => ({ t, side: 'origem' })), ...sent.filter(pend).map((t) => ({ t, side: 'destino' }))],
              vieram: sent.filter((t) => t.status === 'concluida').map((t) => ({ t, side: 'destino' })),
              foram: received.filter((t) => t.status === 'concluida').map((t) => ({ t, side: 'origem' })),
              pedidos: sent.map((t) => ({ t, side: 'destino' })),
            };
            const titles = { pendentes: 'Esperando alguém', vieram: 'Pessoas que vieram para o seu clube', foram: 'Pessoas que foram para outro clube', pedidos: 'Tudo o que o seu clube pediu' };
            const list = lists[tab];
            return (
              <Section title={titles[tab]}>
                {list.length ? list.map(({ t, side }) => (
                  <Row key={t.id} t={t}>
                    {side === 'origem' && t.status === 'pendente_origem' && (
                      <>
                        <Button small variant="green" onClick={() => act(t, 'origem', true, `Pronto! ${t.member_name.split(' ')[0]} agora é do ${t.to_club_name}.`)}><Check size={14} /> Aceitar</Button>
                        <Confirm text={`Recusar a transferência de ${t.member_name}?`} onYes={() => act(t, 'origem', false, 'Pedido recusado')}><X size={14} /> Recusar</Confirm>
                      </>
                    )}
                    {side === 'destino' && t.status === 'pendente_origem' && (
                      <Confirm text="Cancelar este pedido?" onYes={() => run(() => api.post(`/club/transfers/${t.id}/cancelar`), 'Pedido cancelado').then(state.reload)}>Cancelar</Confirm>
                    )}
                  </Row>
                )) : <Empty icon={ArrowLeftRight}>Nada por aqui.</Empty>}
              </Section>
            );
          }}
        </Loading>
      )}
    </>
  );
}
