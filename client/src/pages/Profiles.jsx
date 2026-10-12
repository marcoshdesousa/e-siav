import { Link, useParams, Navigate } from 'react-router-dom';
import { useState } from 'react';
import {
  Award, CalendarDays, ChevronRight, Compass, Flag, MapPin, Hash, Tent, Users,
} from 'lucide-react';
import { Attachments } from './admin/Events.jsx';
import { api } from '../api.js';
import { fmtDate, plural } from '../format.js';
import { useAuth, homeFor } from '../auth.jsx';
import { Avatar, BackButton, Button, Card, ContentIcon, Empty, Loading, LogoHorizontal, MedalList, Modal, PositionBadge, RowSection, Section, ShareButton, useLoad } from '../ui.jsx';

/** linkBase: "/p" (páginas públicas) ou "<app>/ver" (dentro do app). */
// Links públicos: /cla/CÓDIGO (clã), /cla/CÓDIGO/Nº (grupo) e /CÓDIGO-DO-MEMBRO.
export const clanLink = (code) => `/cla/${code}`;
export const groupLink = (clubCode, number, isLeadership) => `/cla/${clubCode}/${isLeadership ? 'tutores' : number}`;
// Dentro do app o perfil abre nas abas (base/ver/cla/ID); na página pública usa o link bonito.
const to = (linkBase, kind, id, pretty) => (linkBase === '/p' && pretty ? pretty : `${linkBase}/${kind}/${id}`);

