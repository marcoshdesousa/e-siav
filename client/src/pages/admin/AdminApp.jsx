import { useState } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import {
  BookOpenCheck, CalendarDays, ClipboardCheck, Flag, House, Inbox, Library, Map, Megaphone, Menu, Send, Tent, Trophy, Users, Globe, MessageCircle, BookImage, Wallet, Flame, BadgeCheck,
} from 'lucide-react';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { plural } from '../../format.js';
import { Avatar, Button, Card, Field, Loading, Modal, PageHeader, Section, Stat, Tabs, useAsync, useLoad } from '../../ui.jsx';
import Shell, { MoreMenu } from '../Shell.jsx';
import { InAppProfile } from '../Profiles.jsx';
import { CreatedRequirements, ReviewsPanel } from '../Requirements.jsx';
import RankingHub from '../Ranking.jsx';
import ClubsBrowser from '../Clubs.jsx';
import ContentAdmin from './ContentAdmin.jsx';
import ContentReview from './ContentReview.jsx';
import Deliver from './Deliver.jsx';
import EventsAdmin from './Events.jsx';
import AnnouncementsAdmin from './Announcements.jsx';
import CatalogAdmin from './CatalogAdmin.jsx';
import ClanView from './ClanView.jsx';
import AgendaAdmin from './AgendaAdmin.jsx';
import SupportAdmin, { LinksAdmin } from './SupportAdmin.jsx';
import StickersAdmin from './StickersAdmin.jsx';
import LearningAdmin from './LearningAdmin.jsx';
import PaymentsAdmin from './PaymentsAdmin.jsx';
import StreaksAdmin from './StreaksAdmin.jsx';
import PlusAdmin from './PlusAdmin.jsx';
import { ApprovalsPage } from '../club/ClubApp.jsx';

const base = '/admin';

function AdminHome() {
  const { actor } = useAuth();
  const state = useLoad(() => api.get('/admin/overview'));
  return (
    <>
      <div className="hero">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p className="muted small">Painel do</p>
          <h1>{actor.district_id ? 'Administrador do Distrito' : 'Administrador Geral'}</h1>
          <p className="muted">Olá, {actor.name}! {actor.district_id ? <>Você cuida do distrito <b>{actor.district_name}</b>.</> : 'Você cuida de toda a plataforma.'}</p>
        </div>
      </div>
      <Loading {...state}>
        {(o) => (
          <Section title="Visão geral">
            <div className="stats">
              <Stat icon={Map} value={o.districts} label="Distritos" to={`${base}/clubes`} />
              <Stat icon={Tent} value={o.clubs} label="Clubes" to={`${base}/clubes`} />
              <Stat icon={Flag} value={o.units} label="Unidades" />
              <Stat icon={Users} value={o.members} label="Membros" />
              <Stat icon={ClipboardCheck} value={o.requirements} label="Requisitos gerais" to={`${base}/requisitos`} />
              <Stat icon={Inbox} value={o.pending_reviews} label="Envios p/ avaliar" to={`${base}/requisitos?aba=avaliar`} accent={o.pending_reviews > 0} />
            </div>
          </Section>
        )}
      </Loading>
      {actor.district_id ? (
        <Section title="Atalhos">
          <MoreMenu items={[
            { to: `${base}/clubes`, icon: Tent, label: 'Clubes do distrito', hint: 'Criar clubes e links de inscrição' },
            { to: `${base}/requisitos`, icon: ClipboardCheck, label: 'Requisitos do distrito', hint: 'Criar e avaliar' },
            { to: `${base}/sequencias`, icon: Flame, label: 'Sequências', hint: 'Porcentagem de cada clube' },
          ]} />
        </Section>
      ) : (
      <Section title="Atalhos">
        <MoreMenu items={[
          { to: `${base}/suporte`, icon: MessageCircle, label: 'Suporte', hint: 'Responder os clubes e membros' },
          { to: `${base}/pagamentos`, icon: Wallet, label: 'Pagamentos', hint: 'Pix (SyncPay) e confirmações' },
          { to: `${base}/figurinhas`, icon: BookImage, label: 'Figurinhas', hint: 'Álbuns completos e presentes' },
          { to: `${base}/aprendizagem`, icon: Flame, label: 'Aprendizagem Diária', hint: 'Arganel, medalhas e áudio' },
          { to: `${base}/links`, icon: Globe, label: 'Links dos sites', hint: 'SGC, Cantinho e Cartão DBV' },
    { to: `${base}/agenda`, icon: CalendarDays, label: 'Agenda', hint: 'Datas para todos, distrito ou clube' },
    { to: `${base}/entregar`, icon: Send, label: 'Entregar conteúdo' },
          { to: `${base}/catalogo`, icon: BookOpenCheck, label: 'Catálogo oficial' },
          { to: `${base}/eventos`, icon: CalendarDays, label: 'Eventos' },
          { to: `${base}/anuncios`, icon: Megaphone, label: 'Anúncios' },
        ]} />
      </Section>
      )}
      <p className="muted small mt center">Os dados pessoais dos membros são editados somente pelo clube de cada um.</p>
    </>
  );
}

