import { useState } from 'react';
import { ArrowLeftRight, ArrowRight, Check, Search, X } from 'lucide-react';
import { api } from '../../api.js';
import { fmtDate } from '../../format.js';
import { Avatar, Badge, Button, Card, Confirm, Empty, Field, Loading, PageHeader, Section, Tabs, notify, useAsync, useLoad } from '../../ui.jsx';

function Row({ t, children }) {
  return (
    <Card>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <Avatar src={t.member_photo} name={t.member_name} size={44} />
        <div className="grow">
          <div className="row between" style={{ alignItems: 'flex-start' }}><b>{t.member_name}</b><Badge kind="yellow">Esperando</Badge></div>
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
 * o clube atual aceita ou recusa (quem é do Clube App Brasil, a equipe do App). Sem histórico:
 * só o que ainda espera resposta.
 */
export default function TransfersPage() {
  const state = useLoad(() => api.get('/club/transfers'));
  const [tab, setTab] = useState('pedir');
  const [f, setF] = useState({ code: '', club_name: '', reason: '' });
  const [busy, run] = useAsync();
  const request = async () => {
    const r = await run(() => api.post('/club/transfers', f), null);
    if (!r) return null;
    const first = r.member_name.split(' ')[0];
    notify(r.app ? `Pedido enviado para a equipe do App. Quando aprovarem, ${first} entra no seu clube.` : `Pedido enviado para o ${r.from_club_name}. Quando aceitarem, ${first} entra no seu clube.`);
    setF({ code: '', club_name: '', reason: '' });
    state.reload();
    setTab('pendentes');
    return r;
  };
  const act = (t, accept, msg) => run(() => api.post(`/club/transfers/${t.id}/origem`, { accept }), msg).then(state.reload);
  const cancel = (t) => run(() => api.post(`/club/transfers/${t.id}/cancelar`), 'Pedido cancelado').then(state.reload);
  const pedidos = (state.data?.received || []).filter((t) => t.status === 'pendente_origem');
  const pendentes = (state.data?.sent || []).filter((t) => t.status === 'pendente_origem');
  return (
    <>
      <PageHeader title="Transferências" subtitle="Cada pessoa está em um clube só. Para trazer alguém, peça a transferência." />
      <Tabs tabs={[['pedir', 'Pedir'], ['pendentes', 'Pendentes', pendentes.length], ['pedidos', 'Pedidos', pedidos.length]]} value={tab} onChange={setTab} />
      {pedidos.length > 0 && tab === 'pedir' && <Card className="small"><b>{pedidos.length}</b> pedido{pedidos.length > 1 ? 's' : ''} de outro clube esperando a sua resposta, na aba Pedidos.</Card>}

      {tab === 'pedir' && (
        <Card>
          <div className="form">
            <p className="small muted" style={{ marginTop: 0 }}>O pedido vai para o clube atual da pessoa aceitar. Quando ele aceitar, ela já entra no seu clube com tudo o que conquistou. Quem é do Clube App Brasil: quem aprova é a equipe do App.</p>
            <Field label="Código do membro (6 números)"><input inputMode="numeric" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.replace(/\D/g, '').slice(0, 6) })} placeholder="000000" /></Field>
            <Field label="Nome do clube em que ele está agora" hint="Ex.: Águias do Vale (ou Clube App Brasil)"><input value={f.club_name} onChange={(e) => setF({ ...f, club_name: e.target.value })} /></Field>
            <Field label="Motivo da transferência"><textarea rows={3} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Ex.: mudou de cidade e agora frequenta a nossa igreja" /></Field>
            <Button block busy={busy} disabled={f.code.length !== 6 || f.club_name.trim().length < 3 || f.reason.trim().length < 5} onClick={request}><Search size={16} /> Pedir transferência</Button>
          </div>
        </Card>
      )}

      {tab !== 'pedir' && (
        <Loading {...state}>
          {() => (tab === 'pendentes' ? (
            <Section title="Pedidos do seu clube esperando aprovação">
              {pendentes.length ? pendentes.map((t) => (
                <Row key={t.id} t={t}>
                  <Confirm text="Cancelar este pedido?" onYes={() => cancel(t)}>Cancelar</Confirm>
                </Row>
              )) : <Empty icon={ArrowLeftRight}>Nenhum pedido esperando.</Empty>}
            </Section>
          ) : (
            <Section title="Outros clubes pedindo membros seus">
              {pedidos.length ? pedidos.map((t) => (
                <Row key={t.id} t={t}>
                  <Button small variant="green" onClick={() => act(t, true, `Pronto! ${t.member_name.split(' ')[0]} agora é do ${t.to_club_name}.`)}><Check size={14} /> Aprovar</Button>
                  <Confirm text={`Recusar a transferência de ${t.member_name}?`} onYes={() => act(t, false, 'Pedido recusado')}><X size={14} /> Recusar</Confirm>
                </Row>
              )) : <Empty icon={ArrowLeftRight}>Nenhum pedido para responder.</Empty>}
            </Section>
          ))}
        </Loading>
      )}
    </>
  );
}

/** Equipe do App (geral ou administrador do App): pedidos para tirar alguém do Clube App Brasil. */
export function AppTransfersPage() {
  const state = useLoad(() => api.get('/admin/app-transferencias'));
  const [, run] = useAsync();
  const act = (t, accept, msg) => run(() => api.post(`/admin/app-transferencias/${t.id}`, { accept }), msg).then(state.reload);
  return (
    <>
      <PageHeader title="Transferências do App" subtitle="Clubes pedindo pessoas que estão no Clube App Brasil" />
      <Loading {...state}>
        {(list) => (list.length ? list.map((t) => (
          <Row key={t.id} t={t}>
            <Button small variant="green" onClick={() => act(t, true, `Pronto! ${t.member_name.split(' ')[0]} agora é do ${t.to_club_name}.`)}><Check size={14} /> Aprovar</Button>
            <Confirm text={`Recusar a transferência de ${t.member_name}?`} onYes={() => act(t, false, 'Pedido recusado')}><X size={14} /> Recusar</Confirm>
          </Row>
        )) : <Empty icon={ArrowLeftRight}>Nenhum pedido esperando.</Empty>)}
      </Loading>
    </>
  );
}
