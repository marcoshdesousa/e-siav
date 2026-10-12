import { useState } from 'react';
import { ArrowLeftRight, ArrowRight, Check, Search, X } from 'lucide-react';
import { api } from '../../api.js';
import { fmtCpf, fmtDate } from '../../format.js';
import { Avatar, Badge, Button, Card, Confirm, Empty, Field, Loading, PageHeader, Section, Tabs, useAsync, useLoad } from '../../ui.jsx';

const STATUS = {
  pendente_origem: ['yellow', 'Esperando o clã atual'],
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
          <div className="small muted">Pedido em {fmtDate(t.created_at)}{t.member_status === 'inativo' ? ' · desativado no clã atual' : ''}</div>
          {children && <div className="row wrap" style={{ marginTop: '.5rem', gap: '.35rem' }}>{children}</div>}
        </div>
      </div>
    </Card>
  );
}

/**
 * Transferências: o clã novo pede com nome completo + CPF; o clã atual aceita;
 * o clã novo confirma. Os dados e conquistas vão junto com a pessoa.
 */
export default function TransfersPage() {
  const state = useLoad(() => api.get('/club/transfers'));
  const [tab, setTab] = useState('pedir');
  const [f, setF] = useState({ name: '', cpf: '' });
  const [busy, run] = useAsync();
  const request = async () => {
    const r = await run(() => api.post('/club/transfers', f), null);
    setF({ name: '', cpf: '' });
    state.reload();
    setTab('enviados');
    return r;
  };
  const act = (t, side, accept, msg) => run(() => api.post(`/club/transfers/${t.id}/${side}`, { accept }), msg).then(state.reload);
  const received = state.data?.received || [];
  const sent = state.data?.sent || [];
  const waitingMe = received.filter((t) => t.status === 'pendente_origem').length + sent.filter((t) => t.status === 'pendente_destino').length;
  return (
    <>
      <PageHeader title="Transferências" subtitle="Cada pessoa está em um clã só. Para trazer alguém, peça a transferência." />
      <Tabs tabs={[['pedir', 'Pedir'], ['recebidos', `Recebidos${received.some((t) => t.status === 'pendente_origem') ? ' •' : ''}`], ['enviados', `Enviados${sent.some((t) => t.status === 'pendente_destino') ? ' •' : ''}`]]} value={tab} onChange={setTab} />
      {waitingMe > 0 && tab === 'pedir' && <Card className="small"><b>{waitingMe}</b> pedido{waitingMe > 1 ? 's' : ''} esperando o seu clã.</Card>}

      {tab === 'pedir' && (
        <Card>
          <div className="form">
            <p className="small muted" style={{ marginTop: 0 }}>Informe o <b>nome completo</b> e o <b>CPF</b> da pessoa. Não precisa saber de qual clã ela é: o app encontra e manda o pedido para o clã atual aceitar. Depois que ele aceitar, você confirma aqui.</p>
            <Field label="Nome completo"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="CPF"><input value={f.cpf} onChange={(e) => setF({ ...f, cpf: fmtCpf(e.target.value) })} inputMode="numeric" placeholder="000.000.000-00" /></Field>
            <Button block busy={busy} disabled={f.name.trim().length < 5 || f.cpf.replace(/\D/g, '').length !== 11} onClick={request}><Search size={16} /> Pedir transferência</Button>
          </div>
        </Card>
      )}

      {tab === 'recebidos' && (
        <Loading {...state}>
          {() => (
            <Section title="Pessoas do seu clã pedidas por outro clã">
              {received.length ? received.map((t) => (
                <Row key={t.id} t={t}>
                  {t.status === 'pendente_origem' && (
                    <>
                      <Button small variant="green" onClick={() => act(t, 'origem', true, 'Transferência autorizada. Falta o outro clã confirmar.')}><Check size={14} /> Autorizar</Button>
                      <Confirm text={`Recusar a transferência de ${t.member_name}?`} onYes={() => act(t, 'origem', false, 'Pedido recusado')}><X size={14} /> Recusar</Confirm>
                    </>
                  )}
                </Row>
              )) : <Empty icon={ArrowLeftRight}>Nenhum pedido recebido.</Empty>}
            </Section>
          )}
        </Loading>
      )}

      {tab === 'enviados' && (
        <Loading {...state}>
          {() => (
            <Section title="Pedidos do seu clã">
              {sent.length ? sent.map((t) => (
                <Row key={t.id} t={t}>
                  {t.status === 'pendente_destino' && (
                    <Button small variant="green" onClick={() => act(t, 'destino', true, `${t.member_name.split(' ')[0]} agora é do seu clã!`)}><Check size={14} /> Confirmar entrada</Button>
                  )}
                  {['pendente_origem', 'pendente_destino'].includes(t.status) && (
                    <Confirm text="Cancelar este pedido?" onYes={() => act(t, 'destino', false, 'Pedido cancelado')}>Cancelar</Confirm>
                  )}
                </Row>
              )) : <Empty icon={ArrowLeftRight}>Nenhum pedido enviado.</Empty>}
            </Section>
          )}
        </Loading>
      )}
    </>
  );
}
