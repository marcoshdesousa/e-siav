import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import {
  Award, KeyRound, UserPlus, Megaphone, ChevronRight, Compass, Flag, Inbox, Map, MapPin, Menu, Tent, Trophy, Users, Wallet, ClipboardCheck, Globe, FolderOpen, Wrench, LifeBuoy, Share2, Flame, ArrowLeftRight,
} from 'lucide-react';
import { GroupCertificatesPage } from '../Certificates.jsx';
import { api, toForm } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { KIND_LABEL, plural } from '../../format.js';
import { MembersBrowser, memberActions } from './Members.jsx';
import { AccessInfo } from '../Signup.jsx';
import TransfersPage from './Transfers.jsx';
import { PixCheckout, money } from '../Payment.jsx';
import {
  FerramentasPage, FinancasPage, MembrosPorGrupo,
} from './Folders.jsx';
import { EmbeddedSite, SupportChat } from '../Shared.jsx';
import {
  Avatar, Badge, Button, Card, Confirm, Field, ImagePicker, Loading, MedalList, Modal, PageHeader, PositionBadge, Section, ShareButton, Stat, Tabs, notify, useAsync, useLoad,
} from '../../ui.jsx';
import Shell, { MoreMenu } from '../Shell.jsx';
import { EventsList, InAppProfile } from '../Profiles.jsx';
import { CreatedRequirements, RequirementsTodo, ReviewsPanel } from '../Requirements.jsx';
import RankingHub, { ClubUnitsRanking, RankingTable } from '../Ranking.jsx';
import ClubsBrowser from '../Clubs.jsx';
import EventsAdmin from '../admin/Events.jsx';
import AnnouncementsAdmin from '../admin/Announcements.jsx';

const base = '/clube';

const STATE_TEXT = {
  membros_pagam: ['yellow', 'Os membros pagam'], ok: ['green', 'Em dia'], gratis: ['green', 'Grátis (janeiro e dezembro)'], carencia: ['yellow', 'Venceu: pague em até 3 dias'], vencido: ['red', 'Vencido'],
};
const brDate = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

/**
 * Plano do clube: R$ 15 a cada 30 dias (ou o ano todo) para os membros usarem o app de graça.
 * Janeiro e dezembro são grátis. Vencido, o portal continua funcionando, mas os membros precisam assinar.
 */
export function ClubPlanCard() {
  const { actor } = useAuth();
  // Clube grátis com membros grátis: nada de cobrança. Clube grátis com membros que pagam: pode assumir.
  const hidden = actor.club_billing === 'gratis' && actor.member_billing !== 'pago';
  const state = useLoad(() => (hidden ? Promise.resolve(null) : api.get('/club/plano')));
  const [order, setOrder] = useState(null);
  const [paid, setPaid] = useState(false);
  const [busy, run] = useAsync();
  const buy = async (plan) => { const o = await run(() => api.post('/club/plano/assinar', { plan }), null); if (o) setOrder(o); };
  const close = () => { setOrder(null); setPaid(false); state.reload(); };
  if (hidden) return null;
  return (
    <Section title="Plano do clube">
      <Card>
        <Loading {...state}>
          {(d) => {
            const [kind, label] = STATE_TEXT[d.status.state] || ['', d.status.state];
            return (
              <div className="stack">
                <div className="row between"><b>Situação</b><Badge kind={kind}>{label}</Badge></div>
                <p className="small" style={{ margin: 0 }}>
                  {d.status.paid_until ? <>Pago até <b>{brDate(d.status.paid_until)}</b>. </> : null}
                  O plano é do portal do clube. Para os membros vale a regra do app: os <b>desbravadores</b> usam de graça e a <b>liderança</b> (16 anos ou mais) assina o DBV (R$ 1,90) ou o DBV+ (R$ 3,90), com 7 dias grátis. Janeiro e dezembro são grátis para todos os clubes.
                </p>
                {!d.status.optional && ['carencia', 'vencido'].includes(d.status.state) && (
                  <p className="small" style={{ margin: 0, color: 'var(--red-ink)' }}>
                    {d.status.state === 'carencia' ? `O plano venceu. Renove até ${brDate(d.status.grace_until)}.` : 'O plano venceu. Renove para continuar com o plano do clube em dia.'}
                  </p>
                )}
                <div className="club-plans">
                  {d.plans.map((p) => (
                    <div key={p.id} className="club-plan">
                      <b>30 dias</b>
                      <span className="club-plan-price">{money(p.price_cents)}</span>
                      <small>Pago por mês, a cada 30 dias</small>
                      <Button small block busy={busy} onClick={() => buy(p.id)}>Pagar no Pix</Button>
                    </div>
                  ))}
                </div>
              </div>
            );
          }}
        </Loading>
      </Card>
      {order && (
        <Modal title={paid ? 'Plano renovado!' : 'Pague com Pix'} onClose={close}>
          {paid ? <div className="pix-box center"><p><b>Pagamento confirmado!</b> O plano do clube está em dia.</p><Button block onClick={close}>Fechar</Button></div>
            : <PixCheckout payment={order} onPaid={() => setPaid(true)} onNotified={close} />}
        </Modal>
      )}
    </Section>
  );
}

