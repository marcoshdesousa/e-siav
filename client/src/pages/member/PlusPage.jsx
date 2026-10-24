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
/** "Falta 1 dia" / "Faltam 2 dias" / "Termina hoje". */
export const daysLeft = (iso) => { const n = Math.ceil((Date.parse(iso) - Date.now()) / 864e5); return n <= 1 ? (Date.parse(iso) - Date.now() < 864e5 ? 'Termina hoje' : 'Falta 1 dia') : `Faltam ${n} dias`; };

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
  const { actor, refresh } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const state = useLoad(() => api.get('/plus'));
  // Pagou: coleta os pacotinhos; se o plano tem especialidades, a escolha vem logo em seguida (obrigatória).
  const finish = async () => {
    setOrder(null); setPaid(false); state.reload();
    const a = await refresh();
    if (bought === 'app') nav(`/${pathname.split('/')[1]}`);
    else if (!a?.plus?.picks_pending) nav(`/${pathname.split('/')[1]}/albuns/biblico`);
  };
  const [order, setOrder] = useState(null);
  const [bought, setBought] = useState(null);
  const [paid, setPaid] = useState(false);
  const [busy, run] = useAsync();
  const buy = async (plan) => { const o = await run(() => api.post('/plus/assinar', { plan }), null); if (o) { setBought(plan); setOrder(o); } };
  // Um plano por vez; quem está no DBV pode renovar ou subir para o DBV+ a qualquer hora.
  const canBuy = (d) => !d.mine?.active || d.mine.plan === 'app';
  return (
    <>
      <PageHeader title={actor.app ? 'Planos' : 'DBV+'} subtitle={actor.app ? 'Escolha um plano para usar o App do DBV' : 'Ajude o App do DBV a crescer e ganhe benefícios'} />
      <Loading {...state}>
        {(d) => (
          <>
            {d.app ? (
              <div className="plus-hero plus-hero-app">
                <img src="/marca/logo.svg" alt="" />
                <div>
                  <b>{d.app.locked ? 'Continue usando o App do DBV' : d.mine?.trial ? 'Você está no teste grátis' : `Você está no ${d.mine?.plan_name || 'DBV'}`}</b>
                  <p>{d.app.locked ? (d.mine?.trial_ended ? 'O seu teste grátis de 3 dias terminou. ' : 'O seu acesso terminou. ') : d.mine?.trial ? `O seu teste grátis de 3 dias vai até ${br(d.mine.until)}. Para continuar usando depois disso, assine um plano. ` : d.mine?.active ? `Acesso liberado até ${br(d.mine.until)}. ` : ''}Assinando você <b>ajuda a manter o app no ar</b> e evita contas falsas. O <b>DBV</b> tem tudo do plano grátis dos clubes; o <b>DBV+</b> libera todos os benefícios.</p>
                </div>
              </div>
            ) : (
            <div className="plus-hero">
              <img src="/marca/logo.svg" alt="" />
              <div>
                <b>Seja DBV+</b>
                <p>Você ajuda o nosso app a ficar cada vez melhor e ainda ganha vários privilégios. O app continua funcionando normalmente para todos.</p>
              </div>
            </div>
            )}
            {d.mine?.active && (
              <Card className="plus-status">
                <BadgeCheck size={26} />
                {d.mine.trial
                  ? <div><b>Teste grátis de 3 dias</b><small><Clock size={12} /> {daysLeft(d.mine.until)} · termina em {br(d.mine.until)} · assine para não perder o acesso</small></div>
                  : <div><b>Você é {d.mine.plan_name}!</b><small><Clock size={12} /> Válido até {br(d.mine.until)} · {d.mine.plan === 'app' ? 'renove ou mude para o DBV+ quando quiser' : 'um novo plano fica disponível nesse dia'}</small></div>}
              </Card>
            )}
            {d.mine?.active && d.mine.picks_needed > 0 && <Picks d={d} reload={state.reload} />}
            <h3 className="plus-h">{d.app ? 'Benefícios do DBV+' : 'Benefícios'}</h3>
            <ul className="plus-benefits">
              {d.benefits.map((b) => <li key={b.text} className={b.soon ? 'soon' : ''}>{b.soon ? <Sparkles size={16} /> : <Check size={16} />}<span>{b.text}{b.soon && <em>em breve</em>}</span></li>)}
            </ul>
            <h3 className="plus-h">Planos ({d.days} dias)</h3>
            <div className="plus-plans">
              {!d.app && (
              <div className="plus-plan free">
                <b>Grátis</b>
                <span className="plus-price">R$ 0</span>
                <ul className="plus-free">{(d.free || []).map((t) => <li key={t}><Check size={14} />{t}</li>)}</ul>
                <span className="plus-current">{d.mine?.active ? 'Sempre disponível' : 'Seu plano atual'}</span>
              </div>
              )}
              {d.plans.map((p) => (
                <div key={p.id} className={'plus-plan' + (p.specialties ? ' gold' : '') + (p.access_only ? ' free' : '')}>
                  <b>{p.name}</b>
                  <span className="plus-price">{money(p.price_cents)}</span>
                  {p.access_only
                    ? <ul className="plus-free">{(d.free || []).map((t) => <li key={t}><Check size={14} />{t}</li>)}</ul>
                    : <small>{p.specialties ? `Todos os benefícios + ${d.packs} pacotinhos + ${p.specialties} especialidades físicas (você escolhe ${p.pick})` : `Todos os benefícios do app + ${d.packs} pacotinhos de figurinhas`}</small>}
                  {d.mine?.active && !d.mine.trial && d.mine.plan === p.id && <span className="plus-current">Seu plano atual</span>}
                  {canBuy(d)
                    ? <Button block busy={busy} onClick={() => buy(p.id)}>{d.mine?.active && !d.mine.trial && d.mine.plan !== p.id ? 'Mudar para este' : 'Assinar'}</Button>
                    : d.mine.plan !== p.id && <span className="plus-soon-date"><Clock size={15} /> Disponível em {br(d.mine.until)}</span>}
                </div>
              ))}
            </div>
            {order && (
              <Modal title={paid ? (bought === 'app' ? 'Acesso liberado!' : 'Bem-vindo ao DBV+!') : 'Pague com Pix'} onClose={() => (paid ? finish() : (setOrder(null), state.reload()))}>
                {paid && bought === 'app' ? (
                  <div className="pix-box center">
                    <BadgeCheck size={44} className="plus-ok" />
                    <p><b>Plano ativo!</b> Agora você já pode usar o App do DBV.</p>
                    <Button block onClick={finish}>Começar</Button>
                  </div>
                ) : paid ? (
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
// Fechou a faixa: some até a pessoa abrir o app de novo.
let barClosed = false;

/** Faixa discreta no topo convidando para o DBV+ (só membros sem o plano). O X esconde até abrir o app de novo. */
export function PlusNudge({ to }) {
  const { actor } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(() => !barClosed && actor?.type === 'member' && !actor.plus && !actor.app?.locked);
  // Só nas telas principais das abas (não atrapalha leitura, quiz nem jogo).
  if (!open || pathname.startsWith(to) || pathname.split('/').filter(Boolean).length > 2) return null;
  const close = () => { barClosed = true; setOpen(false); };
  // Conta nova do App Brasil: mostra que está no teste grátis e quanto falta.
  if (actor.app?.trial) {
    return (
      <div className="plus-bar">
        <img src="/marca/logo.svg" alt="" />
        <Link to={to} className="plus-bar-text"><b>Teste grátis</b><small>{daysLeft(actor.app.until)} · assine para continuar usando</small></Link>
        <Link to={to} className="plus-bar-btn">Assinar</Link>
        <button type="button" className="plus-bar-x" aria-label="Fechar" onClick={close}><X size={16} /></button>
      </div>
    );
  }
  return (
    <div className="plus-bar">
      <img src="/marca/logo.svg" alt="" />
      <Link to={to} className="plus-bar-text"><b>Seja DBV+</b><small>Bom Líder, jogos sem internet e figurinhas em triplo</small></Link>
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