// ---------- Distritos, clubes e administradores ----------
/**
 * Clube: o admin escreve só o nome, o distrito e o diretor. O app coloca "Clube" na
 * frente do nome, cria o código (4 números) e a senha (2 letras + 4 números).
 */
// Tira número antigo ("1º") e um "Clube"/"Club" digitado na frente: o app já coloca "Clube".
const baseName = (n) => String(n || '').replace(/^\s+/, '').replace(/^\d+\s*º\s*/, '').replace(/^(clube|club|cl[ãa])\s+/i, '');
function ClubForm({ item, nextNumber, districts, onClose, onCreated, onSaved }) {
  const [f, setF] = useState({ name: baseName(item?.name), district_id: item?.district_id || districts?.[0]?.id || '', director_name: item?.director_name || '', associate_directors: item?.associate_directors || '' });
  const [busy, run] = useAsync();
  const save = async () => {
    if (item) {
      await run(() => api.put('/admin/clubs/' + item.id, f), 'Clube atualizado!');
      onSaved();
    } else {
      const r = await run(() => api.post('/admin/clubs', f), null);
      onCreated(r);
    }
  };
  return (
    <Modal title={item ? `Editar ${item.name}` : 'Criar clube'} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button busy={busy} disabled={!f.name.trim() || !f.director_name.trim()} onClick={save}>Salvar</Button></>}>
      <div className="form">
        <Field label="Nome do clube" hint={f.name.trim() ? `Vai ficar: Clube ${f.name.trim()}` : 'Escreva só o nome: o “Clube” já vem na frente (ex.: Titãs → Clube Titãs).'}>
          <div className="prefix-input">
            <span aria-hidden="true">Clube</span>
            <input value={f.name} onChange={(e) => setF({ ...f, name: baseName(e.target.value) })} placeholder="Ex.: Titãs" aria-label="Nome do clube (sem a palavra Clube)" />
          </div>
        </Field>
        {districts.length > 1 && (
          <Field label="Distrito">
            <select value={f.district_id} onChange={(e) => setF({ ...f, district_id: e.target.value })}>
              {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Diretor(a) do clube" hint="Responsável pelo clube. Só o administrativo troca (todo ano)."><input value={f.director_name} onChange={(e) => setF({ ...f, director_name: e.target.value })} /></Field>
        <Field label="Diretores associados (opcional)" hint="Um nome por linha.">
          <textarea rows={3} value={f.associate_directors} onChange={(e) => setF({ ...f, associate_directors: e.target.value })} placeholder={'Ex.: Ana Souza\nJoão Lima'} />
        </Field>
        {!item && <p className="muted small">O app cria o código do clube e a senha (2 letras + 4 números). A senha não pode ser trocada. As unidades entram com o mesmo código e a senha de cada unidade.</p>}
      </div>
    </Modal>
  );
}

function NameLoginForm({ title, item, withDistrict, districts, appDistrict, onClose, onSave }) {
  const [f, setF] = useState({ name: item?.name || '', district_id: item?.district_id || districts?.[0]?.id || '', username: item?.username || '', password: '' });
  const [busy, run] = useAsync();
  return (
    <Modal title={title} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button busy={busy} onClick={() => run(() => onSave(f), 'Salvo!').then(onClose)}>Salvar</Button></>}>
      <div className="form">
        <Field label="Nome"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        {withDistrict && (
          <Field label="O que ele vai cuidar" hint={appDistrict && String(f.district_id) === String(appDistrict.id)
            ? 'Administrador do App: cuida de quem criou a conta pelo app (Clube App Brasil). Aprova especialidades e classes, faz anúncios e requisitos para eles.'
            : 'Ele cria clubes e requisitos desse distrito e só vê esse distrito.'}>
            <select value={f.district_id} onChange={(e) => setF({ ...f, district_id: e.target.value })}>
              {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              {appDistrict && <option value={appDistrict.id}>App Brasil (contas sem clube)</option>}
            </select>
          </Field>
        )}
        <div className="grid2">
          <Field label="Usuário"><input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoCapitalize="none" /></Field>
          <Field label={item ? 'Nova senha' : 'Senha'} hint={item ? 'Em branco mantém' : 'Mínimo 6 caracteres'}><input value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        </div>
      </div>
    </Modal>
  );
}

const PLAN_LABEL = { ok: 'em dia', gratis: 'grátis (jan/dez)', carencia: 'venceu (carência de 3 dias)', vencido: 'vencido' };

function ClubsAdmin() {
  const { actor, refreshMeta } = useAuth();
  const general = !actor.district_id;
  const [tab, setTab] = useState('clubes');
  const districts = useLoad(() => api.get('/admin/districts'));
  const clubs = useLoad(() => api.get('/admin/clubs'));
  const admins = useLoad(() => (general ? api.get('/admin/admins') : Promise.resolve([])));
  const appDistrict = useLoad(() => (general ? api.get('/admin/app-distrito') : Promise.resolve(null)));
  const [modal, setModal] = useState(null);
  const [newDistrict, setNewDistrict] = useState('');
  const [busy, run] = useAsync();

  const addDistrict = async () => {
    await run(() => api.post('/admin/districts', { name: newDistrict }), 'Distrito cadastrado!');
    setNewDistrict('');
    districts.reload();
    refreshMeta();
  };
  const giveDays = (c) => {
    const days = Number(prompt(`Quantos dias de plano dar para o ${c.name}? (sem cobrança; janeiro e dezembro já são grátis)`, '30'));
    if (!days) return;
    run(() => api.post(`/admin/clubs/${c.id}/plano`, { days }), 'Dias adicionados').then(() => clubs.reload());
  };
  const removeClub = (c) => {
    if (prompt(`Apagar o ${c.name} de vez? Somem as unidades, os ${c.member_count} membros e tudo do clube. Para confirmar, escreva APAGAR`) !== 'APAGAR') return;
    run(() => api.del('/admin/clubs/' + c.id), 'Clube apagado').then(() => { clubs.reload(); districts.reload(); });
  };
  const renameDistrict = async (d) => {
    const name = prompt('Novo nome do distrito', d.name);
    if (!name) return;
    await run(() => api.put('/admin/districts/' + d.id, { name }), 'Distrito atualizado');
    districts.reload();
    refreshMeta();
  };

  return (
    <>
      <PageHeader title="Clubes e acessos" subtitle={general ? null : `Distrito ${actor.district_name}`} />
      {general && <Tabs tabs={[['clubes', 'Clubes'], ['distritos', 'Distritos'], ['admins', 'Administradores']]} value={tab} onChange={setTab} />}
      {tab === 'distritos' && (
        <>
          <Card>
            <div className="row">
              <input placeholder="Nome do novo distrito" value={newDistrict} onChange={(e) => setNewDistrict(e.target.value)} />
              <Button busy={busy} onClick={addDistrict}>Adicionar</Button>
            </div>
          </Card>
          <div className="list mt">
            <Loading {...districts}>
              {(list) => list.map((d) => (
                <div key={d.id} className="list-item">
                  <span className="trophy-bg"><Map size={22} /></span>
                  <div className="grow"><div className="title">{d.name}</div><div className="sub">{plural(d.club_count, 'clube', 'clubes')}</div></div>
                  <Button small variant="secondary" onClick={() => renameDistrict(d)}>Renomear</Button>
                </div>
              ))}
            </Loading>
          </div>
        </>
      )}
      {tab === 'clubes' && (
        <>
          <Button block onClick={() => setModal({ kind: 'club' })}>+ Criar clube</Button>
          <div className="list mt">
            <Loading {...clubs} empty="Nenhum clube cadastrado.">
              {(list) => list.map((c) => (
                <div key={c.id} className="list-item">
                  <Avatar src={c.logo} name={c.name} size={48} square />
                  <div className="grow">
                    <div className="title">{c.name}</div>
                    <div className="sub">{c.district_name} · {plural(c.unit_count, 'unidade', 'unidades')} · {plural(c.member_count, 'membro', 'membros')}</div>
                    {c.plan && <div className="sub">Plano do clube: <b>{PLAN_LABEL[c.plan.state]}</b>{c.plan.paid_until ? ` · pago até ${new Date(c.plan.paid_until).toLocaleDateString('pt-BR')}` : ''}</div>}
                    {c.is_app ? <div className="sub">Automático: quem cria a conta pelo app (sem clube) entra aqui. Não aparece nos rankings de clube, unidade e distrito.</div> : <div className="sub">Código <b>{c.code}</b>{c.director_name ? <> · Diretor(a): {c.director_name}</> : ''}{c.associate_directors ? <> · Associados: {c.associate_directors.split('\n').join(', ')}</> : ''}</div>}
                  </div>
                  <div className="stack" style={{ gap: '.35rem' }}>
                    <Link to={`${base}/clubes/${c.id}`}><Button small>Ver por dentro</Button></Link>
                    {!c.is_app && <Button small variant="secondary" onClick={() => setModal({ kind: 'club', item: c })}>Editar</Button>}
                    {!c.is_app && general && <Button small variant="secondary" busy={busy} onClick={() => giveDays(c)}>Dar dias</Button>}
                    {!c.is_app && <Button small variant="danger" busy={busy} onClick={() => removeClub(c)}>Apagar</Button>}
                  </div>
                </div>
              ))}
            </Loading>
          </div>
        </>
      )}
      {tab === 'admins' && (
        <>
          <p className="small muted">Você é o único administrador geral. Cada novo administrador cuida de um distrito: cria clubes e requisitos desse distrito e vê só ele.</p>
          <Button block onClick={() => setModal({ kind: 'admin' })}>+ Novo administrador de distrito</Button>
          <div className="list mt">
            <Loading {...admins}>
              {(list) => list.map((a) => (
                <div key={a.id} className="list-item">
                  <Avatar name={a.name} size={42} />
                  <div className="grow"><div className="title">{a.name}</div><div className="sub">@{a.username} · {a.district_id ? (a.district_id === appDistrict.data?.id ? 'Administrador do App (contas sem clube)' : `Distrito ${a.district_name}`) : 'Administrador geral'}</div></div>
                  <Button small variant="secondary" onClick={() => setModal({ kind: 'admin', item: a })}>Editar</Button>
                </div>
              ))}
            </Loading>
          </div>
        </>
      )}
      {modal?.kind === 'club' && (
        <ClubForm
          item={modal.item} districts={districts.data || []}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); clubs.reload(); districts.reload(); }}
          onCreated={(r) => { setModal({ kind: 'created', ...r }); clubs.reload(); districts.reload(); }}
          nextNumber={Math.max(0, ...(clubs.data || []).map((c) => c.number || 0)) + 1}
        />
      )}
      {modal?.kind === 'created' && (
        <Modal title="Clube criado!" onClose={() => setModal(null)} footer={<Button onClick={() => setModal(null)}>Entendi</Button>}>
          <p className="center">Passe estes dados para o <b>{modal.name}</b>. Ele entra na tela <b>Clube</b>.</p>
          <p className="center muted small" style={{ marginBottom: 0 }}>Código do clube</p>
          <div className="code-big">{modal.code}</div>
          <p className="center muted small" style={{ marginBottom: 0 }}>Senha</p>
          <div className="code-big" style={{ fontSize: '1.6rem' }}>{modal.password}</div>
          <p className="muted small center">Anote a senha: ela não aparece de novo e <b>não pode ser trocada</b>.</p>
        </Modal>
      )}
      {modal?.kind === 'admin' && (
        <NameLoginForm
          title={modal.item ? 'Editar administrador' : 'Novo administrador do distrito'} item={modal.item}
          withDistrict={!modal.item || !!modal.item.district_id} districts={districts.data || []} appDistrict={appDistrict.data}
          onClose={() => setModal(null)}
          onSave={(f) => (modal.item ? api.put('/admin/admins/' + modal.item.id, f) : api.post('/admin/admins', f)).then(admins.reload)}
        />
      )}
    </>
  );
}

