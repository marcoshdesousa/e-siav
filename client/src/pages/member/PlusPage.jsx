// DBV+: assinatura de 30 dias que ajuda o app e libera benefícios.
import { useState } from 'react';
import { BadgeCheck, Check, Clock, Gift, Sparkles } from 'lucide-react';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Button, Card, Loading, Modal, PageHeader, useAsync, useLoad } from '../../ui.jsx';
import { PixCheckout, money } from '../Payment.jsx';
import CatalogPicker from '../Catalog.jsx';
import './plus.css';

const br = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');

/** Selo de verificado do DBV+ (a logo dourada). */
export function Verified({ size = 20 }) {
  return <img src="/marca/logo.svg" alt="Verificado DBV+" title="Verificado DBV+" className="plus-verified" style={{ width: size, height: size }} />;
}

function Picks({ d, reload }) {
  const cat = useLoad(() => api.get('/catalog?type=especialidade'));
  const [sel, setSel] = useState(new Set());
  const [busy, run] = useAsync();
  const n = d.mine.picks_needed;
  if (d.mine.picks) {
    return (
      <Card className="plus-picks-done">
        <Gift size={28} />
        <p><b>Em breve alguém da equipe distrital irá entregar suas especialidades.</b></p>
        <p className="small muted">Você escolheu: {d.picks_names.map((x) => x.name).join(', ')}.</p>
      </Card>
    );
  }
  return (
    <Card>
      <p><b>Escolha {n} especialidades</b> que você gostaria de ganhar. A equipe compra {n === 15 ? 3 : 7} delas e entrega para você (é surpresa!).</p>
      <p className="small muted">{sel.size} de {n} escolhidas</p>
      <Loading {...cat}>{(items) => <CatalogPicker type="especialidade" items={items} selected={sel} onChange={(s) => s.size <= n && setSel(s)} />}</Loading>
      <Button block busy={busy} disabled={sel.size !== n} onClick={() => run(() => api.put('/plus/especialidades', { ids: [...sel] }), 'Especialidades escolhidas!').then(reload)}>Enviar as {n} especialidades</Button>
    </Card>
  );
}

export default function PlusPage() {
  const { refresh } = useAuth();
  const state = useLoad(() => api.get('/plus'));
  const [order, setOrder] = useState(null);
  const [paid, setPaid] = useState(false);
  const [busy, run] = useAsync();
  const buy = async (plan) => { const o = await run(() => api.post('/plus/assinar', { plan }), null); if (o) setOrder(o); };
  return (
    <>
      <PageHeader title="DBV+" subtitle="Ajude o App do DBV a crescer e ganhe benefícios" />
      <Loading {...state}>
        {(d) => (
          <>
            <div className="plus-hero">
              <img src="/marca/logo.svg" alt="" />
              <div>
                <b>Seja DBV+</b>
                <p>Você ajuda o nosso app a ficar cada vez melhor e ainda ganha vários privilégios. O app continua funcionando normalmente para todos.</p>
              </div>
            </div>
            {d.mine?.active && (
              <Card className="plus-status">
                <BadgeCheck size={26} />
                <div><b>Você é {d.mine.plan_name}!</b><small><Clock size={12} /> Válido até {br(d.mine.until)} · renove quando quiser (soma mais {d.days} dias)</small></div>
              </Card>
            )}
            {d.mine?.active && d.mine.picks_needed > 0 && <Picks d={d} reload={state.reload} />}
            <h3 className="plus-h">Benefícios</h3>
            <ul className="plus-benefits">
              {d.benefits.map((b) => <li key={b.text} className={b.soon ? 'soon' : ''}>{b.soon ? <Sparkles size={16} /> : <Check size={16} />}<span>{b.text}{b.soon && <em>em breve</em>}</span></li>)}
            </ul>
            <h3 className="plus-h">Planos ({d.days} dias)</h3>
            <div className="plus-plans">
              <div className="plus-plan free">
                <b>Grátis</b>
                <span className="plus-price">R$ 0</span>
                <ul className="plus-free">{(d.free || []).map((t) => <li key={t}><Check size={14} />{t}</li>)}</ul>
                <span className="plus-current">{d.mine?.active ? 'Sempre disponível' : 'Seu plano atual'}</span>
              </div>
              {d.plans.map((p) => (
                <div key={p.id} className={'plus-plan' + (p.specialties ? ' gold' : '')}>
                  <b>{p.name}</b>
                  <span className="plus-price">{money(p.price_cents)}</span>
                  <small>{p.specialties ? `Todos os benefícios + ${p.specialties} especialidades físicas (você escolhe ${p.pick})` : 'Todos os benefícios do app'}</small>
                  <Button block busy={busy} onClick={() => buy(p.id)}>{d.mine?.active ? 'Renovar' : 'Assinar'}</Button>
                </div>
              ))}
            </div>
            {order && (
              <Modal title={paid ? 'Bem-vindo ao DBV+!' : 'Pague com Pix'} onClose={() => { setOrder(null); setPaid(false); state.reload(); refresh(); }}>
                {paid ? (
                  <div className="pix-box center">
                    <BadgeCheck size={44} className="plus-ok" />
                    <p><b>Assinatura ativa!</b> Os seus {d.packs} pacotinhos já estão no Álbum Bíblico.</p>
                    <Button block onClick={() => { setOrder(null); setPaid(false); state.reload(); refresh(); }}>Continuar</Button>
                  </div>
                ) : <PixCheckout payment={order} onPaid={() => setPaid(true)} onNotified={() => { setOrder(null); state.reload(); }} />}
              </Modal>
            )}
          </>
        )}
      </Loading>
    </>
  );
}

/** Aviso para assinar/renovar (uma vez por dia, com X para fechar). O app funciona igual sem assinar. */
export function PlusNudge({ to }) {
  const { actor } = useAuth();
  const key = 'dbvplus-nudge';
  const today = new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState(() => {
    if (actor?.type !== 'member' || actor.plus) return false;
    try { return localStorage.getItem(key) !== today; } catch { return false; }
  });
  if (!open) return null;
  const close = () => { try { localStorage.setItem(key, today); } catch { /* sem armazenamento */ } setOpen(false); };
  return (
    <Modal title="Seja DBV+" onClose={close}>
      <div className="plus-nudge">
        <img src="/marca/logo.svg" alt="" />
        <p>Ajude o App do DBV a crescer! Com o <b>DBV+</b> você ganha áudio nas leituras, Bom Líder, 30 pacotinhos de figurinhas por mês, figurinhas em dobro e o selo de verificado.</p>
        <a className="btn btn-primary btn-block" href={to} onClick={close}>Ver os planos</a>
        <Button block variant="secondary" onClick={close}>Agora não</Button>
      </div>
    </Modal>
  );
}
