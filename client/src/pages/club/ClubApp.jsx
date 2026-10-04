import { useState } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import {
  Award, BadgeCheck, CalendarDays, Check, Megaphone, Plus, ChevronRight, ClipboardCheck, Compass, Flag, Inbox, Map, MapPin, Menu, MessageCircle, ShieldAlert, Sparkles, Tent, Trophy, Users,
} from 'lucide-react';
import { api, toForm } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { useRealtime } from '../../realtime.jsx';
import { KIND_LABEL, plural } from '../../format.js';
import {
  Avatar, Badge, Button, Card, Confirm, Empty, Field, ImagePicker, Loading, MedalList, Modal, PageHeader, PositionBadge, Section, ShareButton, Stat, Tabs, useAsync, useLoad,
} from '../../ui.jsx';
import Shell, { MoreMenu } from '../Shell.jsx';
import { EventsList, InAppProfile } from '../Profiles.jsx';
import { CreatedRequirements, RequirementsTodo, ReviewsPanel } from '../Requirements.jsx';
import RankingHub, { RankingTable } from '../Ranking.jsx';
import ClubsBrowser from '../Clubs.jsx';
import { ChatConversation, ChatHome, ReportsPanel } from '../Chat.jsx';
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
            {c.photo && <div className="hero-cover" style={{ backgroundImage: `url(${c.photo})` }} />}
            <div className="profile-head">
              <Avatar src={c.logo} name={c.name} size={88} square />
              <h1>{c.name}</h1>
              <div className="chips"><span className="chip ico"><MapPin size={14} /> {c.district_name}</span><span className="chip">Usuário: {c.username}</span></div>
              {c.ranking && <PositionBadge position={c.ranking.position} points={c.ranking.points} label="no ranking de clubes" />}
              <div className="row wrap" style={{ justifyContent: 'center', marginTop: '.5rem' }}>
                <ShareButton path={`/p/clube/${c.id}`} title={c.name} />
                <Link to={`${base}/ver/clube/${c.id}`}><Button variant="yellow" small>Ver perfil público</Button></Link>
              </div>
            </div>
          </div>

          <Section title="Resumo">
            <div className="stats">
              <Stat icon={Compass} value={c.desbravadores} label="Desbravadores" to={`${base}/membros`} />
              <Stat icon={Award} value={c.lideranca} label="Liderança" to={`${base}/membros`} />
              <Stat icon={Flag} value={c.unit_count} label="Unidades" to={`${base}/unidades`} />
              <Stat icon={BadgeCheck} value={c.pending_achievements} label="Classes/especialidades p/ aprovar" to={`${base}/aprovacoes`} accent={c.pending_achievements > 0} />
              <Stat icon={Inbox} value={c.pending_reviews} label="Envios p/ avaliar" to={`${base}/requisitos?aba=avaliar`} accent={c.pending_reviews > 0} />
              <Stat icon={Flag} value={c.open_reports} label="Denúncias abertas" to={`${base}/denuncias`} accent={c.open_reports > 0} />
            </div>
          </Section>

          <Section title="Foto e logo do clube">
            <Card>
              <div className="stack">
                <ImagePicker label="Logo do clube" value={c.logo} onChange={upload('logo')} round={false} name={c.name} />
                <ImagePicker label="Foto de capa do clube" value={c.photo} onChange={upload('photo')} round={false} />
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

