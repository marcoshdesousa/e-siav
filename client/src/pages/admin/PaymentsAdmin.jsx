// Equipe: pagamentos do site todo (Pix pela SyncPay ou manual) e a configuração do Pix.
import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { api } from '../../api.js';
import { fmtDateTime } from '../../format.js';
import { Badge, Button, Card, Confirm, Field, Loading, PageHeader, Section, Tabs, useAsync, useLoad } from '../../ui.jsx';
import { money } from '../Payment.jsx';

const STATUS = [['aguardando', 'Avisaram que pagaram'], ['aberto', 'Esperando Pix'], ['pago', 'Pagos'], ['recusado', 'Recusados']];

function Orders() {
  const [status, setStatus] = useState('aguardando');
  const state = useLoad(() => api.get('/admin/pagamentos?status=' + status), [status]);
  const [busy, run] = useAsync();
  const act = (o, acao) => run(() => api.post(`/admin/pagamentos/${o.id}/${acao}`), acao === 'confirmar' ? 'Pagamento confirmado! Já foi liberado para o membro.' : 'Pedido recusado').then(state.reload);
  return (
    <Loading {...state}>
      {(d) => (
        <>
          <p className="small muted">Pagamentos do site todo (figurinhas e, depois, cursos). Com a SyncPay ligada, eles se confirmam sozinhos. No Pix manual, confira no extrato o valor e o código antes de confirmar. Total já recebido: <b>{money(d.total_paid_cents)}</b>.</p>
          <div className="seg" role="tablist" style={{ marginBottom: '.7rem', flexWrap: 'wrap' }}>
            {STATUS.map(([k, label]) => (
              <button key={k} type="button" className={status === k ? 'active' : ''} onClick={() => setStatus(k)}>{label}{d.counts[k] ? ` (${d.counts[k]})` : ''}</button>
            ))}
          </div>
          <div className="list">
            {d.rows.length === 0 && <p className="muted center">Nenhum pedido aqui.</p>}
            {d.rows.map((o) => (
              <Card key={o.id}>
                <div className="row between" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <b>{o.member_name}</b> <span className="muted small">#{o.member_code}</span>
                    <div className="small muted">{o.club_name}{o.unit_name ? ` · ${o.unit_name}` : ''}</div>
                    <div className="small"><b>{o.title}</b> · <b>{money(o.amount_cents)}</b> · {o.identifier ? <>SyncPay <b>{o.identifier}</b></> : <>código <b>{o.txid}</b></>}</div>
                    <div className="small muted">Pedido em {fmtDateTime(o.created_at)}{o.notified_at ? ` · avisou em ${fmtDateTime(o.notified_at)}` : ''}{o.paid_at ? ` · confirmado em ${fmtDateTime(o.paid_at)}` : ''}</div>
                  </div>
                  {o.status === 'pago' && <Badge kind="green">Pago</Badge>}
                </div>
                {['aberto', 'aguardando'].includes(o.status) && (
                  <div className="row wrap mt" style={{ gap: '.4rem' }}>
                    <Button small variant="green" busy={busy} onClick={() => act(o, 'confirmar')}><Check size={14} /> Confirmar pagamento</Button>
                    <Confirm text="Recusar este pedido (o Pix não caiu)?" onYes={() => act(o, 'recusar')}><X size={14} /> Recusar</Confirm>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </Loading>
  );
}

const fmtCpf = (v) => String(v || '').replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');

/** Dados padrão que vão na cobrança da SyncPay: o membro não precisa informar nada. */
function DefaultPayer({ payer, onSaved }) {
  const [f, setF] = useState(null);
  const [busy, run] = useAsync();
  const v = f || { ...payer, cpf: fmtCpf(payer.cpf) };
  return (
    <Card>
      <div className="form">
        <b>Dados padrão do Pix (SyncPay)</b>
        <p className="small muted" style={{ margin: 0 }}>A SyncPay pede um "cliente" em cada cobrança. Para não pedir CPF nem outros dados aos membros (muitos são menores), o app usa estes dados em todas as cobranças. Use os dados da organização ou de um responsável. Quem paga de verdade é quem lê o QR Code no banco.</p>
        <Field label="Nome completo"><input value={v.name} onChange={(e) => setF({ ...v, name: e.target.value })} /></Field>
        <Field label="CPF"><input inputMode="numeric" value={v.cpf} onChange={(e) => setF({ ...v, cpf: fmtCpf(e.target.value) })} placeholder="000.000.000-00" /></Field>
        <Field label="E-mail"><input type="email" value={v.email} onChange={(e) => setF({ ...v, email: e.target.value })} autoCapitalize="none" /></Field>
        <Field label="Celular (com DDD)"><input inputMode="tel" value={v.phone} onChange={(e) => setF({ ...v, phone: e.target.value })} /></Field>
        <Button busy={busy} disabled={!f} onClick={() => run(() => api.put('/admin/pagamentos-config/pagador', v), 'Dados salvos!').then(() => { setF(null); onSaved(); })}>Salvar</Button>
      </div>
    </Card>
  );
}

function PixConfig() {
  const state = useLoad(() => api.get('/admin/pagamentos-config'));
  const [f, setF] = useState(null);
  const [busy, run] = useAsync();
  return (
    <Loading {...state}>
      {(cfg) => {
        const v = f || cfg;
        return (
          <>
          <Card className="small" style={{ background: cfg.syncpay ? 'var(--green-soft)' : 'var(--yellow-soft)' }}>
            {cfg.syncpay
              ? <><b>SyncPay conectada:</b> o Pix é gerado pela SyncPay e os pacotinhos são liberados sozinhos quando o pagamento cai. A chave abaixo não é usada.</>
              : <><b>SyncPay não conectada.</b> Para o pagamento automático, coloque SYNCPAY_CLIENT_ID e SYNCPAY_CLIENT_SECRET no Render. Enquanto isso, vale a chave Pix abaixo e a equipe confirma cada pagamento.</>}
          </Card>
          <DefaultPayer payer={cfg.payer} onSaved={state.reload} />
          <Card>
            <div className="form">
              <p className="small muted" style={{ margin: 0 }}>Pix manual (sem a SyncPay): os membros pagam para esta chave e a equipe confirma. Vazia e sem SyncPay, a compra fica desligada.</p>
              <Field label="Chave Pix" hint="CPF, CNPJ, e-mail, telefone (+55...) ou chave aleatória"><input value={v.key} onChange={(e) => setF({ ...v, key: e.target.value })} autoCapitalize="none" /></Field>
              <Field label="Nome de quem recebe" hint="Como aparece no banco (até 25 letras)"><input value={v.name} onChange={(e) => setF({ ...v, name: e.target.value })} /></Field>
              <Field label="Cidade"><input value={v.city} onChange={(e) => setF({ ...v, city: e.target.value })} placeholder="Palmares" /></Field>
              <Button busy={busy} disabled={!f} onClick={() => run(() => api.put('/admin/pagamentos-config/pix', v), 'Pix salvo!').then(() => { setF(null); state.reload(); })}>Salvar</Button>
            </div>
          </Card>
          </>
        );
      }}
    </Loading>
  );
}

export default function PaymentsAdmin() {
  const [tab, setTab] = useState('pagamentos');
  return (
    <>
      <PageHeader title="Pagamentos" subtitle="Tudo o que é pago no app pelo Pix" />
      <Tabs tabs={[['pagamentos', 'Pagamentos'], ['pix', 'Configurar Pix']]} value={tab} onChange={setTab} />
      <Section>{tab === 'pagamentos' ? <Orders /> : <PixConfig />}</Section>
    </>
  );
}