export function EventCard({ e }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="list-item event-card" onClick={() => setOpen(true)} style={{ font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
        <span className="trophy-bg"><Tent size={22} /></span>
        <div className="grow">
          <div className="title ellipsis">{e.name}</div>
          <div className="sub ellipsis">{fmtDate(e.date)}{e.location ? ' · ' + e.location : ''}</div>
        </div>
      </button>
      {open && (
        <Modal title={e.name} onClose={() => setOpen(false)}>
          <p className="muted ico"><CalendarDays size={15} /> {fmtDate(e.date)}{e.location ? <> · <MapPin size={15} /> {e.location}</> : null}</p>
          {e.description && <p style={{ whiteSpace: 'pre-wrap' }}>{e.description}</p>}
          <Attachments list={e.attachments} />
        </Modal>
      )}
    </>
  );
}

export const EventsList = ({ events }) => (
  <RowSection title="Eventos" items={events} empty="Nenhum evento registrado ainda." emptyIcon="tent" render={(e) => <EventCard key={e.id} e={e} />} />
);

const ChipRow = ({ title, items, empty, emptyIcon }) => (
  <RowSection
    title={title} items={items} empty={empty} emptyIcon={emptyIcon}
    render={(c) => (
      <span key={c.id} className="ach-chip" title={c.category || ''}>
        <span className="ach-img"><ContentIcon c={c} size={16} /></span>{c.name}
      </span>
    )}
  />
);

export function ClubProfileView({ club: c, linkBase }) {
  return (
    <>
      <div className="hero">
        <div className="profile-head">
          <Avatar src={c.logo} name={c.name} size={96} square />
          <h1>{c.name}</h1>
          <div className="chips">
            <span className="chip ico"><MapPin size={14} /> {c.district_name}</span>
            <span className="chip ico"><Users size={14} /> {plural(c.member_count, 'membro', 'membros')}</span>
            <span className="chip ico"><Flag size={14} /> {plural(c.unit_count, 'grupo', 'grupos')}</span>
          </div>
          <div className="row wrap" style={{ justifyContent: 'center', marginTop: '.4rem' }}>
            {c.ranking && <PositionBadge position={c.ranking.position} points={c.ranking.points} label="no ranking de clãs" />}
          </div>
          {c.director_name && <p className="small" style={{ margin: '.5rem 0 0' }}>Diretor(a): <b>{c.director_name}</b>{c.associate_directors ? <><br />Diretores associados: <b>{c.associate_directors.split('\n').join(', ')}</b></> : ''}</p>}
          <div className="mt"><ShareButton path={clanLink(c.code)} title={c.name} /></div>
        </div>
      </div>
      {c.history && (
        <Section title="Nossa história">
          <Card><p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{c.history}</p></Card>
        </Section>
      )}
      <Section title={`Grupos (${c.unit_count})`}>
        <div className="list">
          {c.units.map((u) => (
            <Link key={u.id} to={to(linkBase, 'grupo', u.id, groupLink(c.code, u.number, u.is_leadership))} className="list-item">
              <Avatar src={u.logo} name={u.name} size={42} square />
              <div className="grow">
                <div className="title">{u.name}</div>
                <div className="sub">{plural(u.member_count, 'membro', 'membros')}</div>
              </div>
              <ChevronRight className="chev" size={20} />
            </Link>
          ))}
        </div>
      </Section>
      <MedalList medals={c.medals} />
      <EventsList events={c.events} />
    </>
  );
}

export function UnitProfileView({ unit: u, linkBase, hideBio = false, extra = null }) {
  return (
    <>
      <div className="hero">
        <div className="profile-head">
          <Avatar src={u.logo} name={u.name} size={96} square />
          <h1>Grupo {u.name}</h1>
          <div className="chips">
            <Link to={to(linkBase, 'cla', u.club_id, clanLink(u.club_code))} className="chip ico"><Tent size={14} /> {u.club_name}</Link>
            <span className="chip ico"><Users size={14} /> {plural(u.member_count, 'membro', 'membros')}</span>
          </div>
          <div className="row wrap" style={{ justifyContent: 'center', marginTop: '.4rem' }}>
            {u.ranking_club && <PositionBadge position={u.ranking_club.position} points={u.ranking_club.points} label="no clã" />}
            {u.ranking_general && <PositionBadge position={u.ranking_general.position} points={u.ranking_general.points} label="no ranking geral" />}
          </div>
          <div className="mt"><ShareButton path={groupLink(u.club_code, u.number, u.is_leadership)} title={'Grupo ' + u.name} /></div>
        </div>
      </div>
      {u.bio && !hideBio && <Section title="Sobre o grupo"><Card><p style={{ margin: 0, whiteSpace: 'pre-line' }}>{u.bio}</p></Card></Section>}
      {extra}
      <MedalList medals={u.medals} />
    </>
  );
}

export function MemberProfileView({ member: m, linkBase, photoAction }) {
  return (
    <>
      <div className="hero">
        <div className="profile-head">
          <Avatar src={m.photo} name={m.name} size={104} />
          {photoAction}
          <h1>{m.name}</h1>
          <span className="handle-chip"><Hash size={14} /> {m.code}</span>
          <div className="chips">
            <span className="chip yellow">{m.cargo}</span>
            <span className="chip">{m.age} anos</span>
            {m.cargo !== m.role && <span className="chip ico">{m.kind === 'desbravador' ? <Compass size={14} /> : <Award size={14} />} {m.role}</span>}
          </div>
          <div className="chips">
            <Link to={to(linkBase, 'cla', m.club_id, clanLink(m.club_code))} className="chip ico"><Tent size={14} /> {m.club_name}</Link>
            {m.unit_id ? <Link to={to(linkBase, 'grupo', m.unit_id, groupLink(m.club_code, m.unit_number, m.unit_is_leadership))} className="chip ico"><Flag size={14} /> {m.unit_name}</Link> : <span className="chip ico"><Flag size={14} /> Sem grupo</span>}
          </div>
          <div className="row wrap" style={{ justifyContent: 'center', marginTop: '.4rem' }}>
            {m.ranking && <PositionBadge position={m.ranking.position} points={m.ranking.points} label={m.kind === 'desbravador' ? 'no ranking de exploradores' : 'no ranking da liderança'} />}
          </div>
          <div className="mt"><ShareButton path={`/${m.code}`} title={m.name} /></div>
        </div>
      </div>

      <ChipRow title="Insígnias" items={m.specialties} empty="Nenhuma insígnia ainda." emptyIcon="knot" />
      {m.courses?.length ? <ChipRow title="Cursos concluídos" items={m.courses} /> : null}
      <MedalList medals={m.medals} />
      <EventsList events={m.events} />
    </>
  );
}

const KIND_URL = {
  cla: (id) => `/public/clubs/${id}`, grupo: (id) => `/public/units/${id}`, membro: (id) => `/public/members/${id}`,
  // Links públicos pelo código: "4821" (clã) e "4821/2" (grupo nº 2 do clã)
  cla_codigo: (code) => `/public/cla/${code}`, grupo_codigo: (path) => `/public/cla/${path}`,
  clube: (id) => `/public/clubs/${id}`, unidade: (id) => `/public/units/${id}`, // links antigos (/p/clube/1)
};
const VIEW = { cla: 'cla', clube: 'cla', cla_codigo: 'cla', grupo: 'grupo', unidade: 'grupo', grupo_codigo: 'grupo', membro: 'membro' };

function ProfileByKind({ kind, id, linkBase }) {
  const state = useLoad(() => api.get(KIND_URL[kind](id)), [kind, id]);
  return (
    <Loading {...state}>
      {(d) =>
        VIEW[kind] === 'cla' ? <ClubProfileView club={d} linkBase={linkBase} />
          : VIEW[kind] === 'grupo' ? <UnitProfileView unit={d} linkBase={linkBase} />
            : <MemberProfileView member={d} linkBase={linkBase} />
      }
    </Loading>
  );
}

/** Perfil aberto dentro do app (mantém as abas). */
export function InAppProfile({ base }) {
  const { kind, id } = useParams();
  if (!KIND_URL[kind]) return <Empty>Perfil não encontrado.</Empty>;
  return (
    <>
      <BackButton fallback={base} className="back-link btn-ghost" style={{ border: 0, background: 'none', cursor: 'pointer', padding: 0 }} />
      <ProfileByKind kind={kind} id={id} linkBase={`${base}/ver`} />
    </>
  );
}

/** Link público do clã e dos grupos: /cla/4821 e /cla/4821/2 (ou /cla/4821/tutores). */
export function ClanLinkPage({ code, n }) {
  if (n) return <PublicProfilePage kind="grupo_codigo" id={`${code}/${n}`} />;
  return <PublicProfilePage kind="cla_codigo" id={code} />;
}

/** Link de bio do explorador: site/123456 (só para ver; editar é pelo app). */
export function MemberLinkPage() {
  const { code } = useParams();
  if (!/^\d{6}$/.test(code || '')) return <Navigate to="/" replace />;
  return <PublicProfilePage kind="membro" id={code} />;
}

export function PublicProfilePage({ kind: kindProp, id: idProp }) {
  const params = useParams();
  const kind = kindProp || params.kind;
  const id = idProp || params.id;
  const { actor } = useAuth();
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/"><LogoHorizontal light size={34} /></Link>
        <div className="who">
          <Link to={actor ? homeFor(actor) : '/entrar'}><Button variant="yellow" small>{actor ? 'Abrir o app' : 'Entrar'}</Button></Link>
        </div>
      </header>
      <main className="main no-nav">
        {KIND_URL[kind] ? <ProfileByKind kind={kind} id={id} linkBase="/p" /> : <Empty>Perfil não encontrado.</Empty>}
      </main>
    </div>
  );
}
