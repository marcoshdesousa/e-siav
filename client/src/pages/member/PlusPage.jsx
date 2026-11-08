// DBV+: assinatura de 30 dias que ajuda o app e libera benefícios.
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BadgeCheck, Check, Clock, Gift, Sparkles, X } from 'lucide-react';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Button, Card, Loading, Modal, PageHeader, useAsync, useLoad } from '../../ui.jsx';
import { PixCheckout, money } from '../Payment.jsx';
import { PackReward } from '../learning/PackReward.jsx';
import './plus.css';

const br = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');
/** "Falta 1 dia" / "Faltam 2 dias" / "Termina hoje". */
export const daysLeft = (iso) => { const n = Math.ceil((Date.parse(iso) - Date.now()) / 864e5); return n <= 1 ? (Date.parse(iso) - Date.now() < 864e5 ? 'Termina hoje' : 'Falta 1 dia') : `Faltam ${n} dias`; };

/** Selo de verificado do DBV+ (a logo dourada). */
export function Verified({ size = 20 }) {
  return <img src="/marca/logo.svg" alt="Verificado DBV+" title="Verificado DBV+" className="plus-verified" style={{ width: size, height: size }} />;
}

export default function PlusPage() {
  const { actor, refresh } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const state = useLoad(() => api.get('/plus'));
  // Pagou: coleta os pacotinhos.
  const finish = async () => {
    setOrder(null); setPaid(false); state.reload();
    await refresh();
    if (bought === 'app') nav(`/${pathname.split('/')[1]}`);
    else nav(`/${pathname.split('/')[1]}/albuns/biblico`);
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
                  <b>{d.app.reason === 'membro_pago' ? 'Assine o App do DBV' : d.app.club ? 'O plano do seu clube venceu' : d.app.locked ? 'Sua aventura não pode parar!' : d.mine?.trial ? 'Você é DBV no teste grátis' : `Você está no ${d.mine?.plan_name || 'DBV'}`}</b>
                  <p>{d.app.reason === 'membro_pago' ? '' : d.app.club ? 'Para continuar usando o app, assine um plano (ou peça para a diretoria do clube renovar). ' : d.app.locked ? (d.mine?.trial_ended ? 'O seu teste grátis de 3 dias terminou. ' : 'O seu acesso terminou. ') : d.mine?.trial ? `O seu teste grátis vai até ${br(d.mine.until)}. ` : d.mine?.active ? `Acesso liberado até ${br(d.mine.until)}. ` : ''}Com o <b>DBV</b> você continua lendo a Bíblia todo dia, mantém as suas <b>sequências</b> e sobe no <b>ranking Brasil</b>. Com o <b>DBV+</b> você libera tudo. E cada assinatura ajuda o App do DBV a chegar a mais desbravadores!</p>
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
                  ? <div><b>Você é DBV! <span className="trial-tag">Teste grátis</span></b><small><Clock size={12} /> Você está usando o teste grátis de 3 dias · {daysLeft(d.mine.until)} · termina em {br(d.mine.until)}</small></div>
                  : d.mine.plan === 'app' && !d.app
                    // Mudou para um clube que paga pelos membros: o DBV (R$ 3,90) não é mais preciso.
                    ? <div><b>O seu clube cobre o seu acesso</b><small>Você não precisa mais pagar o DBV (R$ 3,90): no clube novo as regras são do clube. O DBV+ continua disponível, se quiser.</small></div>
                    : <div><b>Você é {d.mine.plan_name}!</b><small><Clock size={12} /> Válido até {br(d.mine.until)} · {d.mine.plan === 'app' ? 'renove ou mude para o DBV+ quando quiser' : 'um novo plano fica disponível nesse dia'}</small></div>}
              </Card>
            )}
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
                <div key={p.id} className={'plus-plan' + (p.access_only ? ' free' : '')}>
                  <b>{p.name}</b>
                  <span className="plus-price">{money(p.price_cents)}</span>
                  {p.club_price && <span className="plus-club-price">Preço especial: o seu clube paga o app</span>}
                  {p.access_only
                    ? <ul className="plus-free">{(d.free || []).map((t) => <li key={t}><Check size={14} />{t}</li>)}</ul>
                    : <small>{`Todos os benefícios do app + ${d.packs} pacotinhos de figurinhas`}</small>}
                  {d.mine?.active && d.mine.plan === p.id && <span className="plus-current">{d.mine.trial ? `Seu plano atual · teste grátis (${daysLeft(d.mine.until).toLowerCase()})` : 'Seu plano atual'}</span>}
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
  // Sem a faixa quando o clube paga pelos membros (o DBV+ continua em Mais → DBV+ para quem quiser).
  const [open, setOpen] = useState(() => !barClosed && actor?.type === 'member' && !actor.plus && !actor.app?.locked && !actor.club_plan?.locked && (!actor.club_pays || !!actor.club_plan?.grace));
  const trial = !!actor?.app?.trial;
  // Só nas telas principais das abas (não atrapalha leitura, quiz nem jogo).
  if (!open || pathname.startsWith(to) || pathname.split('/').filter(Boolean).length > 2) return null;
  const close = () => { barClosed = true; setOpen(false); };
  // Plano do clube venceu (carência de 3 dias): avisa antes de precisar assinar.
  if (actor.club_plan?.grace) {
    return (
      <div className="plus-bar trial" key="grace">
        <Gift size={26} className="plus-bar-gift" />
        <Link to={to} className="plus-bar-text"><b>O plano do seu clube venceu</b><small>{daysLeft(actor.club_plan.grace_until)} para o clube renovar · depois, só assinando</small></Link>
        <Link to={to} className="plus-bar-btn">Ver planos</Link>
      </div>
    );
  }
  // Conta nova do App Brasil: no lugar do convite do DBV+, mostra o teste grátis e quantos dias faltam.
  if (trial) {
    return (
      <div className="plus-bar trial" key="trial">
        <Gift size={26} className="plus-bar-gift" />
        <Link to={to} className="plus-bar-text"><b>Você está no teste grátis</b><small>{daysLeft(actor.app.until)} de teste grátis · assine e continue</small></Link>
        <Link to={to} className="plus-bar-btn">Ver planos</Link>
        <button type="button" className="plus-bar-x" aria-label="Fechar" onClick={close}><X size={16} /></button>
      </div>
    );
  }
  return (
    <div className="plus-bar" key="plus">
      <img src="/marca/logo.svg" alt="" />
      <Link to={to} className="plus-bar-text"><b>Seja DBV+</b><small>Bom Líder, jogos sem internet e figurinhas em triplo</small></Link>
      <Link to={to} className="plus-bar-btn">Ver planos</Link>
      <button type="button" className="plus-bar-x" aria-label="Fechar" onClick={close}><X size={16} /></button>
    </div>
  );
}