/** O clube entrou hoje (uma vez por dia): sequência, 100 pontos e 1 pacotinho para cada membro. */
function useClubPresence() {
  useEffect(() => {
    api.post('/club/presenca').then((r) => {
      if (r?.first) notify(`Bom dia de clube! +100 pontos para o clube e ${r.packs} ${r.packs === 1 ? 'membro ganhou' : 'membros ganharam'} 1 pacotinho de figurinhas.`);
    }).catch(() => {});
  }, []);
}

function ClubStreak() {
  const s = useLoad(() => api.get('/club/presenca'));
  if (!s.data) return null;
  return (
    <div className="streak-box" style={{ marginTop: '.8rem' }}>
      <div className={'app-streak' + (s.data.streak ? ' lit' : '') + (s.data.today_done ? ' on' : '')} style={{ marginTop: 0 }}>
        <span className="st-flame"><Flame size={22} strokeWidth={2.2} /></span>
        <div className="grow"><b>{s.data.streak} {s.data.streak === 1 ? 'dia' : 'dias'} de clube no app</b>
          <small>Entrar uma vez por dia: +100 pontos para o clube e 1 pacotinho para cada membro{s.data.best_streak ? ` · recorde ${s.data.best_streak}` : ''}</small></div>
      </div>
    </div>
  );
}

/** Link de inscrição do clube: quem entra por ele já fica no clube. O clube compartilha, liga/desliga e troca. */
function SignupLinkCard() {
  const state = useLoad(() => api.get('/club/inscricao'));
  const [busy, run] = useAsync();
  const url = (t) => `${location.origin}/inscricao/${t}`;
  const share = async (t) => {
    const data = { title: 'Inscrição no clube', text: 'Faça a sua inscrição no nosso clube pelo App do DBV:', url: url(t) };
    try {
      if (navigator.share) return await navigator.share(data);
      await navigator.clipboard.writeText(url(t));
      window.alert('Link copiado!');
    } catch (e) {
      if (e?.name !== 'AbortError') prompt('Copie o link:', url(t));
    }
  };
  return (
    <Section title="Link de inscrição">
      <Card>
        <Loading {...state}>
          {(l) => (
            <div className="stack">
              <p className="small muted" style={{ margin: 0 }}>Quem se inscreve por este link entra direto no clube, escolhe a unidade e já ganha o login (código + ano de nascimento). {l.signups ? <b>{plural(l.signups, 'inscrição', 'inscrições')} pelo link.</b> : null}</p>
              {l.enabled ? <code className="signup-url">{url(l.token)}</code> : <p className="small" style={{ margin: 0 }}><b>Link desligado:</b> ninguém consegue se inscrever.</p>}
              <div className="row wrap">
                {!!l.enabled && <Button small onClick={() => share(l.token)}><Share2 size={15} /> Compartilhar link</Button>}
                <Button small variant="secondary" busy={busy} onClick={() => run(() => api.put('/club/inscricao', { enabled: !l.enabled }), l.enabled ? 'Link desligado' : 'Link ligado').then(state.reload)}>{l.enabled ? 'Desligar' : 'Ligar link'}</Button>
                <Button small variant="secondary" busy={busy} onClick={() => confirm('Gerar um link novo? O link antigo para de funcionar.') && run(() => api.post('/club/inscricao/novo-link'), 'Link novo gerado').then(state.reload)}>Trocar link</Button>
              </div>
            </div>
          )}
        </Loading>
      </Card>
    </Section>
  );
}

