import { useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight, Award, BadgeCheck, KeyRound, UserPlus, CalendarDays, Check, Megaphone, Plus, ChevronRight, Compass, Flag, Inbox, Map, MapPin, Menu, Tent, Trophy, Users, Wallet, ClipboardCheck, Globe, FolderOpen, BookOpen, Wrench, LifeBuoy,
} from 'lucide-react';
import { api, toForm } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { KIND_LABEL, plural } from '../../format.js';
import { MembersBrowser, memberActions } from './Members.jsx';
import { AccessInfo } from '../Signup.jsx';
import TransfersPage from './Transfers.jsx';
import {
  AgendaPage, BibliotecaPage, CertificadoPage, FerramentasPage, FinancasPage, MembrosPorGrupo,
} from './Folders.jsx';
import { EmbeddedSite, SupportChat } from '../Shared.jsx';
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

const base = '/clube';

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

          <Section title="Resumo">
            <div className="stats">
              <Stat icon={Compass} value={c.desbravadores} label="Desbravadores" to={`${base}/membros`} />
              <Stat icon={Award} value={c.lideranca} label="Liderança" to={`${base}/membros`} />
              <Stat icon={Flag} value={c.unit_count} label="Unidades" to={`${base}/unidades`} />
              <Stat icon={BadgeCheck} value={c.pending_achievements} label="Especialidades p/ aprovar" to={`${base}/biblioteca`} accent={c.pending_achievements > 0} />
              <Stat icon={Inbox} value={c.pending_reviews} label="Envios p/ avaliar" to={`${base}/requisitos?aba=corrigir`} accent={c.pending_reviews > 0} />
              <Stat icon={ArrowLeftRight} value={c.transfers_pending} label="Transferências" to={`${base}/transferencias`} accent={c.transfers_pending > 0} />
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

function AchievementsModal({ member, onClose, onDone }) {
  const [type, setType] = useState('especialidade');
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
    const r = await run(() => api.post('/club/catalog', { name: newName }), 'Especialidade adicionada ao catálogo');
    setNewName('');
    setAdding(false);
    await catalogs.especialidade.reload();
    setSel(new Set([...chosen, r.id]));
  };
  const cat = catalogs[type];
  return (
    <Modal title={`Especialidades e classes · ${member.name.split(' ')[0]}`} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button busy={busy} onClick={save}>Salvar ({chosen.size})</Button></>}>
      <Loading data={cat.data && detail.data} loading={cat.loading || detail.loading} error={cat.error || detail.error}>
        {() => (
          <>
            <div className="seg" style={{ marginBottom: '.8rem' }}>
              {[['especialidade', 'Especialidades'], ['classe', 'Classes']].map(([k, l]) => (
                <button key={k} type="button" className={type === k ? 'active' : ''} onClick={() => setType(k)}>{l}</button>
              ))}
            </div>
            <CatalogPicker key={type} type={type} items={cat.data.filter((c) => !(type === 'classe' && c.leader && member.kind !== 'lideranca'))} selected={chosen} onChange={setSel} />
            {type === 'especialidade' && (
              <div className="mt">
                {adding ? (
                  <div className="row">
                    <input autoFocus placeholder="Nome da especialidade" value={newName} onChange={(e) => setNewName(e.target.value)} />
                    <Button small busy={busy} onClick={addMissing}>Adicionar</Button>
                  </div>
                ) : <button type="button" className="ig-link" onClick={() => setAdding(true)}>Não achou? Adicionar especialidade que falta</button>}
              </div>
            )}
          </>
        )}
      </Loading>
    </Modal>
  );
}

