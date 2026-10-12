import { useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowLeftRight, Award, BadgeCheck, KeyRound, UserPlus, CalendarDays, Check, Megaphone, Plus, ChevronRight, Compass, Flag, Inbox, Map, MapPin, Menu, Tent, Trophy, Users, Wallet, FolderOpen, Receipt, BookOpen, Package, Wrench, LifeBuoy,
} from 'lucide-react';
import { api, toForm } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { KIND_LABEL, plural } from '../../format.js';
import { FichaModal, MembersBrowser, TermLinkInline, TermLinkModal, memberActions } from './Members.jsx';
import { AccessInfo, CadastroFlow } from '../Signup.jsx';
import TransfersPage from './Transfers.jsx';
import { ClubPayments } from '../Payments.jsx';
import {
  AgendaPage, BibliotecaPage, CertificadoPage, FerramentasPage, FinancasPage, MatriculasPage, MembrosPorGrupo, PatrimonioPage, SuportePage,
} from './Folders.jsx';
import {
  Avatar, Badge, Button, Card, Confirm, Field, ImagePicker, Loading, MedalList, Modal, PageHeader, PositionBadge, Section, ShareButton, Stat, Tabs, useAsync, useLoad,
} from '../../ui.jsx';
import Shell, { MoreMenu } from '../Shell.jsx';
import { EventsList, InAppProfile } from '../Profiles.jsx';
import { CreatedRequirements, RequirementsTodo, ReviewsPanel } from '../Requirements.jsx';
import RankingHub, { ClubUnitsRanking, RankingTable } from '../Ranking.jsx';
import ClubsBrowser from '../Clubs.jsx';
import CatalogPicker, { CatalogBadge } from '../Catalog.jsx';
import EventsAdmin from '../admin/Events.jsx';
import AnnouncementsAdmin from '../admin/Announcements.jsx';

const base = '/cla';

// ---------- Início / perfil do clã ----------
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
              <div className="chips"><span className="chip ico"><MapPin size={14} /> {c.district_name}</span><span className="chip ico"><KeyRound size={14} /> Código do clã: <b>{c.code}</b></span></div>
              {c.director_name && <p className="small" style={{ margin: '.2rem 0 .4rem' }}>Diretor(a): <b>{c.director_name}</b>{c.associate_directors ? <> · Associados: {c.associate_directors.split('\n').join(', ')}</> : ''}</p>}
              {c.ranking && <PositionBadge position={c.ranking.position} points={c.ranking.points} label="no ranking de clãs" />}
              <div className="row wrap" style={{ justifyContent: 'center', marginTop: '.5rem' }}>
                <ShareButton path={`/cla/${c.code}`} title={c.name} />
                <Link to={`${base}/ver/cla/${c.id}`}><Button variant="yellow" small>Ver perfil público</Button></Link>
              </div>
            </div>
          </div>

          <Section title="Resumo">
            <div className="stats">
              <Stat icon={Compass} value={c.desbravadores} label="Exploradores" to={`${base}/membros`} />
              <Stat icon={Award} value={c.lideranca} label="Tutores" to={`${base}/membros`} />
              <Stat icon={Flag} value={c.unit_count} label="Grupos" to={`${base}/grupos`} />
              <Stat icon={BadgeCheck} value={c.pending_achievements} label="Insígnias p/ aprovar" to={`${base}/biblioteca`} accent={c.pending_achievements > 0} />
              <Stat icon={Inbox} value={c.pending_reviews} label="Envios p/ avaliar" to={`${base}/ranking?aba=corrigir`} accent={c.pending_reviews > 0} />
              <Stat icon={UserPlus} value={c.signup_pending} label="Inscrições p/ aprovar" to={`${base}/membros?aba=pendente`} accent={c.signup_pending > 0} />
              <Stat icon={ArrowLeftRight} value={c.transfers_pending} label="Transferências" to={`${base}/transferencias`} accent={c.transfers_pending > 0} />
            </div>
          </Section>

          <ClubInfoForm club={c} onDone={() => { state.reload(); refresh(); }} />

          <Section title="Logo do clã">
            <Card>
              <div className="stack">
                <ImagePicker label="Logo do clã" value={c.logo} onChange={upload('logo')} round={false} name={c.name} />
              </div>
            </Card>
          </Section>

          <Section title="Ranking dos grupos" action={<Link to={`${base}/ranking`} className="small ico">Ver tudo <ChevronRight size={14} /></Link>}>
            <RankingTable rows={c.units_ranking} link={(r) => `${base}/ver/grupo/${r.id}`} />
          </Section>
          <MedalList medals={c.medals} />
          <EventsList events={c.events} />
        </>
      )}
    </Loading>
  );
}