// ---------- Início / perfil do clube ----------
function ClubHome() {
  const { refresh } = useAuth();
  const state = useLoad(() => api.get('/club/overview'));
  const [, run] = useAsync();
  const upload = (field) => async (file) => {
    await run(() => api.put('/club/profile', toForm({ [field]: file })), field === 'logo' ? 'Logo atualizada!' : 'Foto atualizada!');
    state.reload();
    refresh();
  };
  return (
    <Loading {...state}>
      {(c) => (
        <>
          <div className="hero">
            <div className="profile-head">
              <Avatar src={c.logo} name={c.name} size={88} square />
              <h1>{c.name}</h1>
              <div className="chips"><span className="chip ico"><MapPin size={14} /> {c.district_name}</span><span className="chip ico"><KeyRound size={14} /> Código do clube: <b>{c.code}</b></span></div>
              {c.director_name && <p className="small" style={{ margin: '.2rem 0 .4rem' }}>Diretor(a): <b>{c.director_name}</b>{c.associate_directors ? <> · Associados: {c.associate_directors.split('\n').join(', ')}</> : ''}</p>}
              {c.ranking && <PositionBadge position={c.ranking.position} points={c.ranking.points} label="no ranking de clubes do distrito" />}
              <div className="row wrap" style={{ justifyContent: 'center', marginTop: '.5rem' }}>
                <ShareButton path={`/clube/${c.code}`} title={c.name} />
                <Link to={`${base}/ver/clube/${c.id}`}><Button variant="yellow" small>Ver perfil público</Button></Link>
              </div>
            </div>
          </div>

          <ClubStreak />
          <ClubPlanCard />
          <SignupLinkCard />

          <Section title="Resumo">
            <div className="stats">
              <Stat icon={Compass} value={c.desbravadores} label="Desbravadores" to={`${base}/membros`} />
              <Stat icon={Award} value={c.lideranca} label="Liderança" to={`${base}/membros`} />
              <Stat icon={Flag} value={c.unit_count} label="Unidades" to={`${base}/unidades`} />
              <Stat icon={Inbox} value={c.pending_reviews} label="Envios p/ avaliar" to={`${base}/requisitos?aba=corrigir`} accent={c.pending_reviews > 0} />
            </div>
          </Section>

          <ClubInfoForm club={c} onDone={() => { state.reload(); refresh(); }} />

          <Section title="Logo do clube">
            <Card>
              <div className="stack">
                <ImagePicker label="Logo do clube" value={c.logo} onChange={upload('logo')} round={false} name={c.name} />
              </div>
            </Card>
          </Section>

          <Section title="Ranking das unidades" action={<Link to={`${base}/ranking`} className="small ico">Ver tudo <ChevronRight size={14} /></Link>}>
            <RankingTable rows={c.units_ranking} link={(r) => `${base}/ver/unidade/${r.id}`} />
          </Section>
          <MedalList medals={c.medals} />
          <EventsList events={c.events} />
        </>
      )}
    </Loading>
  );
}

/** História do clube. O nome do diretor só o administrativo muda (todo ano). */
function ClubInfoForm({ club, onDone }) {
  const [history, setHistory] = useState(club.history || '');
  const [busy, run] = useAsync();
  const save = async () => {
    await run(() => api.put('/club/profile', toForm({ history })), 'Salvo!');
    onDone();
  };
  return (
    <Section title="História do clube">
      <Card>
        <div className="form">
          <p className="small muted" style={{ margin: 0 }}>Diretor(a): <b>{club.director_name || '—'}</b>{club.associate_directors ? <> · Associados: <b>{club.associate_directors.split('\n').join(', ')}</b></> : ''}. Quem troca a diretoria é o administrativo.</p>
          <Field label="Nossa história" hint="Aparece no perfil público do clube."><textarea value={history} onChange={(e) => setHistory(e.target.value)} placeholder="Como o clube começou, conquistas, acampamentos marcantes..." style={{ minHeight: 120 }} /></Field>
          <div className="row" style={{ justifyContent: 'flex-end' }}><Button busy={busy} disabled={history === (club.history || '')} onClick={save}>Salvar</Button></div>
        </div>
      </Card>
    </Section>
  );
}

/**
 * Cargos pela idade: 10 a 15 anos só Desbravador; 16+ Liderança;
 * diretoria (diretor e diretor associado) só a partir de 18.
 */