/** Requisitos: criados e avaliação (separados por desbravadores, unidades e clubes) e análise dos cursos. */
function RequirementsAdmin() {
  const [tab, setTab] = useState(new URLSearchParams(location.search).get('aba') || 'criados');
  return (
    <>
      <PageHeader title="Requisitos" subtitle="Desbravadores, unidades e clubes" />
      <Tabs tabs={[['criados', 'Criados'], ['avaliar', 'Avaliar envios'], ['cursos', 'Aulas dos cursos']]} value={tab} onChange={setTab} />
      {tab === 'criados' && <CreatedRequirements />}
      {tab === 'avaliar' && <ReviewsPanel />}
      {tab === 'cursos' && <ContentReview type="curso" embedded />}
    </>
  );
}

/** Painel do Administrador Geral. */
export default function AdminApp() {
  const { actor } = useAuth();
  const general = !actor.district_id;
  const tabs = !general ? [
    { to: base, icon: House, label: 'Início', end: true },
    { to: `${base}/clubes`, icon: Tent, label: 'Clubes' },
    { to: `${base}/requisitos`, icon: ClipboardCheck, label: 'Requisitos' },
    { to: `${base}/sequencias`, icon: Flame, label: 'Sequências' },
    { to: `${base}/mais`, icon: Menu, label: 'Mais' },
  ] : [
    { to: base, icon: House, label: 'Início', end: true },
    { to: `${base}/clubes`, icon: Tent, label: 'Clubes' },
    { to: `${base}/requisitos`, icon: ClipboardCheck, label: 'Requisitos' },
    { to: `${base}/conteudo`, icon: Library, label: 'Conteúdo' },
    { to: `${base}/mais`, icon: Menu, label: 'Mais' },
  ];
  // Aprovações de quem é do Clube App Brasil: o geral e o administrador do App.
  const appApprovals = general || actor.app ? [{ to: `${base}/aprovacoes`, icon: BadgeCheck, label: 'Aprovações do App', hint: 'Especialidades e classes de quem é do App Brasil' }] : [];
  const more = !general ? [
    ...appApprovals,
    { to: `${base}/anuncios`, icon: Megaphone, label: 'Anúncios', hint: actor.app ? 'Para quem é do App Brasil' : 'Para o seu distrito' },
    { to: `${base}/ranking`, icon: Trophy, label: 'Rankings', hint: 'Tabelas do distrito' },
    { to: `${base}/explorar`, icon: Map, label: 'Explorar clubes', hint: 'Perfis públicos' },
  ] : [
    ...appApprovals,
    { to: `${base}/sequencias`, icon: Flame, label: 'Sequências', hint: 'Porcentagem por distrito e clube' },
    { to: `${base}/dbv-mais`, icon: Wallet, label: 'DBV+', hint: 'Assinantes e especialidades escolhidas' },
    { to: `${base}/suporte`, icon: MessageCircle, label: 'Suporte', hint: 'Responder os clubes e membros' },
    { to: `${base}/pagamentos`, icon: Wallet, label: 'Pagamentos', hint: 'Pix (SyncPay) e confirmações' },
    { to: `${base}/figurinhas`, icon: BookImage, label: 'Figurinhas', hint: 'Álbuns completos e presentes' },
          { to: `${base}/aprendizagem`, icon: Flame, label: 'Aprendizagem Diária', hint: 'Arganel, medalhas e áudio' },
    { to: `${base}/links`, icon: Globe, label: 'Links dos sites', hint: 'SGC, Cantinho e Cartão DBV' },
    { to: `${base}/entregar`, icon: Send, label: 'Entregar conteúdo', hint: 'Medalhas, troféus e cursos' },
    { to: `${base}/catalogo`, icon: BookOpenCheck, label: 'Catálogo oficial', hint: 'Especialidades' },
    { to: `${base}/eventos`, icon: CalendarDays, label: 'Eventos', hint: 'Criar e participantes' },
    { to: `${base}/anuncios`, icon: Megaphone, label: 'Anúncios', hint: 'Aparecem ao abrir o app' },
    { to: `${base}/ranking`, icon: Trophy, label: 'Rankings', hint: 'Todas as tabelas' },
    { to: `${base}/explorar`, icon: Map, label: 'Explorar clubes', hint: 'Perfis públicos' },
  ];
  return (
    <Shell tabs={tabs} parentOf={(path) => {
      const [, , seg, sub] = path.split('/');
      if (sub && ['clubes'].includes(seg)) return `${base}/${seg}`;
      return ['clubes', 'requisitos', 'conteudo', 'ver'].includes(seg) ? base : `${base}/mais`;
    }}>
      <Routes>
        <Route index element={<AdminHome />} />
        <Route path="clubes" element={<ClubsAdmin />} />
        <Route path="clubes/:id" element={<ClanView base={base} />} />
        <Route path="suporte" element={<SupportAdmin />} />
        <Route path="links" element={<LinksAdmin />} />
        <Route path="figurinhas" element={<StickersAdmin />} />
        <Route path="aprendizagem" element={<LearningAdmin />} />
        <Route path="pagamentos" element={<PaymentsAdmin />} />
        <Route path="agenda" element={<AgendaAdmin />} />
        <Route path="requisitos" element={<RequirementsAdmin />} />
        <Route path="conteudo" element={<ContentAdmin />} />
        <Route path="catalogo" element={<CatalogAdmin />} />
        <Route path="cursos" element={<ContentReview type="curso" />} />
        <Route path="entregar" element={<Deliver />} />
        <Route path="eventos" element={<EventsAdmin />} />
        <Route path="anuncios" element={<AnnouncementsAdmin />} />
        <Route path="aprovacoes" element={<ApprovalsPage url="/admin/app-aprovacoes" canAdd={false} subtitle="Especialidades e classes de quem é do Clube App Brasil" />} />
        <Route path="medalhas" element={<Navigate to={`${base}/conteudo?aba=medalhas`} replace />} />
        <Route path="ranking" element={<RankingHub base={base} />} />
        <Route path="sequencias" element={<StreaksAdmin />} />
        <Route path="dbv-mais" element={<PlusAdmin />} />
        <Route path="explorar" element={<ClubsBrowser base={base} />} />
        <Route path="ver/:kind/:id" element={<InAppProfile base={base} />} />
        <Route path="mais" element={<><PageHeader title="Mais" /><MoreMenu items={more} /></>} />
        <Route path="*" element={<Navigate to={base} replace />} />
      </Routes>
    </Shell>
  );
}