/** História do clã. O nome do diretor só o administrativo muda (todo ano). */
function ClubInfoForm({ club, onDone }) {
  const [history, setHistory] = useState(club.history || '');
  const [busy, run] = useAsync();
  const save = async () => {
    await run(() => api.put('/club/profile', toForm({ history })), 'Salvo!');
    onDone();
  };
  return (
    <Section title="História do clã">
      <Card>
        <div className="form">
          <p className="small muted" style={{ margin: 0 }}>Diretor(a): <b>{club.director_name || '—'}</b>{club.associate_directors ? <> · Associados: <b>{club.associate_directors.split('\n').join(', ')}</b></> : ''}. Quem troca a diretoria é o administrativo.</p>
          <Field label="Nossa história" hint="Aparece no perfil público do clã."><textarea value={history} onChange={(e) => setHistory(e.target.value)} placeholder="Como o clã começou, conquistas, acampamentos marcantes..." style={{ minHeight: 120 }} /></Field>
          <div className="row" style={{ justifyContent: 'flex-end' }}><Button busy={busy} disabled={history === (club.history || '')} onClick={save}>Salvar</Button></div>
        </div>
      </Card>
    </Section>
  );
}

/**
 * Cargos pela idade: 10 a 15 anos só Explorador; 16+ Liderança e Tutores;
 * diretoria (Geral, Associado, Mirins) só a partir de 18.
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
      <optgroup label="Liderança">{lid.map(opt)}</optgroup>
      <optgroup label="Tutores">{meta.cargos.lideranca.filter((c) => !lid.includes(c)).map(opt)}</optgroup>
    </>
  );
}

// ---------- Membros ----------
/** Editar membro: grupo e cargo. Os dados pessoais ficam na Ficha. */
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
          {kind === 'desbravador' ? 'De 10 a 15 anos o cargo é Explorador.' : member.age < 18 ? 'Cargos de diretoria só a partir de 18 anos.' : ''}
          {' '}Nome, nascimento e documentos ficam em <b>Ficha</b>.
        </p>
        <div className="grid2">
          <Field label="Grupo" hint={kind === 'lideranca' ? 'Sem escolha: entra no grupo Tutores' : 'Sem escolha: aparece como "Sem grupo"'}>
            <select value={f.unit_id} onChange={set('unit_id')}>
              <option value="">{kind === 'lideranca' ? 'Tutores (automático)' : 'Sem grupo'}</option>
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