function CargoOptions({ kind, age }) {
  const { meta } = useAuth();
  if (kind !== 'lideranca') return (meta.cargos[kind] || []).map((c) => <option key={c}>{c}</option>);
  const lid = meta.cargos_lideranca || [];
  const min18 = meta.cargos_18 || [];
  const opt = (c) => {
    const blocked = min18.includes(c) && age != null && age < (meta.idade_min_diretor || 18);
    return <option key={c} value={c} disabled={blocked}>{c}{blocked ? ' (18+)' : ''}</option>;
  };
  return (
    <>
      <optgroup label="Diretoria">{lid.map(opt)}</optgroup>
      <optgroup label="Conselheiros e instrutores">{meta.cargos.lideranca.filter((c) => !lid.includes(c)).map(opt)}</optgroup>
    </>
  );
}

// ---------- Membros ----------
/** Editar membro: unidade e cargo. Os dados pessoais ficam na Ficha. */
function MemberForm({ member, units, onClose, onDone }) {
  const [f, setF] = useState({ cargo: member.cargo || '', unit_id: member.unit_id || '' });
  const [busy, run] = useAsync();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const kind = member.kind;
  const availableUnits = units.filter((u) => !(u.is_leadership && kind === 'desbravador'));
  const save = async () => {
    const body = { cargo: f.cargo, unit_id: f.unit_id || '' };
    await run(() => api.put('/club/members/' + member.id, toForm(body)), 'Membro atualizado!');
    onDone();
  };
  return (
    <Modal title={`Editar ${member.name}`} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button busy={busy} onClick={save}>Salvar</Button></>}>
      <div className="form">
        <p className="small muted" style={{ marginTop: 0 }}>
          {member.age} anos · {KIND_LABEL[kind]} · código <b>{member.code}</b>.{' '}
          {kind === 'desbravador' ? 'De 10 a 15 anos o cargo é Desbravador.' : member.age < 18 ? 'Cargos de diretoria só a partir de 18 anos.' : ''}
          {' '}Nome, nascimento e documentos ficam em <b>Ficha</b>.
        </p>
        <div className="grid2">
          <Field label="Unidade" hint={kind === 'lideranca' ? 'Sem escolha: entra na unidade Liderança' : 'Sem escolha: aparece como "Sem unidade"'}>
            <select value={f.unit_id} onChange={set('unit_id')}>
              <option value="">{kind === 'lideranca' ? 'Liderança (automático)' : 'Sem unidade'}</option>
              {availableUnits.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Cargo">
            <select value={f.cargo} onChange={set('cargo')}>
              <CargoOptions kind={kind} age={member.age} />
            </select>
          </Field>
        </div>
        <p className="small muted">Acesso: código <b>{member.code}</b> + senha <b>{String(member.birth_date || '').slice(0, 4)}</b> (ano de nascimento). Não dá para mudar.</p>
      </div>
    </Modal>
  );
}

function MembersPage() {
  const members = useLoad(() => api.get('/club/members'));
  const units = useLoad(() => api.get('/club/units'));
  const [editing, setEditing] = useState(null);
  const [, run] = useAsync();
  const done = () => { setEditing(null); members.reload(); units.reload(); };
  return (
    <>
      <PageHeader title="Membros" subtitle="Ninguém é apagado: quem sai do clube fica inativo" action={<Link to={`${base}/membros/novo`}><Button small>+ Novo</Button></Link>} />
      <Loading {...members}>
        {(list) => <MembersBrowser list={list} units={units.data || []} actions={memberActions({ base, run, done, setEditing })} />}
      </Loading>
      {editing && <MemberForm member={editing} units={units.data || []} onClose={() => setEditing(null)} onDone={done} />}
    </>
  );
}

const ageOf = (birth) => (birth ? Math.floor((Date.now() - Date.parse(birth + 'T12:00:00')) / 31557600000) : null);

/**
 * Cadastro do membro pelo clube: nome completo, data de nascimento, unidade e cargo.
 * O cargo só libera depois da data de nascimento (10 a 15 anos: cargos de desbravador; 16+: liderança).
 * O cadastro completo (ficha, termos) fica no SGC.
 */
