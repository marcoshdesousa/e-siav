import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  BookOpenCheck, CalendarDays, ClipboardCheck, Flag, House, Inbox, Library, Map, Megaphone, Menu, Send, ShieldAlert, Tent, Trophy, Users,
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
import { ReportsPanel } from '../Chat.jsx';
import ContentAdmin from './ContentAdmin.jsx';
import ContentReview from './ContentReview.jsx';
import Deliver from './Deliver.jsx';
import EventsAdmin from './Events.jsx';
import AnnouncementsAdmin from './Announcements.jsx';
import CatalogAdmin from './CatalogAdmin.jsx';

const base = '/admin';

function AdminHome() {
  const { actor } = useAuth();
  const state = useLoad(() => api.get('/admin/overview'));
  return (
    <>
      <div className="hero">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p className="muted small">Painel do</p>
          <h1>Administrador Geral</h1>
          <p className="muted">Olá, {actor.name}! Você cuida de toda a plataforma.</p>
        </div>
      </div>
      <Loading {...state}>
        {(o) => (
          <Section title="Visão geral">
            <div className="stats">
              <Stat icon={Map} value={o.districts} label="Distritos" to={`${base}/clubes`} />
              <Stat icon={Tent} value={o.clubs} label="Clãs" to={`${base}/clubes`} />
              <Stat icon={Flag} value={o.units} label="Grupos" />
              <Stat icon={Users} value={o.members} label="Membros" />
              <Stat icon={ClipboardCheck} value={o.requirements} label="Requisitos gerais" to={`${base}/requisitos`} />
              <Stat icon={Inbox} value={o.pending_reviews} label="Envios p/ avaliar" to={`${base}/requisitos?aba=avaliar`} accent={o.pending_reviews > 0} />
              <Stat icon={ShieldAlert} value={o.open_reports} label="Denúncias abertas" to={`${base}/denuncias`} accent={o.open_reports > 0} />
            </div>
          </Section>
        )}
      </Loading>
      <Section title="Atalhos">
        <MoreMenu items={[
          { to: `${base}/entregar`, icon: Send, label: 'Entregar conteúdo' },
          { to: `${base}/catalogo`, icon: BookOpenCheck, label: 'Catálogo oficial' },
          { to: `${base}/eventos`, icon: CalendarDays, label: 'Eventos' },
          { to: `${base}/anuncios`, icon: Megaphone, label: 'Anúncios' },
        ]} />
      </Section>
      <p className="muted small mt center">Os dados pessoais dos membros são editados somente pelo clã de cada um.</p>
    </>
  );
}

// ---------- Distritos, clãs e administradores ----------
/**
 * Clã: nome, distrito e diretor. O código (0001, 0002...) é gerado pelo app;
 * a senha também, se ficar em branco. O login do clã é o código + a senha.
 */
function ClubForm({ item, districts, onClose, onCreated, onSaved }) {
  const [f, setF] = useState({ name: item?.name || '', district_id: item?.district_id || districts?.[0]?.id || '', director_name: item?.director_name || '', password: '' });
  const [busy, run] = useAsync();
  const save = async () => {
    if (item) {
      await run(() => api.put('/admin/clubs/' + item.id, f), 'Clã atualizado!');
      onSaved();
    } else {
      const r = await run(() => api.post('/admin/clubs', f), null);
      onCreated({ ...r, name: f.name });
    }
  };
  return (
    <Modal title={item ? `Editar clã ${item.code || ''}` : 'Novo clã'} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button busy={busy} disabled={!f.name.trim() || !f.director_name.trim()} onClick={save}>Salvar</Button></>}>
      <div className="form">
        <Field label="Nome do clã"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Clã ..." /></Field>
        <Field label="Distrito">
          <select value={f.district_id} onChange={(e) => setF({ ...f, district_id: e.target.value })}>
            {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Diretor(a) do clã" hint="Responsável pelo clã. Dá para trocar todo ano."><input value={f.director_name} onChange={(e) => setF({ ...f, director_name: e.target.value })} /></Field>
        <Field label={item ? 'Nova senha do clã' : 'Senha do clã'} hint={item ? 'Em branco mantém a atual' : 'Em branco: o app cria uma senha de 6 números'}>
          <input value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoCapitalize="none" />
        </Field>
        {!item && <p className="muted small">O código do clã é criado automaticamente. Os grupos do clã entram com o mesmo código e a senha de cada grupo.</p>}
      </div>
    </Modal>
  );
}