function AchievementsModal({ member, onClose, onDone }) {
  const type = 'especialidade';
  const catalogs = { classe: useLoad(() => api.get('/catalog?type=classe')), especialidade: useLoad(() => api.get('/catalog?type=especialidade')) };
  const detail = useLoad(() => api.get('/club/members/' + member.id));
  const [sel, setSel] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, run] = useAsync();
  const chosen = sel ?? new Set((detail.data?.achievements || []).map((a) => a.content_id));
  const save = async () => {
    await run(() => api.put(`/club/members/${member.id}/achievements`, { content_ids: [...chosen] }), 'Salvo! Já aparece no perfil.');
    onDone();
  };
  const addMissing = async () => {
    const r = await run(() => api.post('/club/catalog', { name: newName }), 'Insígnia adicionada ao catálogo');
    setNewName('');
    setAdding(false);
    await catalogs.especialidade.reload();
    setSel(new Set([...chosen, r.id]));
  };
  const cat = catalogs[type];
  return (
    <Modal title={`Insígnias · ${member.name.split(' ')[0]}`} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button busy={busy} onClick={save}>Salvar ({chosen.size})</Button></>}>
      <Loading data={cat.data && detail.data} loading={cat.loading || detail.loading} error={cat.error || detail.error}>
        {() => (
          <>
            <CatalogPicker key={type} type={type} items={cat.data.filter((c) => !(type === 'classe' && c.leader && member.kind !== 'lideranca'))} selected={chosen} onChange={setSel} />
            {type === 'especialidade' && (
              <div className="mt">
                {adding ? (
                  <div className="row">
                    <input autoFocus placeholder="Nome da insígnia" value={newName} onChange={(e) => setNewName(e.target.value)} />
                    <Button small busy={busy} onClick={addMissing}>Adicionar</Button>
                  </div>
                ) : <button type="button" className="ig-link" onClick={() => setAdding(true)}>Não achou? Adicionar insígnia que falta</button>}
              </div>
            )}
          </>
        )}
      </Loading>
    </Modal>
  );
}

