import { useState } from 'react';
import { ArrowLeftRight, ArrowRight, Check, Search, X } from 'lucide-react';
import { api } from '../../api.js';
import { fmtDate } from '../../format.js';
import { Avatar, Badge, Button, Card, Confirm, Empty, Field, Loading, PageHeader, Section, Tabs, useAsync, useLoad } from '../../ui.jsx';

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
          <div className="small muted">Pedido em {fmtDate(t.created_at)}{t.member_status === 'inativo' ? ' · desativado no clube atual' : ''}</div>
          {children && <div className="row wrap" style={{ marginTop: '.5rem', gap: '.35rem' }}>{children}</div>}
        </div>
      </div>
    </Card>
  );
}

/**
 * Transferências: o clube novo pede com nome completo + código do membro; o clube atual aceita;
 * o clube novo confirma. Os dados e conquistas vão junto com a pessoa.
 */
export default function TransfersPage() {
  const state = useLoad(() => api.get('/club/transfers'));
  const [tab, setTab] = useState('pedir');
  const [f, setF] = useState({ name: '', cpf: '' });
  const [busy, run] = useAsync();
  const request = async () => {
    const r = await run(() => api.post('/club/transfers', { name: f.name, doc: f.cpf }), null);
    setF({ name: '', cpf: '' });
    state.reload();
    setTab('pendentes');
    return r;
  };
  const act = (t, side, accept, msg) => run(() => api.post(`/club/transfers/${t.id}/${side}`, { accept }), msg).then(state.reload);
  const received = state.data?.received || [];
  const sent = state.data?.sent || [];
  const waitingMe = received.filter((t) => t.status === 'pendente_origem').length + sent.filter((t) => t.status === 'pendente_destino').length;
  return (
    <>
      <PageHeader title="Transferências" subtitle="Cada pessoa está em um clube só. Para trazer alguém, peça a transferência." />
      <Tabs tabs={[['pedir', 'Pedir'], ['pendentes', 'Pendentes', waitingMe], ['vieram', 'Que vieram'], ['foram', 'Que foram'], ['pedidos', 'Pedidos']]} value={tab} onChange={setTab} />
      {waitingMe > 0 && tab === 'pedir' && <Card className="small"><b>{waitingMe}</b> pedido{waitingMe > 1 ? 's' : ''} esperando o seu clube.</Card>}

      {tab === 'pedir' && (
        <Card>
          <div className="form">
            <p className="small muted" style={{ marginTop: 0 }}>Informe o <b>nome completo</b> e o <b>código do membro</b> (6 números) da pessoa. Não precisa saber de qual clube ela é: o app encontra e manda o pedido para o clube atual aceitar. Depois que ele aceitar, você confirma aqui.</p>
            <Field label="Nome completo"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Código do membro (6 números)"><input inputMode="numeric" value={f.cpf} onChange={(e) => setF({ ...f, cpf: e.target.value.replace(/\D/g, '').slice(0, 6) })} placeholder="000000" /></Field>
            <Button block busy={busy} disabled={f.name.trim().length < 5 || f.cpf.length !== 6} onClick={request}><Search size={16} /> Pedir transferência</Button>
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
                        <Button small variant="green" onClick={() => act(t, 'origem', true, 'Transferência autorizada. Falta o outro clube confirmar.')}><Check size={14} /> Autorizar saída</Button>
                        <Confirm text={`Recusar a transferência de ${t.member_name}?`} onYes={() => act(t, 'origem', false, 'Pedido recusado')}><X size={14} /> Recusar</Confirm>
                      </>
                    )}
                    {side === 'destino' && t.status === 'pendente_destino' && (
                      <Button small variant="green" onClick={() => act(t, 'destino', true, `${t.member_name.split(' ')[0]} agora é do seu clube!`)}><Check size={14} /> Confirmar entrada</Button>
                    )}
                    {side === 'destino' && pend(t) && (
                      <Confirm text="Cancelar este pedido?" onYes={() => act(t, 'destino', false, 'Pedido cancelado')}>Cancelar</Confirm>
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
