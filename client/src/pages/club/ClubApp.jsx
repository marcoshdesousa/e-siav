import { useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowLeftRight, Award, BadgeCheck, Copy, FileText, Hash, KeyRound, Link2, RotateCcw, Share2, UserPlus, CalendarDays, Check, Megaphone, Plus, ChevronRight, ClipboardCheck, Compass, Flag, Inbox, Map, MapPin, Menu, MessageCircle, ShieldAlert, Tent, Trophy, Users,
} from 'lucide-react';
import { api, toForm } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { useRealtime } from '../../realtime.jsx';
import { KIND_LABEL, fmtCpf, fmtDate, plural } from '../../format.js';
import FichaForm, { DocFields, SaudeLista } from '../Ficha.jsx';
import { CadastroFlow } from '../Signup.jsx';
import TransfersPage from './Transfers.jsx';
import {
  Avatar, Badge, Button, Card, Confirm, Empty, Field, ImagePicker, Loading, MedalList, Modal, PageHeader, PositionBadge, Section, ShareButton, Stat, Tabs, notify, useAsync, useLoad,
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
            {c.photo && <div className="hero-cover" style={{ backgroundImage: `url(${c.photo})` }} />}
            <div className="profile-head">
              <Avatar src={c.logo} name={c.name} size={88} square />
              <h1>{c.name}</h1>
              <div className="chips"><span className="chip ico"><MapPin size={14} /> {c.district_name}</span><span className="chip ico"><KeyRound size={14} /> Código do clã: <b>{c.code}</b></span></div>
              {c.director_name && <p className="small" style={{ margin: '.2rem 0 .4rem' }}>Diretor(a): <b>{c.director_name}</b></p>}
              {c.ranking && <PositionBadge position={c.ranking.position} points={c.ranking.points} label="no ranking de clãs" />}
              <div className="row wrap" style={{ justifyContent: 'center', marginTop: '.5rem' }}>
                <ShareButton path={`/p/clube/${c.id}`} title={c.name} />
                <Link to={`${base}/ver/clube/${c.id}`}><Button variant="yellow" small>Ver perfil público</Button></Link>
              </div>
            </div>
          </div>

          <Section title="Resumo">
            <div className="stats">
              <Stat icon={Compass} value={c.desbravadores} label="Exploradores" to={`${base}/membros`} />
              <Stat icon={Award} value={c.lideranca} label="Tutores" to={`${base}/membros`} />
              <Stat icon={Flag} value={c.unit_count} label="Grupos" to={`${base}/unidades`} />
              <Stat icon={BadgeCheck} value={c.pending_achievements} label="Cadernos e insígnias p/ aprovar" to={`${base}/aprovacoes`} accent={c.pending_achievements > 0} />
              <Stat icon={Inbox} value={c.pending_reviews} label="Envios p/ avaliar" to={`${base}/requisitos?aba=avaliar`} accent={c.pending_reviews > 0} />
              <Stat icon={Flag} value={c.open_reports} label="Denúncias abertas" to={`${base}/denuncias`} accent={c.open_reports > 0} />
              <Stat icon={UserPlus} value={c.signup_pending} label="Inscrições p/ aprovar" to={`${base}/membros?aba=pendente`} accent={c.signup_pending > 0} />
              <Stat icon={ArrowLeftRight} value={c.transfers_pending} label="Transferências" to={`${base}/transferencias`} accent={c.transfers_pending > 0} />
            </div>
          </Section>

          <SignupLink code={c.code} id={c.id} />
          <ClubInfoForm club={c} onDone={() => { state.reload(); refresh(); }} />

          <Section title="Foto e logo do clã">
            <Card>
              <div className="stack">
                <ImagePicker label="Logo do clã" value={c.logo} onChange={upload('logo')} round={false} name={c.name} />
                <ImagePicker label="Foto de capa do clã" value={c.photo} onChange={upload('photo')} round={false} />
              </div>
            </Card>
          </Section>

          <Section title="Ranking dos grupos" action={<Link to={`${base}/ranking`} className="small ico">Ver tudo <ChevronRight size={14} /></Link>}>
            <RankingTable rows={c.units_ranking} link={(r) => `${base}/ver/unidade/${r.id}`} />
          </Section>
          <MedalList medals={c.medals} />
          <EventsList events={c.events} />
        </>
      )}
    </Loading>
  );
}