// ---------- Membros ----------
function MemberForm({ member, units, onClose, onDone }) {
  const { meta } = useAuth();
  const [f, setF] = useState({
    name: member?.name || '', birth_date: member?.birth_date || '', cargo: member?.cargo || '', unit_id: member?.unit_id || '',
    excellence: !!member?.excellence, username: member?.username || '', password: '', photo: member?.photo || null,
  });
  const [busy, run] = useAsync();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const age = f.birth_date ? Math.floor((Date.now() - Date.parse(f.birth_date + 'T12:00:00')) / 31557600000) : null;
  const kind = age == null ? null : age < 10 ? 'invalido' : age <= 15 ? 'desbravador' : 'lideranca';
  const cargos = kind && kind !== 'invalido' ? meta.cargos[kind] : [];
  const availableUnits = units.filter((u) => !(u.is_leadership && kind === 'desbravador'));
  const save = async () => {
    const body = { ...f, excellence: f.excellence ? 1 : 0, photo: f.photo instanceof File ? f.photo : undefined, unit_id: f.unit_id || '' };
    await run(() => (member ? api.put('/club/members/' + member.id, toForm(body)) : api.post('/club/members', toForm(body))), member ? 'Membro atualizado!' : 'Membro cadastrado!');
    onDone();
  };
  return (
    <Modal title={member ? 'Editar membro' : 'Novo membro'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button busy={busy} onClick={save}>Salvar</Button></>}>
      <div className="form">
        <ImagePicker value={f.photo} onChange={(photo) => setF({ ...f, photo })} name={f.name} />
        <Field label="Nome completo"><input value={f.name} onChange={set('name')} /></Field>
        <Field label="Data de nascimento" hint={kind === 'invalido' ? 'O membro precisa ter pelo menos 10 anos.' : kind ? `${age} anos · conta de ${KIND_LABEL[kind]}` : 'A idade define o tipo de conta: 10 a 15 anos Desbravador, 16+ Liderança.'}>
          <input type="date" value={f.birth_date} onChange={set('birth_date')} />
        </Field>
        <div className="grid2">
          <Field label="Cargo">
            <select value={f.cargo} onChange={set('cargo')} disabled={!cargos.length}>
              <option value="">Padrão</option>
              {cargos.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Unidade" hint={kind === 'lideranca' ? 'Sem escolha: entra na unidade Liderança' : 'Sem escolha: aparece como "Sem unidade"'}>
            <select value={f.unit_id} onChange={set('unit_id')}>
              <option value="">{kind === 'lideranca' ? 'Liderança (automático)' : 'Sem unidade'}</option>
              {availableUnits.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
        </div>
        <label className="check"><input type="checkbox" checked={f.excellence} onChange={(e) => setF({ ...f, excellence: e.target.checked })} /> <Sparkles size={16} color="#B07D00" /> Tem a Insígnia de Excelência</label>
        <div className="grid2">
          <Field label="Usuário de acesso"><input value={f.username} onChange={set('username')} autoCapitalize="none" /></Field>
          <Field label={member ? 'Nova senha' : 'Senha'} hint={member ? 'Deixe em branco para manter' : 'Mínimo 6 caracteres'}><input type="text" value={f.password} onChange={set('password')} /></Field>
        </div>
        <p className="muted small">Não pedimos CPF. Guardamos só nome, data de nascimento, foto, cargo e unidade.</p>
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
  const [excellence, setExcellence] = useState(null);
  const exc = excellence ?? !!detail.data?.excellence;
  const save = async () => {
    await run(async () => {
      await api.put(`/club/members/${member.id}/achievements`, { content_ids: [...chosen] });
      if (excellence !== null) await api.put(`/club/members/${member.id}`, { excellence: excellence ? 1 : 0 });
    }, 'Salvo! Já aparece no perfil.');
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
    <Modal title={`Classes e especialidades · ${member.name.split(' ')[0]}`} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button busy={busy} onClick={save}>Salvar ({chosen.size})</Button></>}>
      <label className="check exc-check"><input type="checkbox" checked={exc} onChange={(e) => setExcellence(e.target.checked)} /> <Sparkles size={16} color="#B07D00" /> Tem a Insígnia de Excelência</label>
      <Tabs tabs={[['especialidade', 'Especialidades'], ['classe', 'Classes']]} value={type} onChange={setType} />
      <Loading data={cat.data && detail.data} loading={cat.loading || detail.loading} error={cat.error || detail.error}>
        {() => (
          <>
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

/** Aprovações: classes e especialidades que os membros informaram ter. */
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
      <PageHeader title="Aprovações" subtitle="Classes e especialidades que os membros dizem ter"
        action={<Button small onClick={() => setPicking(true)}><Plus size={15} /> Adicionar</Button>} />
      {picking && (
        <Modal title="Adicionar para qual membro?" onClose={() => setPicking(false)}>
          <p className="muted small" style={{ marginBottom: '.6rem' }}>Registre especialidades, classes e a Insígnia de Excelência mesmo que o membro não tenha pedido.</p>
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
                <div className="grow"><b>{g.name}</b><div className="small muted">{g.unit_name || 'Sem unidade'}{g.handle ? ' · @' + g.handle : ''}</div></div>
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
  const [q, setQ] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [ach, setAch] = useState(null);
  const [, run] = useAsync();
  const done = () => { setEditing(null); setAch(null); members.reload(); units.reload(); };
  return (
    <>
      <PageHeader title="Membros" subtitle="Cadastre e atualize os membros do clube" action={<Button small onClick={() => setEditing('new')}>+ Novo</Button>} />
      <div className="grid2">
        <input placeholder="Buscar por nome" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)}>
          <option value="">Todas as unidades</option>
          <option value="none">Sem unidade</option>
          {(units.data || []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>
      <div className="mt">
        <Loading {...members} empty="Nenhum membro cadastrado ainda.">
          {(list) => {
            const shown = list.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()) && (!unitFilter || (unitFilter === 'none' ? !m.unit_id : String(m.unit_id) === unitFilter)));
            return (
              <div className="list">
                {shown.map((m) => (
                  <div key={m.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                    <Avatar src={m.photo} name={m.name} size={48} />
                    <div className="grow">
                      <div className="title ico">{m.name} {m.excellence ? <Sparkles size={15} color="#B07D00" aria-label="Insígnia de Excelência" /> : null}</div>
                      <div className="sub">{m.age} anos · {m.cargo} · {m.unit_name || 'Sem unidade'}</div>
                      <div className="row wrap" style={{ marginTop: '.35rem', gap: '.3rem' }}>
                        <Badge kind={m.kind === 'desbravador' ? 'blue' : 'yellow'}>{KIND_LABEL[m.kind]}</Badge>
                        {m.handle ? <Badge kind="blue">@{m.handle}</Badge> : <Badge>sem @ ainda</Badge>}
                        <Badge>login: {m.username}</Badge>
                      </div>
                      <div className="row wrap" style={{ marginTop: '.5rem', gap: '.35rem' }}>
                        <Button small variant="secondary" onClick={() => setEditing(m)}>Editar</Button>
                        <Button small variant="secondary" onClick={() => setAch(m)}>Classes/Especialidades</Button>
                        <Link to={`${base}/ver/membro/${m.code}`}><Button small variant="ghost">Perfil</Button></Link>
                        <Confirm text={`Remover ${m.name} do clube?`} onYes={() => run(() => api.del('/club/members/' + m.id), 'Membro removido').then(done)}>Remover</Confirm>
                      </div>
                    </div>
                  </div>
                ))}
                {!shown.length && <Empty>Ninguém encontrado.</Empty>}
              </div>
            );
          }}
        </Loading>
      </div>
      {editing && <MemberForm member={editing === 'new' ? null : editing} units={units.data || []} onClose={() => setEditing(null)} onDone={done} />}
      {ach && <AchievementsModal member={ach} onClose={() => setAch(null)} onDone={done} />}
    </>
  );
}

// ---------- Unidades ----------
function UnitForm({ unit, onClose, onDone }) {
  const [f, setF] = useState({ name: unit?.name || '', username: unit?.username || '', password: '', logo: unit?.logo || null });
  const [busy, run] = useAsync();
  const save = async () => {
    const body = { ...f, logo: f.logo instanceof File ? f.logo : undefined };
    await run(() => (unit ? api.put('/club/units/' + unit.id, toForm(body)) : api.post('/club/units', toForm(body))), 'Unidade salva!');
    onDone();
  };
  return (
    <Modal title={unit ? 'Editar unidade' : 'Nova unidade'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button busy={busy} onClick={save}>Salvar</Button></>}>
      <div className="form">
        <ImagePicker label="Logo da unidade" value={f.logo} onChange={(logo) => setF({ ...f, logo })} round={false} name={f.name} />
        <Field label="Nome"><input value={f.name} disabled={unit?.is_leadership} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="grid2">
          <Field label="Login da unidade"><input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoCapitalize="none" /></Field>
          <Field label={unit ? 'Nova senha' : 'Senha'} hint={unit ? 'Em branco mantém' : 'Mínimo 6 caracteres'}><input value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        </div>
        <p className="muted small">A unidade entra pelo “Login Clube” com este usuário e senha para cumprir requisitos em grupo.</p>
      </div>
    </Modal>
  );
}

function UnitsPage() {
  const state = useLoad(() => api.get('/club/units'));
  const [editing, setEditing] = useState(null);
  const [, run] = useAsync();
  const done = () => { setEditing(null); state.reload(); };
  return (
    <>
      <PageHeader title="Unidades" subtitle="Cada membro pertence a uma única unidade" action={<Button small onClick={() => setEditing('new')}>+ Nova</Button>} />
      <Loading {...state}>
        {(list) => (
          <div className="list">
            {list.map((u) => (
              <div key={u.id} className="list-item">
                <Avatar src={u.logo} name={u.name} size={52} square />
                <div className="grow">
                  <div className="title">{u.name} {u.is_leadership ? <Badge kind="yellow">automática</Badge> : null}</div>
                  <div className="sub">{plural(u.member_count, 'membro', 'membros')}{u.username ? ` · login @${u.username}` : ' · sem login'}</div>
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

function RequirementsPage() {
  const initial = new URLSearchParams(location.search).get('aba') || 'cumprir';
  const [tab, setTab] = useState(initial);
  return (
    <>
      <PageHeader title="Requisitos" />
      <Tabs tabs={[['cumprir', 'Requisitos do App'], ['criados', 'Criados pelo clube'], ['avaliar', 'Avaliar']]} value={tab} onChange={setTab} />
      {tab === 'cumprir' && <><p className="muted small">Requisitos que o App do DBV manda para o seu clube cumprir.</p><RequirementsTodo /></>}
      {tab === 'criados' && <><p className="muted small">Crie requisitos com prazo e pontos para as unidades ou para os desbravadores do seu clube. Eles contam no ranking do clube.</p><CreatedRequirements /></>}
      {tab === 'avaliar' && <ReviewsPanel />}
    </>
  );
}

/** Sistema do Clube. */
export default function ClubApp() {
  const { unread } = useRealtime();
  const tabs = [
    { to: base, icon: Tent, label: 'Início', end: true },
    { to: `${base}/membros`, icon: Users, label: 'Membros' },
    { to: `${base}/requisitos`, icon: ClipboardCheck, label: 'Requisitos' },
    { to: `${base}/chat`, icon: MessageCircle, label: 'Chat', badge: unread },
    { to: `${base}/mais`, icon: Menu, label: 'Mais' },
  ];
  const more = [
    { to: `${base}/aprovacoes`, icon: BadgeCheck, label: 'Aprovações', hint: 'Classes e especialidades' },
    { to: `${base}/unidades`, icon: Flag, label: 'Unidades', hint: 'Criar e editar' },
    { to: `${base}/eventos`, icon: CalendarDays, label: 'Eventos', hint: 'Do seu clube' },
    { to: `${base}/anuncios`, icon: Megaphone, label: 'Anúncios', hint: 'Para os seus membros' },
    { to: `${base}/ranking`, icon: Trophy, label: 'Ranking', hint: 'Unidades e clubes' },
    { to: `${base}/denuncias`, icon: ShieldAlert, label: 'Denúncias', hint: 'Do chat' },
    { to: `${base}/clubes`, icon: Map, label: 'Clubes', hint: 'Por distrito' },
  ];
  return (
    <Routes>
      <Route path="chat/:id" element={<ChatConversation base={base} />} />
      <Route
        path="*"
        element={
          <Shell tabs={tabs}>
            <Routes>
              <Route index element={<ClubHome />} />
              <Route path="membros" element={<MembersPage />} />
              <Route path="unidades" element={<UnitsPage />} />
              <Route path="aprovacoes" element={<ApprovalsPage />} />
              <Route path="eventos" element={<EventsAdmin />} />
              <Route path="anuncios" element={<AnnouncementsAdmin />} />
              <Route path="requisitos" element={<RequirementsPage />} />
              <Route path="ranking" element={<RankingHub base={base} />} />
              <Route path="chat" element={<ChatHome base={base} />} />
              <Route path="denuncias" element={<ReportsPanel />} />
              <Route path="clubes" element={<ClubsBrowser base={base} />} />
              <Route path="ver/:kind/:id" element={<InAppProfile base={base} />} />
              <Route path="mais" element={<><PageHeader title="Mais" /><MoreMenu items={more} /></>} />
              <Route path="*" element={<Navigate to={base} replace />} />
            </Routes>
          </Shell>
        }
      />
    </Routes>
  );
}