/** Aprovações: especialidades que os membros informaram ter. */
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
      <PageHeader title="Aprovações" subtitle="Especialidades e classes que os membros dizem ter"
        action={<Button small onClick={() => setPicking(true)}><Plus size={15} /> Adicionar</Button>} />
      {picking && (
        <Modal title="Adicionar para qual membro?" onClose={() => setPicking(false)}>
          <p className="muted small" style={{ marginBottom: '.6rem' }}>Registre especialidades e classes mesmo que o membro não tenha pedido.</p>
          <div className="list">
            {(members.data || []).map((m) => (
              <button key={m.id} type="button" className="list-item" style={{ font: 'inherit', textAlign: 'left', cursor: 'pointer' }} onClick={() => { setPicking(false); setAddFor(m); }}>
                <Avatar src={m.photo} name={m.name} size={38} />
                <div className="grow"><div className="title">{m.name}</div><div className="sub">{m.unit_name || 'Sem unidade'} · {m.cargo}</div></div>
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
                <div className="grow"><b>{g.name}</b><div className="small muted">{g.unit_name || 'Sem unidade'}{g.code ? ' · ' + g.code : ''}</div></div>
                <Badge kind={status === 'pendente' ? 'yellow' : status === 'aprovado' ? 'green' : 'red'}>{g.items.length}</Badge>
              </div>
              <div className="approve-list">
                {g.items.map((i) => (
                  <label key={i.id} className={'approve-item' + (sel.has(i.id) ? ' on' : '')}>
                    {status === 'pendente' && <input type="checkbox" checked={sel.has(i.id)} onChange={() => toggle(i.id)} />}
                    <CatalogBadge c={i} size={40} />
                    <span className="grow"><b>{i.name}</b><small>{i.type === 'classe' ? 'Classe' : i.category}</small></span>
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


function MembersPage() {
  const members = useLoad(() => api.get('/club/members'));
  const units = useLoad(() => api.get('/club/units'));
  const [editing, setEditing] = useState(null);
  const [ach, setAch] = useState(null);
  const [, run] = useAsync();
  const done = () => { setEditing(null); setAch(null); members.reload(); units.reload(); };
  return (
    <>
      <PageHeader title="Membros" subtitle="Ninguém é apagado: quem sai do clube fica inativo" action={<Link to={`${base}/membros/novo`}><Button small>+ Novo</Button></Link>} />
      <Loading {...members}>
        {(list) => <MembersBrowser list={list} units={units.data || []} actions={memberActions({ base, run, done, setEditing, setAch })} />}
      </Loading>
      {editing && <MemberForm member={editing} units={units.data || []} onClose={() => setEditing(null)} onDone={done} />}
      {ach && <AchievementsModal member={ach} onClose={() => setAch(null)} onDone={() => done()} />}
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
  agenda: 'secretaria', membros: 'secretaria', transferencias: 'secretaria',
  secretaria: 'mais', unidades: 'mais', financas: 'mais', biblioteca: 'mais', ferramentas: 'mais', suporte: 'mais', eventos: 'mais', anuncios: 'mais', clubes: 'mais',
};
const clubParent = (path) => {
  if (path === `${base}/membros/novo`) return `${base}/membros`;
  const seg = path.split('/')[2];
  return PARENT[seg] ? `${base}/${PARENT[seg]}` : base;
};

/** Sistema do Clube: Perfil, Requisitos, Ranking, SGC e o resto em Mais. */
export default function ClubApp() {
  const tabs = [
    { to: base, icon: Tent, label: 'Perfil', end: true },
    { to: `${base}/requisitos`, icon: ClipboardCheck, label: 'Requisitos' },
    { to: `${base}/ranking`, icon: Trophy, label: 'Ranking' },
    { to: `${base}/sgc`, icon: Globe, label: 'SGC' },
    { to: `${base}/mais`, icon: Menu, label: 'Mais' },
  ];
  const secretaria = [
    { to: `${base}/agenda`, icon: CalendarDays, label: 'Agenda', hint: 'Reuniões, acampamentos e datas do App' },
    { to: `${base}/membros`, icon: Users, label: 'Membros', hint: 'Cadastrar e ver os membros' },
    { to: `${base}/transferencias`, icon: ArrowLeftRight, label: 'Transferências', hint: 'Que foram, que vieram e pendentes' },
  ];
  const more = [
    { to: `${base}/secretaria`, icon: FolderOpen, label: 'Secretaria', hint: 'Agenda, membros e transferências' },
    { to: `${base}/unidades`, icon: Flag, label: 'Unidades', hint: 'Unidades, ranking e membros' },
    { to: `${base}/financas`, icon: Wallet, label: 'Tesouraria', hint: 'Balancete do clube' },
    { to: `${base}/biblioteca`, icon: BookOpen, label: 'Biblioteca', hint: 'Especialidades e classes' },
    { to: `${base}/ferramentas`, icon: Wrench, label: 'Ferramentas', hint: 'Aniversariantes e contatos' },
    { to: `${base}/suporte`, icon: LifeBuoy, label: 'Suporte', hint: 'Fale com a equipe' },
    { to: `${base}/eventos`, icon: Award, label: 'Eventos e medalhas', hint: 'Participantes e medalhas' },
    { to: `${base}/anuncios`, icon: Megaphone, label: 'Anúncios', hint: 'Para os seus membros' },
    { to: `${base}/clubes`, icon: Map, label: 'Clubes', hint: 'Por distrito' },
  ];
  return (
    <Routes>
      <Route path="certificado/:mid/:cid" element={<CertificadoPage />} />
      <Route
        path="*"
        element={
          <Shell tabs={tabs} parentOf={clubParent}>
            <Routes>
              <Route index element={<ClubHome />} />
              <Route path="secretaria" element={pasta('Secretaria', 'Agenda, membros e transferências', secretaria)} />
              <Route path="agenda" element={<AgendaPage />} />
              <Route path="membros" element={<MembersPage />} />
              <Route path="membros/novo" element={<NewMemberPage />} />
              <Route path="transferencias" element={<TransfersPage />} />
              <Route path="requisitos" element={<RankingFolder />} />
              <Route path="ranking" element={<RankingHub base={base} />} />
              <Route path="sgc" element={<EmbeddedSite title="SGC" linkKey="link_sgc" subtitle="Sistema de Gestão de Clubes" />} />
              <Route path="unidades" element={<GruposFolder />} />
              <Route path="grupos" element={<Navigate to={`${base}/unidades`} replace />} />
              <Route path="financas" element={<FinancasPage />} />
              <Route path="tesouraria" element={<Navigate to={`${base}/financas`} replace />} />
              <Route path="biblioteca" element={<BibliotecaPage approvals={<ApprovalsPage />} />} />
              <Route path="aprovacoes" element={<Navigate to={`${base}/biblioteca`} replace />} />
              <Route path="ferramentas" element={<FerramentasPage />} />
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