function LinkBox({ title, text, url }) {
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); notify('Link copiado!'); } catch { notify('Não deu para copiar. Selecione o link e copie.', 'error'); }
  };
  const share = () => navigator.share?.({ title, url }).catch(() => {});
  return (
    <Card>
      <b>{title}</b>
      <p className="small muted" style={{ margin: '.2rem 0 .5rem' }}>{text}</p>
      <div className="signup-link"><Link2 size={16} /> <span className="ellipsis">{url}</span></div>
      <div className="row wrap mt">
        <Button small onClick={copy}><Copy size={14} /> Copiar</Button>
        {navigator.share && <Button small variant="secondary" onClick={share}><Share2 size={14} /> Compartilhar</Button>}
      </div>
    </Card>
  );
}

/** Cada clã tem dois links: o do perfil do clã e o de cadastro (inscrição). */
function SignupLink({ code, id }) {
  return (
    <Section title="Links do clã">
      <LinkBox title="Link do clã" text="Perfil público do clã: história, grupos, medalhas e ranking." url={`${location.origin}/p/clube/${id}`} />
      <LinkBox title="Link de cadastro" text="Para quem quer entrar no clã: ficha de cadastro, ficha de saúde e termos. Você aprova em Membros → Inscrições." url={`${location.origin}/inscricao/${code}`} />
    </Section>
  );
}

/** Nome do diretor (troca a cada ano, se mudar) e a história do clã. */
function ClubInfoForm({ club, onDone }) {
  const [f, setF] = useState({ director_name: club.director_name || '', history: club.history || '' });
  const [busy, run] = useAsync();
  const save = async () => {
    await run(() => api.put('/club/profile', toForm(f)), 'Salvo!');
    onDone();
  };
  const changed = f.director_name !== (club.director_name || '') || f.history !== (club.history || '');
  return (
    <Section title="Diretor e história do clã">
      <Card>
        <div className="form">
          <Field label="Diretor(a) do clã" hint="O responsável pelo clã. Troque quando mudar a diretoria."><input value={f.director_name} onChange={(e) => setF({ ...f, director_name: e.target.value })} /></Field>
          <Field label="Nossa história" hint="Aparece no perfil público do clã."><textarea value={f.history} onChange={(e) => setF({ ...f, history: e.target.value })} placeholder="Como o clã começou, conquistas, acampamentos marcantes..." style={{ minHeight: 120 }} /></Field>
          <div className="row" style={{ justifyContent: 'flex-end' }}><Button busy={busy} disabled={!changed} onClick={save}>Salvar</Button></div>
        </div>
      </Card>
    </Section>
  );
}

/** Cargos separados em Liderança e Tutores (16+); explorador tem um cargo só. */
function CargoOptions({ kind }) {
  const { meta } = useAuth();
  if (kind !== 'lideranca') return (meta.cargos[kind] || []).map((c) => <option key={c}>{c}</option>);
  const lid = meta.cargos_lideranca || [];
  return (
    <>
      <optgroup label="Liderança">{lid.map((c) => <option key={c}>{c}</option>)}</optgroup>
      <optgroup label="Tutores">{meta.cargos.lideranca.filter((c) => !lid.includes(c)).map((c) => <option key={c}>{c}</option>)}</optgroup>
    </>
  );
}