function NewMemberPage() {
  const nav = useNavigate();
  const units = useLoad(() => api.get('/club/units'));
  const [f, setF] = useState({ name: '', birth_date: '', unit_id: '', cargo: '' });
  const [created, setCreated] = useState(null);
  const [busy, run] = useAsync();
  const age = ageOf(f.birth_date);
  const kind = age == null ? null : age < 10 ? 'invalido' : age <= 15 ? 'desbravador' : 'lideranca';
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setBirth = (e) => setF({ ...f, birth_date: e.target.value, cargo: '' });
  const ok = f.name.trim().split(/\s+/).length >= 2 && kind && kind !== 'invalido' && f.cargo;
  const send = async () => {
    const r = await run(() => api.post('/club/members', { ...f, unit_id: f.unit_id || '' }), null);
    setCreated({ ...r, name: f.name });
  };
  const available = (units.data || []).filter((u) => !(u.is_leadership && kind === 'desbravador'));
  return (
    <>
      <PageHeader title="Novo membro" subtitle="O cadastro completo (ficha, documentos) fica no SGC. Aqui é só o básico." />
      <Card>
        <div className="form">
          <Field label="Nome completo"><input value={f.name} onChange={set('name')} autoComplete="off" /></Field>
          <Field label="Data de nascimento" hint={kind === 'invalido' ? 'É preciso ter pelo menos 10 anos.' : age != null ? `${age} anos · ${kind === 'desbravador' ? 'Desbravador (10 a 15 anos)' : 'Liderança (16 anos ou mais)'}` : 'A idade define os cargos que aparecem.'}>
            <input type="date" value={f.birth_date} onChange={setBirth} />
          </Field>
          <Field label="Unidade" hint={kind === 'lideranca' ? 'Sem escolha: entra na unidade Liderança' : 'Sem escolha: aparece como "Sem unidade"'}>
            <select value={f.unit_id} onChange={set('unit_id')}>
              <option value="">{kind === 'lideranca' ? 'Liderança (automático)' : 'Sem unidade'}</option>
              {available.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Cargo (função)" hint={!kind || kind === 'invalido' ? 'Coloque a data de nascimento para escolher o cargo.' : ''}>
            <select value={f.cargo} onChange={set('cargo')} disabled={!kind || kind === 'invalido'}>
              <option value="">{!kind || kind === 'invalido' ? 'Primeiro a data de nascimento' : 'Escolha o cargo'}</option>
              {kind && kind !== 'invalido' && <CargoOptions kind={kind} age={age} />}
            </select>
          </Field>
          <Button block busy={busy} disabled={!ok} onClick={send}><UserPlus size={18} /> Cadastrar membro</Button>
        </div>
      </Card>
      {created && (
        <Modal title="Membro cadastrado!" onClose={() => nav(`${base}/membros`)} footer={<Button onClick={() => nav(`${base}/membros`)}>Entendi</Button>}>
          <p className="center">Acesso de <b>{created.name}</b> na tela Membros:</p>
          <AccessInfo code={created.code} password={created.password} />
        </Modal>
      )}
    </>
  );
}

// ---------- Unidades ----------
function UnitForm({ unit, onClose, onDone }) {
  const [f, setF] = useState({ name: unit?.name || '', logo: unit?.logo || null });
  const [busy, run] = useAsync();
  const save = async () => {
    const body = { ...f, logo: f.logo instanceof File ? f.logo : undefined };
    await run(() => (unit ? api.put('/club/units/' + unit.id, toForm(body)) : api.post('/club/units', toForm(body))), 'Unidade salvo!');
    onDone();
  };
  return (
    <Modal title={unit ? 'Editar unidade' : 'Nova unidade'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button busy={busy} onClick={save}>Salvar</Button></>}>
      <div className="form">
        <ImagePicker label="Logo da unidade" value={f.logo} onChange={(logo) => setF({ ...f, logo })} round={false} name={f.name} />
        <Field label="Nome"><input value={f.name} disabled={unit?.is_leadership} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        {!unit && <p className="muted small">O app cria a senha da unidade (2 letras + 4 números), que não pode ser trocada. O conselheiro entra pela tela Clube com o código do clube e essa senha.</p>}
      </div>
    </Modal>
  );
}

function UnitsPage({ embedded = false }) {
  const { actor } = useAuth();
  const state = useLoad(() => api.get('/club/units'));
  const [editing, setEditing] = useState(null);
  const [, run] = useAsync();
  const done = () => { setEditing(null); state.reload(); };
  return (
    <>
      {embedded
        ? <Button block onClick={() => setEditing('new')}>+ Nova unidade</Button>
        : <PageHeader title="Unidades" subtitle="Cada membro pertence a uma única unidade · até 10 unidades, numeradas de 1 a 10" action={<Button small onClick={() => setEditing('new')}>+ Novo</Button>} />}
      <Card className="small mt">Até 10 unidades, numeradas de 1 a 10. Para entrar no Portal da Unidade: tela <b>Clube</b>, código do clube <b>{actor.code}</b> e a senha da unidade abaixo. As senhas são criadas pelo app e <b>não podem ser trocadas</b>: guarde bem.</Card>
      <Loading {...state}>
        {(list) => (
          <div className="list mt">
            {list.map((u) => (
              <div key={u.id} className="list-item">
                <Avatar src={u.logo} name={u.name} size={52} square />
                <div className="grow">
                  <div className="title">{u.is_leadership ? '' : `Unidade ${u.number} · `}{u.name} {u.is_leadership ? <Badge kind="yellow">automático</Badge> : null}</div>
                  <div className="sub">{plural(u.member_count, 'membro', 'membros')} · senha <span className="pin-box"><KeyRound size={13} />{u.pin}</span></div>
                  <div className="sub ellipsis">Link: {location.host}/clube/{actor.code}/{u.is_leadership ? 'lideranca' : u.number}</div>
                  <div className="row wrap" style={{ marginTop: '.4rem', gap: '.35rem' }}>
                    <Button small variant="secondary" onClick={() => setEditing(u)}>Editar</Button>
                    <Link to={`${base}/ver/unidade/${u.id}`}><Button small variant="ghost">Perfil</Button></Link>
                    {!u.is_leadership && <Confirm text={`Excluir a unidade ${u.name}? Os membros ficarão sem unidade.`} onYes={() => run(() => api.del('/club/units/' + u.id), 'Unidade excluída').then(done)}>Excluir</Confirm>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Loading>
      {editing && <UnitForm unit={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onDone={done} />}
    </>
  );
}

/** Pasta Ranking: cumprir (requisitos do App), criar (para os membros) e corrigir os envios. */
function RankingFolder() {
  const initial = new URLSearchParams(location.search).get('aba') || 'cumprir';
  const [tab, setTab] = useState(initial);
  return (
    <>
      <PageHeader title="Requisitos" subtitle="Cumprir, criar e corrigir requisitos" />
      <Tabs tabs={[['cumprir', 'Cumprir'], ['criar', 'Criar'], ['corrigir', 'Corrigir']]} value={tab} onChange={setTab} />
      {tab === 'cumprir' && <><p className="muted small">Requisitos que o App manda para o seu clube cumprir.</p><RequirementsTodo /></>}
      {tab === 'criar' && <><p className="muted small">Requisitos com prazo e pontos para os membros do clube: desbravadores, liderança, ou todos. Contam no ranking do clube. Para as unidades, use a pasta <b>Unidades → Ranking</b>.</p><CreatedRequirements only="member" /></>}
      {tab === 'corrigir' && <ReviewsPanel />}
    </>
  );
}

/** Pasta Unidades: as unidades, o ranking das unidades (criar requisitos para eles) e os membros de cada unidade. */
function GruposFolder() {
  const { actor } = useAuth();
  const [tab, setTab] = useState(new URLSearchParams(location.search).get('aba') || 'grupos');
  return (
    <>
      <PageHeader title="Unidades" subtitle="Cada membro pertence a uma única unidade" />
      <Tabs tabs={[['grupos', 'Unidades'], ['ranking', 'Ranking'], ['membros', 'Membros']]} value={tab} onChange={setTab} />
      {tab === 'grupos' && <UnitsPage embedded />}
      {tab === 'ranking' && (
        <>
          <p className="muted small">Crie requisitos para as unidades do clube cumprirem juntos. Eles contam no ranking das unidades (a unidade Liderança não entra).</p>
          <CreatedRequirements only="unit" />
          <Section title="Ranking das unidades"><ClubUnitsRanking clubId={actor.id} base={base} /></Section>
        </>
      )}
      {tab === 'membros' && <MembrosPorGrupo base={base} />}
    </>
  );
}

const pasta = (title, subtitle, items) => <><PageHeader title={title} subtitle={subtitle} /><MoreMenu items={items} /></>;

/** Pasta de cima de cada tela do clube (para o botão Voltar). */
const PARENT = {
  membros: 'secretaria', transferencias: 'secretaria',
  secretaria: 'mais', unidades: 'mais', financas: 'mais', certificados: 'mais', ferramentas: 'mais', suporte: 'mais', eventos: 'mais', anuncios: 'mais', clubes: 'mais',
};
const clubParent = (path) => {
  if (path === `${base}/membros/novo`) return `${base}/membros`;
  const seg = path.split('/')[2];
  return PARENT[seg] ? `${base}/${PARENT[seg]}` : base;
};

/** Sistema do Clube: Perfil, Requisitos, Ranking, SGC e o resto em Mais. */
export default function ClubApp() {
  const { actor } = useAuth();
  useClubPresence();
  const tabs = [
    { to: base, icon: Tent, label: 'Perfil', end: true },
    { to: `${base}/requisitos`, icon: ClipboardCheck, label: 'Requisitos' },
    { to: `${base}/ranking`, icon: Trophy, label: 'Ranking' },
    { to: `${base}/sgc`, icon: Globe, label: 'SGC' },
    { to: `${base}/mais`, icon: Menu, label: 'Mais' },
  ];
  const secretaria = [
    { to: `${base}/membros`, icon: Users, label: 'Membros', hint: 'Cadastrar e ver os membros' },
    { to: `${base}/transferencias`, icon: ArrowLeftRight, label: 'Transferências', hint: 'Trazer alguém de outro clube e pedidos' },
  ];
  const more = [
    ...(actor.club_billing === 'gratis' && actor.member_billing !== 'pago' ? [] : [{ to: `${base}/plano`, icon: Wallet, label: 'Plano do clube', hint: actor.club_billing === 'gratis' ? 'Assumir a cobrança dos membros' : 'R$ 15 a cada 30 dias' }]),
    { to: `${base}/secretaria`, icon: FolderOpen, label: 'Secretaria', hint: 'Membros e transferências' },
    { to: `${base}/unidades`, icon: Flag, label: 'Unidades', hint: 'Unidades, ranking e membros' },
    { to: `${base}/financas`, icon: Wallet, label: 'Tesouraria', hint: 'Balancete do clube' },
    { to: `${base}/ferramentas`, icon: Wrench, label: 'Ferramentas', hint: 'Aniversariantes e contatos' },
    { to: `${base}/certificados`, icon: Award, label: 'Certificados', hint: 'De honra: clube e unidades' },
    { to: `${base}/suporte`, icon: LifeBuoy, label: 'Suporte', hint: 'Fale com a equipe' },
    { to: `${base}/eventos`, icon: Award, label: 'Eventos', hint: 'Eventos e participantes' },
    { to: `${base}/anuncios`, icon: Megaphone, label: 'Anúncios', hint: 'Para os seus membros' },
    { to: `${base}/clubes`, icon: Map, label: 'Clubes', hint: 'Por distrito' },
  ];
  return (
    <Routes>
      <Route
        path="*"
        element={
          <Shell tabs={tabs} parentOf={clubParent}>
            <Routes>
              <Route index element={<ClubHome />} />
              <Route path="secretaria" element={pasta('Secretaria', 'Membros e transferências', secretaria)} />
              <Route path="membros" element={<MembersPage />} />
              <Route path="transferencias" element={<TransfersPage />} />
              <Route path="membros/novo" element={<NewMemberPage />} />
              <Route path="requisitos" element={<RankingFolder />} />
              <Route path="ranking" element={<RankingHub base={base} />} />
              <Route path="sgc" element={<EmbeddedSite title="SGC" linkKey="link_sgc" subtitle="Sistema de Gestão de Clubes" />} />
              <Route path="unidades" element={<GruposFolder />} />
              <Route path="grupos" element={<Navigate to={`${base}/unidades`} replace />} />
              <Route path="financas" element={<FinancasPage />} />
              <Route path="plano" element={<><PageHeader title="Plano do clube" /><ClubPlanCard /></>} />
              <Route path="tesouraria" element={<Navigate to={`${base}/financas`} replace />} />
              <Route path="ferramentas" element={<FerramentasPage />} />
              <Route path="certificados" element={<GroupCertificatesPage club />} />
              <Route path="suporte" element={<SupportChat />} />
              <Route path="eventos" element={<EventsAdmin />} />
              <Route path="anuncios" element={<AnnouncementsAdmin />} />
              <Route path="clubes" element={<ClubsBrowser base={base} />} />
              <Route path="ver/:kind/:id" element={<InAppProfile base={base} />} />
              <Route path="mais" element={pasta('Mais', null, more)} />
              <Route path="*" element={<Navigate to={base} replace />} />
            </Routes>
          </Shell>
        }
      />
    </Routes>
  );
}