function NameLoginForm({ title, item, withDistrict, districts, onClose, onSave }) {
  const [f, setF] = useState({ name: item?.name || '', district_id: item?.district_id || districts?.[0]?.id || '', username: item?.username || '', password: '' });
  const [busy, run] = useAsync();
  return (
    <Modal title={title} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button busy={busy} onClick={() => run(() => onSave(f), 'Salvo!').then(onClose)}>Salvar</Button></>}>
      <div className="form">
        <Field label="Nome"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        {withDistrict && (
          <Field label="Distrito">
            <select value={f.district_id} onChange={(e) => setF({ ...f, district_id: e.target.value })}>
              {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
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

function ClubsAdmin() {
  const { refreshMeta } = useAuth();
  const [tab, setTab] = useState('clubes');
  const districts = useLoad(() => api.get('/admin/districts'));
  const clubs = useLoad(() => api.get('/admin/clubs'));
  const admins = useLoad(() => api.get('/admin/admins'));
  const [modal, setModal] = useState(null);
  const [newDistrict, setNewDistrict] = useState('');
  const [busy, run] = useAsync();

  const addDistrict = async () => {
    await run(() => api.post('/admin/districts', { name: newDistrict }), 'Distrito cadastrado!');
    setNewDistrict('');
    districts.reload();
    refreshMeta();
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
      <PageHeader title="Clãs e acessos" />
      <Tabs tabs={[['clubes', 'Clãs'], ['distritos', 'Distritos'], ['admins', 'Administradores']]} value={tab} onChange={setTab} />
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
                  <div className="grow"><div className="title">{d.name}</div><div className="sub">{plural(d.club_count, 'clã', 'clãs')}</div></div>
                  <Button small variant="secondary" onClick={() => renameDistrict(d)}>Renomear</Button>
                </div>
              ))}
            </Loading>
          </div>
        </>
      )}
      {tab === 'clubes' && (
        <>
          <Button block onClick={() => setModal({ kind: 'club' })}>+ Novo clã</Button>
          <div className="list mt">
            <Loading {...clubs} empty="Nenhum clã cadastrado.">
              {(list) => list.map((c) => (
                <div key={c.id} className="list-item">
                  <Avatar src={c.logo} name={c.name} size={48} square />
                  <div className="grow">
                    <div className="title">{c.name}</div>
                    <div className="sub">{c.district_name} · {plural(c.unit_count, 'grupo', 'grupos')} · {plural(c.member_count, 'membro', 'membros')}</div>
                    <div className="sub">Código <b>{c.code}</b>{c.director_name ? <> · Diretor(a): {c.director_name}</> : ''}</div>
                  </div>
                  <Button small variant="secondary" onClick={() => setModal({ kind: 'club', item: c })}>Editar</Button>
                </div>
              ))}
            </Loading>
          </div>
        </>
      )}
      {tab === 'admins' && (
        <>
          <Button block onClick={() => setModal({ kind: 'admin' })}>+ Novo administrador</Button>
          <div className="list mt">
            <Loading {...admins}>
              {(list) => list.map((a) => (
                <div key={a.id} className="list-item">
                  <Avatar name={a.name} size={42} />
                  <div className="grow"><div className="title">{a.name}</div><div className="sub">@{a.username}</div></div>
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
        />
      )}
      {modal?.kind === 'created' && (
        <Modal title="Clã criado!" onClose={() => setModal(null)} footer={<Button onClick={() => setModal(null)}>Entendi</Button>}>
          <p className="center">Passe estes dados para o <b>{modal.name}</b>. Ele entra na tela <b>Clã</b>.</p>
          <p className="center muted small" style={{ marginBottom: 0 }}>Código do clã</p>
          <div className="code-big">{modal.code}</div>
          <p className="center muted small" style={{ marginBottom: 0 }}>Senha</p>
          <div className="code-big" style={{ fontSize: '1.6rem' }}>{modal.password}</div>
          <p className="muted small center">Anote a senha: por segurança ela não aparece de novo. Dá para trocar em Editar.</p>
        </Modal>
      )}
      {modal?.kind === 'admin' && (
        <NameLoginForm
          title={modal.item ? 'Editar administrador' : 'Novo administrador'} item={modal.item}
          onClose={() => setModal(null)}
          onSave={(f) => (modal.item ? api.put('/admin/admins/' + modal.item.id, f) : api.post('/admin/admins', f)).then(admins.reload)}
        />
      )}
    </>
  );
}

/** Requisitos: criados e avaliação (separados por exploradores, grupos e clãs) e análise das cadernos guia/insígnias. */
function RequirementsAdmin() {
  const [tab, setTab] = useState(new URLSearchParams(location.search).get('aba') || 'criados');
  return (
    <>
      <PageHeader title="Requisitos" subtitle="Exploradores, grupos e clãs" />
      <Tabs tabs={[['criados', 'Criados'], ['avaliar', 'Avaliar envios'], ['cursos', 'Aulas dos cursos']]} value={tab} onChange={setTab} />
      {tab === 'criados' && <CreatedRequirements />}
      {tab === 'avaliar' && <ReviewsPanel />}
      {tab === 'cursos' && <ContentReview type="curso" embedded />}
    </>
  );
}

/** Painel do Administrador Geral. */
export default function AdminApp() {
  const tabs = [
    { to: base, icon: House, label: 'Início', end: true },
    { to: `${base}/clubes`, icon: Tent, label: 'Clãs' },
    { to: `${base}/requisitos`, icon: ClipboardCheck, label: 'Requisitos' },
    { to: `${base}/conteudo`, icon: Library, label: 'Conteúdo' },
    { to: `${base}/mais`, icon: Menu, label: 'Mais' },
  ];
  const more = [
    { to: `${base}/entregar`, icon: Send, label: 'Entregar conteúdo', hint: 'Medalhas, troféus e cursos' },
    { to: `${base}/catalogo`, icon: BookOpenCheck, label: 'Catálogo oficial', hint: 'Cadernos guia e insígnias' },
    { to: `${base}/eventos`, icon: CalendarDays, label: 'Eventos', hint: 'Criar e participantes' },
    { to: `${base}/anuncios`, icon: Megaphone, label: 'Anúncios', hint: 'Aparecem ao abrir o app' },
    { to: `${base}/ranking`, icon: Trophy, label: 'Rankings', hint: 'Todas as tabelas' },
    { to: `${base}/denuncias`, icon: ShieldAlert, label: 'Denúncias', hint: 'Do chat' },
    { to: `${base}/explorar`, icon: Map, label: 'Explorar clãs', hint: 'Perfis públicos' },
  ];
  return (
    <Shell tabs={tabs}>
      <Routes>
        <Route index element={<AdminHome />} />
        <Route path="clubes" element={<ClubsAdmin />} />
        <Route path="requisitos" element={<RequirementsAdmin />} />
        <Route path="conteudo" element={<ContentAdmin />} />
        <Route path="catalogo" element={<CatalogAdmin />} />
        <Route path="cursos" element={<ContentReview type="curso" />} />
        <Route path="entregar" element={<Deliver />} />
        <Route path="eventos" element={<EventsAdmin />} />
        <Route path="anuncios" element={<AnnouncementsAdmin />} />
        <Route path="medalhas" element={<Navigate to={`${base}/conteudo?aba=medalhas`} replace />} />
        <Route path="ranking" element={<RankingHub base={base} />} />
        <Route path="denuncias" element={<ReportsPanel />} />
        <Route path="explorar" element={<ClubsBrowser base={base} />} />
        <Route path="ver/:kind/:id" element={<InAppProfile base={base} />} />
        <Route path="mais" element={<><PageHeader title="Mais" /><MoreMenu items={more} /></>} />
        <Route path="*" element={<Navigate to={base} replace />} />
      </Routes>
    </Shell>
  );
}
