// DBV+: assinatura de 30 dias que ajuda o app e libera benefícios.
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BadgeCheck, Check, Clock, Gift, Sparkles, X } from 'lucide-react';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Button, Card, Loading, Modal, PageHeader, useAsync, useLoad } from '../../ui.jsx';
import { PixCheckout, money } from '../Payment.jsx';
import CatalogPicker from '../Catalog.jsx';
import { PackReward } from '../learning/PackReward.jsx';
import './plus.css';

const br = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');

/** Selo de verificado do DBV+ (a logo dourada). */
export function Verified({ size = 20 }) {
  return <img src="/marca/logo.svg" alt="Verificado DBV+" title="Verificado DBV+" className="plus-verified" style={{ width: size, height: size }} />;
}

function Picks({ d, reload, done }) {
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
    <Card className="plus-picks-card">
      <p><b>Escolha {n} especialidades</b> que você gostaria de ganhar. A equipe compra {n === 15 ? 3 : 7} delas e entrega para você (é surpresa!).</p>
      <p className="small muted">{sel.size} de {n} escolhidas</p>
      <Loading {...cat}>{(items) => <CatalogPicker type="especialidade" items={items} selected={sel} onChange={(s) => s.size <= n && setSel(s)} />}</Loading>
      <div className="plus-picks-bar">
        <span><b>{sel.size}</b> de {n}</span>
        <Button busy={busy} disabled={sel.size !== n} onClick={() => run(() => api.put('/plus/especialidades', { ids: [...sel] }), 'Em breve alguém da equipe distrital irá entregar suas especialidades.').then(reload).then(done)}>Enviar as {n} especialidades</Button>
      </div>
    </Card>
  );
}

export default function PlusPage() {
  const { refresh } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const state = useLoad(() => api.get('/plus'));
  // Pagou: coleta os pacotinhos; se o plano tem especialidades, a escolha vem logo em seguida (obrigatória).
  const finish = async () => {
    setOrder(null); setPaid(false); state.reload();
    const a = await refresh();
    if (!a?.plus?.picks_pending) nav(`/${pathname.split('/')[1]}/albuns/biblico`);
  };
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
              <Modal title={paid ? 'Bem-vindo ao DBV+!' : 'Pague com Pix'} onClose={() => (paid ? finish() : (setOrder(null), state.reload()))}>
                {paid ? (
                  <div className="pix-box center">
                    <BadgeCheck size={44} className="plus-ok" />
                    <p><b>Assinatura ativa!</b> Colete os seus pacotinhos de presente.</p>
                    <PackReward packs={d.packs} onCollect={finish} />
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
/** Faixa discreta no topo convidando para o DBV+ (só membros sem o plano). O X esconde por 7 dias. */
export function PlusNudge({ to }) {
  const { actor } = useAuth();
  const { pathname } = useLocation();
  const key = 'dbvplus-faixa';
  const [open, setOpen] = useState(() => {
    if (actor?.type !== 'member' || actor.plus) return false;
    try { return Number(localStorage.getItem(key) || 0) < Date.now(); } catch { return true; }
  });
  // Só nas telas principais das abas (não atrapalha leitura, quiz nem jogo).
  if (!open || pathname.startsWith(to) || pathname.split('/').filter(Boolean).length > 2) return null;
  const close = () => { try { localStorage.setItem(key, String(Date.now() + 7 * 864e5)); } catch { /* sem armazenamento */ } setOpen(false); };
  return (
    <div className="plus-bar">
      <img src="/marca/logo.svg" alt="" />
      <Link to={to} className="plus-bar-text"><b>Seja DBV+</b><small>Áudio, Bom Líder e figurinhas em dobro</small></Link>
      <Link to={to} className="plus-bar-btn">Ver planos</Link>
      <button type="button" className="plus-bar-x" aria-label="Fechar" onClick={close}><X size={16} /></button>
    </div>
  );
}

/**
 * Plano com especialidades e a escolha ainda não feita: o app só continua depois de escolher
 * (mesmo fechando e abrindo de novo).
 */
export function PlusPicksGate() {
  const { refresh } = useAuth();
  const state = useLoad(() => api.get('/plus'));
  return (
    <>
      <div className="plus-hero">
        <img src="/marca/logo.svg" alt="" />
        <div>
          <b>Escolha as suas especialidades</b>
          <p>Para continuar usando o app, escolha agora as especialidades do seu plano DBV+.</p>
        </div>
      </div>
      <Loading {...state}>{(d) => (d.mine?.picks_needed ? <Picks d={d} reload={state.reload} done={refresh} /> : null)}</Loading>
    </>
  );
}