/** Aprovações: insígnias que os membros informaram ter. */
function ApprovalsPage() {
  const [status, setStatus] = useState('pendente');
  const members = useLoad(() => api.get('/club/members'));
  const [picking, setPicking] = useState(false);
  const [addFor, setAddFor] = useState(null);
  const state = useLoad(() => api.get('/club/achievement-requests?status=' + status), [status]);
  const [sel, setSel] = useState(new Set());
  const [busy, run] = useAsync();
  const decide = async (ids, decision) => {
    await run(() => api.post('/club/achievement-requests/decide', { ids, decision }), decision === 'aprovado' ? 'Aprovado! Já aparece no perfil.' : 'Recusado');
    setSel(new Set());
    state.reload();
  };
  const toggle = (id) => { const s = new Set(sel); s.has(id) ? s.delete(id) : s.add(id); setSel(s); };
  return (
    <>
      <PageHeader title="Aprovações" subtitle="Insígnias que os membros dizem ter"
        action={<Button small onClick={() => setPicking(true)}><Plus size={15} /> Adicionar</Button>} />
      {picking && (
        <Modal title="Adicionar para qual membro?" onClose={() => setPicking(false)}>
          <p className="muted small" style={{ marginBottom: '.6rem' }}>Registre insígnias mesmo que o membro não tenha pedido.</p>
          <div className="list">
            {(members.data || []).map((m) => (
              <button key={m.id} type="button" className="list-item" style={{ font: 'inherit', textAlign: 'left', cursor: 'pointer' }} onClick={() => { setPicking(false); setAddFor(m); }}>
                <Avatar src={m.photo} name={m.name} size={38} />
                <div className="grow"><div className="title">{m.name}</div><div className="sub">{m.unit_name || 'Sem grupo'} · {m.cargo}</div></div>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {addFor && <AchievementsModal member={addFor} onClose={() => setAddFor(null)} onDone={() => { setAddFor(null); state.reload(); }} />}
      <div className="seg" style={{ marginBottom: '1rem' }}>
        {[['pendente', 'Para aprovar'], ['aprovado', 'Aprovadas'], ['recusado', 'Recusadas']].map(([k, l]) => (
          <button key={k} type="button" className={status === k ? 'active' : ''} onClick={() => { setStatus(k); setSel(new Set()); }}>{l}</button>
        ))}
      </div>
      <Loading {...state} empty={status === 'pendente' ? 'Nenhum pedido para aprovar.' : 'Nada por aqui.'}>
        {(groups) => groups.map((g) => {
          const ids = g.items.map((i) => i.id);
          return (
            <Card key={g.member_id}>
              <div className="row">
                <Avatar src={g.photo} name={g.name} size={44} />
                <div className="grow"><b>{g.name}</b><div className="small muted">{g.unit_name || 'Sem grupo'}{g.code ? ' · ' + g.code : ''}</div></div>
                <Badge kind={status === 'pendente' ? 'yellow' : status === 'aprovado' ? 'green' : 'red'}>{g.items.length}</Badge>
              </div>
              <div className="approve-list">
                {g.items.map((i) => (
                  <label key={i.id} className={'approve-item' + (sel.has(i.id) ? ' on' : '')}>
                    {status === 'pendente' && <input type="checkbox" checked={sel.has(i.id)} onChange={() => toggle(i.id)} />}
                    <CatalogBadge c={i} size={40} />
                    <span className="grow"><b>{i.name}</b><small>{i.category}</small></span>
                  </label>
                ))}
              </div>
              {status === 'pendente' && (
                <div className="row wrap" style={{ marginTop: '.6rem' }}>
                  <Button small variant="green" busy={busy} onClick={() => decide(ids, 'aprovado')}><Check size={14} /> Aprovar tudo</Button>
                  {ids.some((id) => sel.has(id)) && (
                    <>
                      <Button small variant="secondary" busy={busy} onClick={() => decide(ids.filter((id) => sel.has(id)), 'aprovado')}>Aprovar marcadas</Button>
                      <Button small variant="danger" busy={busy} onClick={() => decide(ids.filter((id) => sel.has(id)), 'recusado')}>Recusar marcadas</Button>
                    </>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </Loading>
    </>
  );
}

/** Aprovar inscrição: escolhe o grupo e o cargo. */
function ApproveModal({ member, units, onClose, onDone }) {
  const [f, setF] = useState({ unit_id: '', cargo: '' });
  const [busy, run] = useAsync();
  const save = async () => {
    await run(() => api.post(`/club/members/${member.id}/aprovar`, { ...f, unit_id: f.unit_id || '' }), `${member.name.split(' ')[0]} agora faz parte do clã!`);
    onDone();
  };
  const available = units.filter((u) => !(u.is_leadership && member.kind === 'desbravador'));
  return (
    <Modal title={`Aprovar ${member.name}`} onClose={onClose} footer={<Button busy={busy} onClick={save}><Check size={16} /> Aprovar</Button>}>
      <div className="form">
        <p className="small muted" style={{ marginTop: 0 }}>{member.age} anos · {member.role}. Confira a ficha antes de aprovar.</p>
        <div className="grid2">
          <Field label="Grupo">
            <select value={f.unit_id} onChange={(e) => setF({ ...f, unit_id: e.target.value })}>
              <option value="">{member.kind === 'lideranca' ? 'Tutores (automático)' : 'Sem grupo'}</option>
              {available.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <Field label="Cargo">
            <select value={f.cargo} onChange={(e) => setF({ ...f, cargo: e.target.value })}>
              <option value="">Padrão</option>
              <CargoOptions kind={member.kind} age={member.age} />
            </select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function MembersPage() {
  const members = useLoad(() => api.get('/club/members'));
  const units = useLoad(() => api.get('/club/units'));
  const [editing, setEditing] = useState(null);
  const [ach, setAch] = useState(null);
  const [ficha, setFicha] = useState(null);
  const [approving, setApproving] = useState(null);
  const [termFor, setTermFor] = useState(null);
  const [, run] = useAsync();
  const done = () => { setEditing(null); setAch(null); setApproving(null); members.reload(); units.reload(); };
  const tab = new URLSearchParams(location.search).get('aba');
  return (
    <>
      <PageHeader title="Membros" subtitle="Ninguém é apagado: quem sai do clã fica inativo" action={<Link to={`${base}/membros/novo`}><Button small>+ Novo</Button></Link>} />
      <Loading {...members}>
        {(list) => (
          <MembersBrowser list={list} units={units.data || []} initialTab={tab || 'ativo'}
            actions={memberActions({ base, run, done, setFicha, setEditing, setAch, setApproving, setTermFor })} />
        )}
      </Loading>
      {editing && <MemberForm member={editing} units={units.data || []} onClose={() => setEditing(null)} onDone={done} />}
      {ach && <AchievementsModal member={ach} onClose={() => setAch(null)} onDone={() => done()} />}
      {ficha && <FichaModal member={ficha} url={`/club/members/${ficha.id}/ficha`} onClose={() => { setFicha(null); members.reload(); }} />}
      {approving && <ApproveModal member={approving} units={units.data || []} onClose={() => setApproving(null)} onDone={() => done()} />}
      {termFor && <TermLinkModal member={termFor} onClose={() => setTermFor(null)} />}
    </>
  );
}

/** Cadastro feito pelo clã: precisa de todos os dados, igual à inscrição pelo link. */
function NewMemberPage() {
  const { actor } = useAuth();
  const nav = useNavigate();
  const [created, setCreated] = useState(null);
  const [busy, run] = useAsync();
  const send = async (body) => {
    const r = await run(() => api.post('/club/members', body), null);
    setCreated({ ...r, name: body.name, kind: (Date.now() - Date.parse(body.birth_date)) / 31557600000 < 16 ? 'desbravador' : 'lideranca' });
  };
  return (
    <>
      <button type="button" className="back-link" onClick={() => nav(`${base}/membros`)}><ArrowLeft size={16} /> Membros</button>
      <PageHeader title="Novo membro" subtitle="Preencha todos os dados. Depois, envie o link do termo para o responsável assinar." />
      <CadastroFlow mode="cla" local={`${actor.name} — cadastro pelo clã`} submitLabel="Cadastrar membro" busy={busy} onSubmit={send} />
      {created && (
        <Modal title="Membro cadastrado!" onClose={() => nav(`${base}/membros?aba=pendente`)} footer={<Button onClick={() => nav(`${base}/membros?aba=pendente`)}>Entendi</Button>}>
          <p className="center">Acesso do membro na tela Membros:</p>
          <AccessInfo code={created.code} password={created.password} />
          <p className="center small">É um <b>pré-cadastro</b>: o membro entra no app, mas só usa depois que assinarem o termo e o clã pagar a inscrição do ano (em Pagamentos). Envie o link do termo:</p>
          <TermLinkInline member={{ name: created.name, terms_token: created.terms_token, kind: created.kind }} />
        </Modal>
      )}
    </>
  );
}

// ---------- Grupos ----------
function UnitForm({ unit, onClose, onDone }) {
  const [f, setF] = useState({ name: unit?.name || '', logo: unit?.logo || null });
  const [busy, run] = useAsync();
  const save = async () => {
    const body = { ...f, logo: f.logo instanceof File ? f.logo : undefined };
    await run(() => (unit ? api.put('/club/units/' + unit.id, toForm(body)) : api.post('/club/units', toForm(body))), 'Grupo salvo!');
    onDone();
  };
  return (
    <Modal title={unit ? 'Editar grupo' : 'Novo grupo'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button busy={busy} onClick={save}>Salvar</Button></>}>
      <div className="form">
        <ImagePicker label="Logo do grupo" value={f.logo} onChange={(logo) => setF({ ...f, logo })} round={false} name={f.name} />
        <Field label="Nome"><input value={f.name} disabled={unit?.is_leadership} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        {!unit && <p className="muted small">O app cria a senha do grupo (2 letras + 4 números), que não pode ser trocada. O padrinho entra pela tela Clã com o código do clã e essa senha.</p>}
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
        ? <Button block onClick={() => setEditing('new')}>+ Novo grupo</Button>
        : <PageHeader title="Grupos" subtitle="Cada membro pertence a um único grupo · até 10 grupos, numerados de 1 a 10" action={<Button small onClick={() => setEditing('new')}>+ Novo</Button>} />}
      <Card className="small mt">Até 10 grupos, numerados de 1 a 10. Para entrar no Portal do Grupo: tela <b>Clã</b>, código do clã <b>{actor.code}</b> e a senha do grupo abaixo. As senhas são criadas pelo app e <b>não podem ser trocadas</b>: guarde bem.</Card>
      <Loading {...state}>
        {(list) => (
          <div className="list mt">
            {list.map((u) => (
              <div key={u.id} className="list-item">
                <Avatar src={u.logo} name={u.name} size={52} square />
                <div className="grow">
                  <div className="title">{u.is_leadership ? '' : `Grupo ${u.number} · `}{u.name} {u.is_leadership ? <Badge kind="yellow">automático</Badge> : null}</div>
                  <div className="sub">{plural(u.member_count, 'membro', 'membros')} · senha <span className="pin-box"><KeyRound size={13} />{u.pin}</span></div>
                  <div className="sub ellipsis">Link: {location.host}/cla/{actor.code}/{u.is_leadership ? 'tutores' : u.number}</div>
                  <div className="row wrap" style={{ marginTop: '.4rem', gap: '.35rem' }}>
                    <Button small variant="secondary" onClick={() => setEditing(u)}>Editar</Button>
                    <Link to={`${base}/ver/grupo/${u.id}`}><Button small variant="ghost">Perfil</Button></Link>
                    {!u.is_leadership && <Confirm text={`Excluir o grupo ${u.name}? Os membros ficarão sem grupo.`} onYes={() => run(() => api.del('/club/units/' + u.id), 'Grupo excluído').then(done)}>Excluir</Confirm>}
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
      <PageHeader title="Ranking" subtitle="Cumprir, criar e corrigir requisitos" />
      <Tabs tabs={[['cumprir', 'Cumprir'], ['criar', 'Criar'], ['corrigir', 'Corrigir'], ['classificacao', 'Classificação']]} value={tab} onChange={setTab} />
      {tab === 'cumprir' && <><p className="muted small">Requisitos que o App manda para o seu clã cumprir.</p><RequirementsTodo /></>}
      {tab === 'criar' && <><p className="muted small">Requisitos com prazo e pontos para os membros do clã: exploradores, liderança e tutores, ou todos. Contam no ranking do clã. Para os grupos, use a pasta <b>Grupos → Ranking</b>.</p><CreatedRequirements only="member" /></>}
      {tab === 'corrigir' && <ReviewsPanel />}
      {tab === 'classificacao' && <RankingHub base={base} />}
    </>
  );
}

/** Pasta Grupos: os grupos, o ranking dos grupos (criar requisitos para eles) e os membros de cada grupo. */
function GruposFolder() {
  const { actor } = useAuth();
  const [tab, setTab] = useState(new URLSearchParams(location.search).get('aba') || 'grupos');
  return (
    <>
      <PageHeader title="Grupos" subtitle="Cada membro pertence a um único grupo" />
      <Tabs tabs={[['grupos', 'Grupos'], ['ranking', 'Ranking'], ['membros', 'Membros']]} value={tab} onChange={setTab} />
      {tab === 'grupos' && <UnitsPage embedded />}
      {tab === 'ranking' && (
        <>
          <p className="muted small">Crie requisitos para os grupos do clã cumprirem juntos. Eles contam no ranking dos grupos (o grupo Tutores não entra).</p>
          <CreatedRequirements only="unit" />
          <Section title="Ranking dos grupos"><ClubUnitsRanking clubId={actor.id} base={base} /></Section>
        </>
      )}
      {tab === 'membros' && <MembrosPorGrupo base={base} />}
    </>
  );
}

const pasta = (title, subtitle, items) => <><PageHeader title={title} subtitle={subtitle} /><MoreMenu items={items} /></>;

/** Sistema do Clã, dividido em pastas. */
export default function ClubApp() {
  const tabs = [
    { to: base, icon: Tent, label: 'Painel', end: true },
    { to: `${base}/secretaria`, icon: FolderOpen, label: 'Secretaria' },
    { to: `${base}/ranking`, icon: Trophy, label: 'Ranking' },
    { to: `${base}/grupos`, icon: Flag, label: 'Grupos' },
    { to: `${base}/mais`, icon: Menu, label: 'Mais' },
  ];
  const secretaria = [
    { to: `${base}/agenda`, icon: CalendarDays, label: 'Agenda', hint: 'Reuniões, acampamentos e datas do App' },
    { to: `${base}/matriculas`, icon: UserPlus, label: 'Matrículas', hint: 'Links de inscrição e do clã' },
    { to: `${base}/membros`, icon: Users, label: 'Membros', hint: 'Ativos, pendentes e desatualizados' },
    { to: `${base}/transferencias`, icon: ArrowLeftRight, label: 'Transferências', hint: 'Que foram, que vieram e pendentes' },
  ];
  const tesouraria = [
    { to: `${base}/pagamentos`, icon: Receipt, label: 'A pagar', hint: 'Plano do clã e inscrições (Pix)' },
    { to: `${base}/financas`, icon: Wallet, label: 'Minhas finanças', hint: 'Entradas e saídas do clã' },
  ];
  const more = [
    { to: `${base}/tesouraria`, icon: Wallet, label: 'Tesouraria', hint: 'A pagar e minhas finanças' },
    { to: `${base}/biblioteca`, icon: BookOpen, label: 'Biblioteca', hint: 'Insígnias e guias' },
    { to: `${base}/patrimonio`, icon: Package, label: 'Patrimônio', hint: 'Meus patrimônios' },
    { to: `${base}/ferramentas`, icon: Wrench, label: 'Ferramentas', hint: 'Aniversariantes e contatos' },
    { to: `${base}/suporte`, icon: LifeBuoy, label: 'Suporte', hint: 'Fale com a equipe' },
    { to: `${base}/eventos`, icon: Award, label: 'Eventos', hint: 'Participantes e medalhas' },
    { to: `${base}/anuncios`, icon: Megaphone, label: 'Anúncios', hint: 'Para os seus membros' },
    { to: `${base}/clas`, icon: Map, label: 'Clãs', hint: 'Por distrito' },
  ];
  return (
    <Routes>
      <Route path="certificado/:mid/:cid" element={<CertificadoPage />} />
      <Route
        path="*"
        element={
          <Shell tabs={tabs}>
            <Routes>
              <Route index element={<ClubHome />} />
              <Route path="secretaria" element={pasta('Secretaria', 'Agenda, matrículas, membros e transferências', secretaria)} />
              <Route path="agenda" element={<AgendaPage />} />
              <Route path="matriculas" element={<MatriculasPage />} />
              <Route path="membros" element={<MembersPage />} />
              <Route path="membros/novo" element={<NewMemberPage />} />
              <Route path="transferencias" element={<TransfersPage />} />
              <Route path="ranking" element={<RankingFolder />} />
              <Route path="requisitos" element={<Navigate to={`${base}/ranking`} replace />} />
              <Route path="grupos" element={<GruposFolder />} />
              <Route path="tesouraria" element={pasta('Tesouraria', 'O que pagar e o controle do dinheiro do clã', tesouraria)} />
              <Route path="pagamentos" element={<ClubPayments />} />
              <Route path="financas" element={<FinancasPage />} />
              <Route path="biblioteca" element={<BibliotecaPage approvals={<ApprovalsPage />} />} />
              <Route path="aprovacoes" element={<Navigate to={`${base}/biblioteca`} replace />} />
              <Route path="patrimonio" element={<PatrimonioPage />} />
              <Route path="ferramentas" element={<FerramentasPage />} />
              <Route path="suporte" element={<SuportePage />} />
              <Route path="eventos" element={<EventsAdmin />} />
              <Route path="anuncios" element={<AnnouncementsAdmin />} />
              <Route path="clas" element={<ClubsBrowser base={base} />} />
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
