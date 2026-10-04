import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import { ArrowLeft, Award, CalendarDays, ChevronRight, Compass, Flag, MapPin, Pencil, Tent, Users } from 'lucide-react';
import { Attachments } from './admin/Events.jsx';
import { api } from '../api.js';
import { AppIcon } from '../icons.jsx';
import { fmtDate, plural } from '../format.js';
import { useAuth, homeFor } from '../auth.jsx';
import { Avatar, Button, ContentIcon, Empty, Loading, LogoHorizontal, MedalList, Modal, PositionBadge, RowSection, Section, ShareButton, useLoad } from '../ui.jsx';

/** linkBase: "/p" (páginas públicas) ou "<app>/ver" (dentro do app). */
const to = (linkBase, kind, id) => `${linkBase}/${kind}/${id}`;

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
        {c.photo && <div className="hero-cover" style={{ backgroundImage: `url(${c.photo})` }} />}
        <div className="profile-head">
          <Avatar src={c.logo} name={c.name} size={96} square />
          <h1>{c.name}</h1>
          <div className="chips">
            <span className="chip ico"><MapPin size={14} /> {c.district_name}</span>
            <span className="chip ico"><Users size={14} /> {plural(c.member_count, 'membro', 'membros')}</span>
            <span className="chip ico"><Flag size={14} /> {plural(c.unit_count, 'unidade', 'unidades')}</span>
          </div>
          <div className="row wrap" style={{ justifyContent: 'center', marginTop: '.4rem' }}>
            {c.ranking && <PositionBadge position={c.ranking.position} points={c.ranking.points} label="no ranking de clubes" />}
          </div>
          <div className="mt"><ShareButton path={`/p/clube/${c.id}`} title={c.name} /></div>
        </div>
      </div>
      <Section title={`Unidades (${c.unit_count})`}>
        <div className="list">
          {c.units.map((u) => (
            <Link key={u.id} to={to(linkBase, 'unidade', u.id)} className="list-item">
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

export function UnitProfileView({ unit: u, linkBase }) {
  return (
    <>
      <div className="hero">
        <div className="profile-head">
          <Avatar src={u.logo} name={u.name} size={96} square />
          <h1>Unidade {u.name}</h1>
          <div className="chips">
            <Link to={to(linkBase, 'clube', u.club_id)} className="chip ico"><Tent size={14} /> {u.club_name}</Link>
            <span className="chip ico"><Users size={14} /> {plural(u.member_count, 'membro', 'membros')}</span>
          </div>
          <div className="row wrap" style={{ justifyContent: 'center', marginTop: '.4rem' }}>
            {u.ranking_club && <PositionBadge position={u.ranking_club.position} points={u.ranking_club.points} label="no clube" />}
            {u.ranking_general && <PositionBadge position={u.ranking_general.position} points={u.ranking_general.points} label="no ranking geral" />}
          </div>
          <div className="mt"><ShareButton path={`/p/unidade/${u.id}`} title={'Unidade ' + u.name} /></div>
        </div>
      </div>
      <MedalList medals={u.medals} />
    </>
  );
}

export function MemberProfileView({ member: m, linkBase, photoAction, onEditHandle }) {
  return (
    <>
      <div className="hero">
        <div className="profile-head">
          <Avatar src={m.photo} name={m.name} size={104} />
          {photoAction}
          <h1>{m.name}</h1>
          {m.handle && <span className="handle-chip">@{m.handle}{onEditHandle && <button type="button" className="handle-edit" onClick={onEditHandle} aria-label="Alterar @"><Pencil size={13} /></button>}</span>}
          <div className="chips">
            <span className="chip yellow">{m.cargo}</span>
            <span className="chip">{m.age} anos</span>
            {m.cargo !== 'Desbravador' && <span className="chip ico">{m.kind === 'desbravador' ? <><Compass size={14} /> Desbravador</> : <><Award size={14} /> Liderança</>}</span>}
          </div>
          <div className="chips">
            <Link to={to(linkBase, 'clube', m.club_id)} className="chip ico"><Tent size={14} /> {m.club_name}</Link>
            {m.unit_id ? <Link to={to(linkBase, 'unidade', m.unit_id)} className="chip ico"><Flag size={14} /> {m.unit_name}</Link> : <span className="chip ico"><Flag size={14} /> Sem unidade</span>}
          </div>
          <div className="row wrap" style={{ justifyContent: 'center', marginTop: '.4rem' }}>
            {m.ranking && <PositionBadge position={m.ranking.position} points={m.ranking.points} label="no ranking de membros" />}
          </div>
          <div className="mt"><ShareButton path={`/p/membro/${m.handle ? '@' + m.handle : m.code}`} title={m.name} /></div>
        </div>
      </div>

      {m.excellence ? (
        <div className="summary-card gold mt">
          <span className="trophy-bg"><AppIcon name="sparkles" size={22} /></span>
          <div><b>Insígnia de Excelência</b><div className="muted small">Conquistada pelo membro</div></div>
        </div>
      ) : null}

      <ChipRow title="Classes concluídas" items={m.classes} empty="Nenhuma classe concluída ainda." emptyIcon="compass" />
      <ChipRow title="Especialidades" items={m.specialties} empty="Nenhuma especialidade ainda." emptyIcon="knot" />
      {m.courses?.length ? <ChipRow title="Cursos concluídos" items={m.courses} /> : null}
      <MedalList medals={m.medals} />
      <EventsList events={m.events} />
    </>
  );
}

const KIND_URL = { clube: (id) => `/public/clubs/${id}`, unidade: (id) => `/public/units/${id}`, membro: (id) => `/public/members/${id}` };

function ProfileByKind({ kind, id, linkBase }) {
  const state = useLoad(() => api.get(KIND_URL[kind](id)), [kind, id]);
  return (
    <Loading {...state}>
      {(d) =>
        kind === 'clube' ? <ClubProfileView club={d} linkBase={linkBase} />
          : kind === 'unidade' ? <UnitProfileView unit={d} linkBase={linkBase} />
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
      <button className="back-link btn-ghost" style={{ border: 0, background: 'none', cursor: 'pointer', padding: 0 }} onClick={() => history.back()}><ArrowLeft size={16} /> Voltar</button>
      <ProfileByKind kind={kind} id={id} linkBase={`${base}/ver`} />
    </>
  );
}

/** Link público para compartilhar: /p/clube/1, /p/unidade/2, /p/membro/DBV-XXXXX */
export function PublicProfilePage() {
  const { kind, id } = useParams();
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
