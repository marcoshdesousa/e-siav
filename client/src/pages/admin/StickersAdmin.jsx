// Equipe: pagamentos dos pacotinhos de figurinhas (Pix), quem completou os álbuns,
// pacotinhos de presente e a chave Pix que recebe os pagamentos.
import { useState } from 'react';
import { Check, Gift, Trophy, X } from 'lucide-react';
import { api } from '../../api.js';
import { fmtDate, fmtDateTime } from '../../format.js';
import { Badge, Button, Card, Confirm, Field, Loading, PageHeader, Section, Tabs, useAsync, useLoad } from '../../ui.jsx';

const money = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const STATUS = [['aguardando', 'Avisaram que pagaram'], ['aberto', 'Esperando Pix'], ['pago', 'Pagos'], ['recusado', 'Recusados']];

function Orders() {
  const [status, setStatus] = useState('aguardando');
  const state = useLoad(() => api.get('/admin/figurinhas/pedidos?status=' + status), [status]);
  const [busy, run] = useAsync();
  const act = (o, acao) => run(() => api.post(`/admin/figurinhas/pedidos/${o.id}/${acao}`), acao === 'confirmar' ? 'Pagamento confirmado! Os pacotinhos já estão com o membro.' : 'Pedido recusado').then(state.reload);
  return (
    <Loading {...state}>
      {(d) => (
        <>
          <p className="small muted">Confira no extrato do banco o valor e o código do pedido (aparece na descrição do Pix) antes de confirmar. Total já recebido: <b>{money(d.total_paid_cents)}</b>.</p>
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
                    <div className="small">{o.packs} pacotinho{o.packs > 1 ? 's' : ''} · <b>{money(o.amount_cents)}</b> · {o.identifier ? <>SyncPay <b>{o.identifier}</b></> : <>código <b>{o.txid}</b></>}</div>
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

function Completed() {
  const state = useLoad(() => api.get('/admin/figurinhas/completos'));
  return (
    <Loading {...state}>
      {(rows) => (
        <>
          <p className="small muted">Quem completou o álbum ganha o troféu, entregue pela equipe distrital ao diretor do clube.</p>
          <div className="list">
            {rows.length === 0 && <p className="muted center">Ninguém completou ainda.</p>}
            {rows.map((x) => (
              <div key={x.album + x.member_id} className="list-item">
                <Trophy size={22} style={{ color: 'var(--yellow)' }} />
                <div className="grow">
                  <div className="title">{x.name} <span className="muted small">#{x.code}</span></div>
                  <div className="sub">{x.club_name}{x.unit_name ? ` · Unidade ${x.unit_name}` : ''}</div>
                  <div className="sub">{x.album_name} · completou em {fmtDate(x.completed_at)} · {x.packs_opened} pacotinhos abertos</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Loading>
  );
}

function Gift_() {
  const [f, setF] = useState({ code: '', packs: '5' });
  const [busy, run] = useAsync();
  return (
    <Card>
      <div className="form">
        <p className="small muted" style={{ margin: 0 }}>Dê pacotinhos de presente (promoções, prêmios ou testes) pelo código do membro.</p>
        <Field label="Código do membro (6 números)"><input inputMode="numeric" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.replace(/\D/g, '').slice(0, 6) })} /></Field>
        <Field label="Pacotinhos"><input type="number" min="1" max="100" value={f.packs} onChange={(e) => setF({ ...f, packs: e.target.value })} /></Field>
        <Button busy={busy} disabled={f.code.length !== 6} onClick={() => run(() => api.post('/admin/figurinhas/presente', { code: f.code, packs: Number(f.packs), album: 'biblico' }), null).then((r) => r && window.alert(`Pronto! ${f.packs} pacotinho(s) para ${r.name}.`))}><Gift size={16} /> Dar pacotinhos</Button>
      </div>
    </Card>
  );
}

function PixConfig() {
  const state = useLoad(() => api.get('/admin/figurinhas/pix'));
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
          <Card>
            <div className="form">
              <p className="small muted" style={{ margin: 0 }}>Pix manual (sem a SyncPay): os membros pagam para esta chave e a equipe confirma. Vazia e sem SyncPay, a compra fica desligada.</p>
              <Field label="Chave Pix" hint="CPF, CNPJ, e-mail, telefone (+55...) ou chave aleatória"><input value={v.key} onChange={(e) => setF({ ...v, key: e.target.value })} autoCapitalize="none" /></Field>
              <Field label="Nome de quem recebe" hint="Como aparece no banco (até 25 letras)"><input value={v.name} onChange={(e) => setF({ ...v, name: e.target.value })} /></Field>
              <Field label="Cidade"><input value={v.city} onChange={(e) => setF({ ...v, city: e.target.value })} placeholder="Palmares" /></Field>
              <Button busy={busy} disabled={!f} onClick={() => run(() => api.put('/admin/figurinhas/pix', v), 'Pix salvo!').then(() => { setF(null); state.reload(); })}>Salvar</Button>
            </div>
          </Card>
          </>
        );
      }}
    </Loading>
  );
}

export default function StickersAdmin() {
  const [tab, setTab] = useState('pagamentos');
  return (
    <>
      <PageHeader title="Figurinhas" subtitle="Pagamentos dos pacotinhos e álbuns completos" />
      <Tabs tabs={[['pagamentos', 'Pagamentos'], ['completos', 'Completaram'], ['presente', 'Presentear'], ['pix', 'Pix']]} value={tab} onChange={setTab} />
      <Section>
        {tab === 'pagamentos' && <Orders />}
        {tab === 'completos' && <Completed />}
        {tab === 'presente' && <Gift_ />}
        {tab === 'pix' && <PixConfig />}
      </Section>
    </>
  );
}