// ---------- Membros ----------
function MemberForm({ member, units, onClose, onDone }) {
  const { meta } = useAuth();
  const [f, setF] = useState({
    name: member?.name || '', birth_date: member?.birth_date || '', cargo: member?.cargo || '', unit_id: member?.unit_id || '',
    cpf: fmtCpf(member?.cpf), certidao: member?.birth_cert || '', doc_tipo: !member?.cpf && member?.birth_cert ? 'certidao' : 'rg_cpf', password: '', photo: member?.photo || null,
  });
  const [busy, run] = useAsync();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const age = f.birth_date ? Math.floor((Date.now() - Date.parse(f.birth_date + 'T12:00:00')) / 31557600000) : null;
  const kind = age == null ? null : age < 10 ? 'invalido' : age <= 15 ? 'desbravador' : 'lideranca';
  const cargos = kind && kind !== 'invalido' ? meta.cargos[kind] : [];
  const availableUnits = units.filter((u) => !(u.is_leadership && kind === 'desbravador'));
  const save = async () => {
    const body = { ...f, photo: f.photo instanceof File ? f.photo : undefined, unit_id: f.unit_id || '', certidao: f.doc_tipo === 'certidao' ? f.certidao : '', cpf: f.doc_tipo === 'certidao' ? '' : f.cpf };
    delete body.doc_tipo;
    const r = await run(() => (member ? api.put('/club/members/' + member.id, toForm(body)) : api.post('/club/members', toForm(body))), member ? 'Membro atualizado!' : null);
    onDone(member ? null : r.code);
  };
  return (
    <Modal title={member ? 'Editar membro' : 'Novo membro'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button busy={busy} onClick={save}>Salvar</Button></>}>
      <div className="form">
        <ImagePicker value={f.photo} onChange={(photo) => setF({ ...f, photo })} name={f.name} />
        <Field label="Nome completo"><input value={f.name} onChange={set('name')} /></Field>
        <Field label="Data de nascimento" hint={kind === 'invalido' ? 'O membro precisa ter pelo menos 10 anos.' : kind ? `${age} anos · conta de ${KIND_LABEL[kind]}` : 'A idade define o tipo de conta: 10 a 15 anos Explorador, 16+ Tutor.'}>
          <input type="date" value={f.birth_date} onChange={set('birth_date')} />
        </Field>
        <div className="grid2">
          <Field label="Cargo">
            <select value={f.cargo} onChange={set('cargo')} disabled={!cargos.length}>
              <option value="">Padrão</option>
              <CargoOptions kind={kind} />
            </select>
          </Field>
          <Field label="Grupo" hint={kind === 'lideranca' ? 'Sem escolha: entra no grupo Tutores' : 'Sem escolha: aparece como "Sem grupo"'}>
            <select value={f.unit_id} onChange={set('unit_id')}>
              <option value="">{kind === 'lideranca' ? 'Tutores (automático)' : 'Sem grupo'}</option>
              {availableUnits.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
        </div>
        <DocFields value={f} onChange={setF} cpf={f.cpf} onCpf={(cpf) => setF({ ...f, cpf })} />
        <Field label={member ? 'Nova senha' : 'Senha'} hint={member ? 'Deixe em branco para manter' : 'Mínimo 6 caracteres'}><input type="text" value={f.password} onChange={set('password')} /></Field>
        <p className="muted small">{member ? <>Código de acesso: <b>{member.code}</b>. O membro entra com o código e a senha.</> : 'O app gera um código de 6 números para o membro entrar, junto com a senha.'}</p>
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
    const r = await run(() => api.post('/club/catalog', { name: newName }), 'Insígnia adicionada ao catálogo');
    setNewName('');
    setAdding(false);
    await catalogs.especialidade.reload();
    setSel(new Set([...chosen, r.id]));
  };
  const cat = catalogs[type];
  return (
    <Modal title={`Cadernos guia e insígnias · ${member.name.split(' ')[0]}`} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button busy={busy} onClick={save}>Salvar ({chosen.size})</Button></>}>
      <Tabs tabs={[['especialidade', 'Insígnias'], ['classe', 'Cadernos guia']]} value={type} onChange={setType} />
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

/** Aprovações: cadernos guia e insígnias que os membros informaram ter. */
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
      <PageHeader title="Aprovações" subtitle="Cadernos guia e insígnias que os membros dizem ter"
        action={<Button small onClick={() => setPicking(true)}><Plus size={15} /> Adicionar</Button>} />
      {picking && (
        <Modal title="Adicionar para qual membro?" onClose={() => setPicking(false)}>
          <p className="muted small" style={{ marginBottom: '.6rem' }}>Registre insígnias e cadernos guia mesmo que o membro não tenha pedido.</p>
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
                    <span className="grow"><b>{i.name}</b><small>{i.type === 'classe' ? 'Caderno guia' : i.category}</small></span>
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

/** Ficha de cadastro, ficha médica e termos do membro (o clã pode corrigir). */
function FichaModal({ member, onClose }) {
  const state = useLoad(() => api.get(`/club/members/${member.id}/ficha`));
  const [f, setF] = useState(null);
  const [busy, run] = useAsync();
  const save = async () => {
    await run(() => api.put(`/club/members/${member.id}/ficha`, f), 'Ficha salva!');
    onClose();
  };
  return (
    <Modal title={`Ficha · ${member.name}`} onClose={onClose} footer={f && <Button busy={busy} onClick={save}>Salvar ficha</Button>}>
      <Loading {...state}>
        {(d) => (
          <>
            <p className="small muted" style={{ marginTop: 0 }}>
              Código <b>{d.member.code}</b> · {d.member.cpf ? <>CPF {fmtCpf(d.member.cpf)}</> : d.member.birth_cert ? <>Certidão {d.member.birth_cert}</> : 'sem documento'}
            </p>
            {d.ficha.termo_imagem === false && <Badge kind="red">Sem autorização de uso de imagem</Badge>}
            {member.incomplete && <Badge kind="yellow">Dados incompletos: complete a ficha</Badge>}
            <FichaForm value={f || d.ficha} onChange={setF} age={member.age} />
            <SaudeLista value={f || d.ficha} onChange={setF} />
            {d.ficha.terms_accepted_at && (
              <Card className="small mt">
                <b>Ficha assinada</b> em {fmtDate(d.ficha.terms_accepted_at)}{d.ficha.local_inscricao ? ` · ${d.ficha.local_inscricao}` : ''}<br />
                Cadastro: <b>{d.ficha.assinatura_nome || '—'}</b>{d.ficha.assinatura_cpf ? ` · CPF ${fmtCpf(d.ficha.assinatura_cpf)}` : ''}<br />
                Saúde: <b>{d.ficha.med_assinatura_nome || '—'}</b>{d.ficha.med_assinatura_cpf ? ` · CPF ${fmtCpf(d.ficha.med_assinatura_cpf)}` : ''}
              </Card>
            )}
          </>
        )}
      </Loading>
    </Modal>
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
              <CargoOptions kind={member.kind} />
            </select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}

const MEMBER_TABS = [['ativo', 'Ativos'], ['pendente', 'Inscrições'], ['inativo', 'Desativados']];

function MembersPage() {
  const members = useLoad(() => api.get('/club/members'));
  const units = useLoad(() => api.get('/club/units'));
  const [tab, setTab] = useState(new URLSearchParams(location.search).get('aba') || 'ativo');
  const [q, setQ] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [ach, setAch] = useState(null);
  const [ficha, setFicha] = useState(null);
  const [approving, setApproving] = useState(null);
  const [newCode, setNewCode] = useState(null);
  const [, run] = useAsync();
  const done = (code) => { setEditing(null); setAch(null); setApproving(null); members.reload(); units.reload(); if (code) setNewCode(code); };
  const counts = Object.fromEntries(MEMBER_TABS.map(([k]) => [k, (members.data || []).filter((m) => m.status === k).length]));
  return (
    <>
      <PageHeader title="Membros" subtitle="Ninguém é apagado: quem sai do clã fica desativado" action={<Link to={`${base}/membros/novo`}><Button small>+ Novo</Button></Link>} />
      <Tabs tabs={MEMBER_TABS.map(([k, l]) => [k, counts[k] ? `${l} (${counts[k]})` : l])} value={tab} onChange={setTab} />
      <div className="grid2">
        <input placeholder="Buscar por nome ou código" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)}>
          <option value="">Todos os grupos</option>
          <option value="none">Sem grupo</option>
          {(units.data || []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>
      <div className="mt">
        <Loading {...members}>
          {(list) => {
            const nq = q.toLowerCase();
            const shown = list.filter((m) => m.status === tab && (m.name.toLowerCase().includes(nq) || m.code.includes(q.trim()))
              && (!unitFilter || (unitFilter === 'none' ? !m.unit_id : String(m.unit_id) === unitFilter)));
            return (
              <div className="list">
                {shown.map((m) => (
                  <div key={m.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                    <Avatar src={m.photo} name={m.name} size={48} />
                    <div className="grow">
                      <div className="title ico">{m.name}</div>
                      <div className="sub">{m.age} anos · {m.cargo} · {m.unit_name || 'Sem grupo'}</div>
                      <div className="row wrap" style={{ marginTop: '.35rem', gap: '.3rem' }}>
                        <Badge kind={m.kind === 'desbravador' ? 'blue' : 'yellow'}>{m.role}</Badge>
                        <Badge><Hash size={11} /> {m.code}</Badge>
                        {m.status === 'pendente' && <Badge kind="yellow">Inscrito em {fmtDate(m.created_at)}</Badge>}
                        {m.incomplete && <Badge kind="red">Dados incompletos</Badge>}
                      </div>
                      <div className="row wrap" style={{ marginTop: '.5rem', gap: '.35rem' }}>
                        {m.status === 'pendente' ? (
                          <>
                            <Button small variant="green" onClick={() => setApproving(m)}><Check size={14} /> Aprovar</Button>
                            <Button small variant="secondary" onClick={() => setFicha(m)}><FileText size={14} /> Ver ficha</Button>
                            <Confirm text={`Recusar a inscrição de ${m.name}?`} onYes={() => run(() => api.post(`/club/members/${m.id}/recusar`), 'Inscrição recusada').then(() => done())}>Recusar</Confirm>
                          </>
                        ) : m.status === 'inativo' ? (
                          <>
                            <Button small variant="green" onClick={() => run(() => api.post(`/club/members/${m.id}/reativar`), 'Membro reativado!').then(() => done())}><RotateCcw size={14} /> Reativar</Button>
                            <Button small variant="secondary" onClick={() => setFicha(m)}><FileText size={14} /> Ficha</Button>
                          </>
                        ) : (
                          <>
                            <Button small variant="secondary" onClick={() => setEditing(m)}>Editar</Button>
                            <Button small variant="secondary" onClick={() => setFicha(m)}><FileText size={14} /> Ficha</Button>
                            <Button small variant="secondary" onClick={() => setAch(m)}>Cadernos e insígnias</Button>
                            <Link to={`${base}/ver/membro/${m.code}`}><Button small variant="ghost">Perfil</Button></Link>
                            <Confirm text={`Desativar ${m.name}? A pessoa sai das listas e do ranking, mas continua no sistema e pode ser reativada.`}
                              onYes={() => run(() => api.post(`/club/members/${m.id}/desativar`), 'Membro desativado').then(() => done())}>Desativar</Confirm>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {!shown.length && <Empty>{tab === 'pendente' ? 'Nenhuma inscrição esperando. Compartilhe o link de inscrição na página inicial.' : tab === 'inativo' ? 'Ninguém desativado.' : 'Ninguém encontrado.'}</Empty>}
              </div>
            );
          }}
        </Loading>
      </div>
      {editing && <MemberForm member={editing === 'new' ? null : editing} units={units.data || []} onClose={() => setEditing(null)} onDone={done} />}
      {ach && <AchievementsModal member={ach} onClose={() => setAch(null)} onDone={() => done()} />}
      {ficha && <FichaModal member={ficha} onClose={() => setFicha(null)} />}
      {approving && <ApproveModal member={approving} units={units.data || []} onClose={() => setApproving(null)} onDone={() => done()} />}
      {newCode && (
        <Modal title="Membro cadastrado!" onClose={() => setNewCode(null)} footer={<Button onClick={() => setNewCode(null)}>Entendi</Button>}>
          <p className="center">Passe este código para o membro. Ele entra com o código e a senha que você criou.</p>
          <div className="code-big">{newCode}</div>
        </Modal>
      )}
    </>
  );
}

/** Cadastro feito pelo clã: precisa de todos os dados, igual à inscrição pelo link. */
function NewMemberPage() {
  const { actor } = useAuth();
  const nav = useNavigate();
  const [code, setCode] = useState(null);
  const [busy, run] = useAsync();
  const send = async (body) => {
    const r = await run(() => api.post('/club/members', body), null);
    setCode(r.code);
  };
  return (
    <>
      <button type="button" className="back-link" onClick={() => nav(`${base}/membros`)}><ArrowLeft size={16} /> Membros</button>
      <PageHeader title="Novo membro" subtitle="Preencha todos os dados. O grupo e o cargo você escolhe depois, em Editar." />
      <CadastroFlow mode="cla" local={`${actor.name} — cadastro pelo clã`} submitLabel="Cadastrar membro" busy={busy} onSubmit={send} />
      {code && (
        <Modal title="Membro cadastrado!" onClose={() => nav(`${base}/membros`)} footer={<Button onClick={() => nav(`${base}/membros`)}>Entendi</Button>}>
          <p className="center">Passe este código para o membro. Ele entra com o código e a senha que você criou.</p>
          <div className="code-big">{code}</div>
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

function UnitsPage() {
  const { actor } = useAuth();
  const state = useLoad(() => api.get('/club/units'));
  const [editing, setEditing] = useState(null);
  const [, run] = useAsync();
  const done = () => { setEditing(null); state.reload(); };
  return (
    <>
      <PageHeader title="Grupos" subtitle="Cada membro pertence a um único grupo" action={<Button small onClick={() => setEditing('new')}>+ Novo</Button>} />
      <Card className="small">Para entrar no Portal do Grupo: tela <b>Clã</b>, código do clã <b>{actor.code}</b> e a senha do grupo abaixo. As senhas são criadas pelo app e <b>não podem ser trocadas</b>: guarde bem.</Card>
      <Loading {...state}>
        {(list) => (
          <div className="list mt">
            {list.map((u) => (
              <div key={u.id} className="list-item">
                <Avatar src={u.logo} name={u.name} size={52} square />
                <div className="grow">
                  <div className="title">{u.name} {u.is_leadership ? <Badge kind="yellow">automático</Badge> : null}</div>
                  <div className="sub">{plural(u.member_count, 'membro', 'membros')} · senha <span className="pin-box"><KeyRound size={13} />{u.pin}</span></div>
                  <div className="row wrap" style={{ marginTop: '.4rem', gap: '.35rem' }}>
                    <Button small variant="secondary" onClick={() => setEditing(u)}>Editar</Button>
                    <Link to={`${base}/ver/unidade/${u.id}`}><Button small variant="ghost">Perfil</Button></Link>
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

function RequirementsPage() {
  const initial = new URLSearchParams(location.search).get('aba') || 'cumprir';
  const [tab, setTab] = useState(initial);
  return (
    <>
      <PageHeader title="Requisitos" />
      <Tabs tabs={[['cumprir', 'Requisitos do App'], ['criados', 'Criados pelo clã'], ['avaliar', 'Avaliar']]} value={tab} onChange={setTab} />
      {tab === 'cumprir' && <><p className="muted small">Requisitos que a administração do app manda para o seu clã cumprir.</p><RequirementsTodo /></>}
      {tab === 'criados' && <><p className="muted small">Crie requisitos com prazo e pontos para os grupos ou para os membros do seu clã (exploradores, tutores ou todos). Eles contam no ranking do clã.</p><CreatedRequirements /></>}
      {tab === 'avaliar' && <ReviewsPanel />}
    </>
  );
}

/** Sistema do Clã. */
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
    { to: `${base}/aprovacoes`, icon: BadgeCheck, label: 'Aprovações', hint: 'Cadernos guia e insígnias' },
    { to: `${base}/unidades`, icon: Flag, label: 'Grupos', hint: 'Criar e ver as senhas' },
    { to: `${base}/transferencias`, icon: ArrowLeftRight, label: 'Transferências', hint: 'Trazer alguém de outro clã' },
    { to: `${base}/eventos`, icon: CalendarDays, label: 'Eventos', hint: 'Do seu clã' },
    { to: `${base}/anuncios`, icon: Megaphone, label: 'Anúncios', hint: 'Para os seus membros' },
    { to: `${base}/ranking`, icon: Trophy, label: 'Ranking', hint: 'Grupos e clãs' },
    { to: `${base}/denuncias`, icon: ShieldAlert, label: 'Denúncias', hint: 'Do chat' },
    { to: `${base}/clubes`, icon: Map, label: 'Clãs', hint: 'Por distrito' },
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
              <Route path="membros/novo" element={<NewMemberPage />} />
              <Route path="unidades" element={<UnitsPage />} />
              <Route path="aprovacoes" element={<ApprovalsPage />} />
              <Route path="transferencias" element={<TransfersPage />} />
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
