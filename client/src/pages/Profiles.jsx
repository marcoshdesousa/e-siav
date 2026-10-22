import { Link, useParams, Navigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { Verified } from './member/PlusPage.jsx';
import { Award, CalendarDays, ChevronDown, ChevronRight, ChevronUp, Compass, Flag, Flame, MapPin, Hash, Tent, Users } from 'lucide-react';
import { Attachments } from './admin/Events.jsx';
import { api } from '../api.js';
import { fmtDate, plural } from '../format.js';
import { useAuth, homeFor } from '../auth.jsx';
import { AppIcon } from '../icons.jsx';
import { Avatar, Button, Card, Empty, Loading, LogoHorizontal, MedalList, Modal, PositionBadge, RowSection, Section, ShareButton, useLoad } from '../ui.jsx';

/** linkBase: "/p" (páginas públicas) ou "<app>/ver" (dentro do app). */
// Links públicos: /clube/CÓDIGO (clube), /clube/CÓDIGO/Nº (unidade) e /CÓDIGO-DO-MEMBRO.
export const clanLink = (code) => `/clube/${code}`;
export const groupLink = (clubCode, number, isLeadership) => `/clube/${clubCode}/${isLeadership ? 'lideranca' : number}`;
// Dentro do app o perfil abre nas abas (base/ver/clube/ID); na página pública usa o link bonito.
const to = (linkBase, kind, id, pretty) => (linkBase === '/p' && pretty ? pretty : `${linkBase}/${kind}/${id}`);

/** Primeira foto do evento (os anexos podem ser fotos ou PDFs). */
const coverOf = (e) => (e.attachments || []).find((a) => a.type !== 'pdf' && a.url)?.url || null;

export function EventCard({ e }) {
  const [open, setOpen] = useState(false);
  const cover = coverOf(e);
  return (
    <>
      <button type="button" className="list-item event-card has-cover" onClick={() => setOpen(true)} style={{ font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
        {cover ? <img src={cover} alt="" className="event-cover" loading="lazy" /> : <span className="event-cover empty"><Tent size={30} /></span>}
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

const PREVIEW = 3;

/**
 * Classes e especialidades do perfil: só o nome (com o ícone da área, sem foto).
 * Mostra as 2 primeiras e o botão "Ver mais" abre todas.
 */
/** Classes e especialidades: as 3 primeiras; "Ver mais" mostra tudo separado por categoria (com quantas). */
function NameList({ title, items = [], empty, emptyIcon, icon, byCategory }) {
  const [open, setOpen] = useState(false);
  const extra = items.length - PREVIEW;
  const row = (c) => (
    <span key={c.id} className="name-item" title={c.category || ''}>
      <span className="ach-img"><AppIcon name={icon} size={16} /></span>
      <span className="grow ellipsis">{c.name}</span>
    </span>
  );
  const groups = useMemo(() => {
    const m = new Map();
    for (const c of items) { const g = byCategory ? c.category || 'Outras' : c.leader ? 'Classes de liderança' : 'Classes regulares e avançadas'; if (!m.has(g)) m.set(g, []); m.get(g).push(c); }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [items, byCategory]);
  return (
    <Section title={`${title}${items.length ? ` (${items.length})` : ''}`}>
      {items.length ? (
        <>
          {open ? (
            groups.map(([g, list]) => (
              <div key={g} className="name-group">
                <div className="name-group-head"><b>{g}</b><span>{list.length}</span></div>
                <div className="name-list">{list.map(row)}</div>
              </div>
            ))
          ) : <div className="name-list">{items.slice(0, PREVIEW).map(row)}</div>}
          {extra > 0 && (
            <button type="button" className="see-more name-more" onClick={() => setOpen((o) => !o)}>
              {open ? <>Ver menos <ChevronUp size={14} /></> : <>Ver mais ({extra}) <ChevronDown size={14} /></>}
            </button>
          )}
        </>
      ) : <Empty icon={emptyIcon}>{empty}</Empty>}
    </Section>
  );
}

/** Os 5 rankings do membro (no clube e no distrito, da unidade e do clube). */
function RanksGrid({ r }) {
  if (!r) return null;
  const items = [
    ['Você no clube', r.member_club], ['Você no distrito', r.member_district],
    ['Sua unidade no clube', r.unit_club], ['Sua unidade no distrito', r.unit_district], ['Seu clube no distrito', r.club_district],
  ].filter(([, x]) => x);
  if (!items.length) return null;
  return (
    <Section title="Rankings">
      <div className="ranks-grid">
        {items.map(([label, x]) => (
          <div key={label} className="rank-tile">
            <b>{x.position}º</b>
            <small>{label}</small>
            <span>{x.points} pts · de {x.total}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

/** Sequência do Ano Bíblico, que todo mundo vê no link do perfil. */
const dias = (n) => `${n} ${n === 1 ? 'dia' : 'dias'}`;
function BibleStreak({ list }) {
  return (
    <Section title="Sequências">
      <div className="streak-pub three">
        {list.map((x) => (
          <div key={x.name} className={'streak-pub-box' + (x.streak ? ' on' : '')}>
            <Flame size={22} />
            <span><b>{dias(x.streak)}</b><small>{x.name} · recorde {dias(x.best_streak)}</small></span>
          </div>
        ))}
      </div>
    </Section>
  );
}

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
            <span className="chip ico"><Flag size={14} /> {plural(c.unit_count, 'unidade', 'unidades')}</span>
          </div>
          <div className="row wrap" style={{ justifyContent: 'center', marginTop: '.4rem' }}>
            {c.ranking && <PositionBadge position={c.ranking.position} points={c.ranking.points} label="no ranking de clubes do distrito" />}
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
      <Section title={`Unidades (${c.unit_count})`}>
        <div className="list">
          {c.units.map((u) => (
            <Link key={u.id} to={to(linkBase, 'unidade', u.id, groupLink(c.code, u.number, u.is_leadership))} className="list-item">
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
          <h1>Unidade {u.name}</h1>
          <div className="chips">
            <Link to={to(linkBase, 'clube', u.club_id, clanLink(u.club_code))} className="chip ico"><Tent size={14} /> {u.club_name}</Link>
            <span className="chip ico"><Users size={14} /> {plural(u.member_count, 'membro', 'membros')}</span>
          </div>
          <div className="row wrap" style={{ justifyContent: 'center', marginTop: '.4rem' }}>
            {u.ranking_club && <PositionBadge position={u.ranking_club.position} points={u.ranking_club.points} label="no clube" />}
            {u.ranking_general && <PositionBadge position={u.ranking_general.position} points={u.ranking_general.points} label="no distrito" />}
          </div>
          <div className="mt"><ShareButton path={groupLink(u.club_code, u.number, u.is_leadership)} title={'Unidade ' + u.name} /></div>
        </div>
      </div>
      {u.bio && !hideBio && <Section title="Sobre a unidade"><Card><p style={{ margin: 0, whiteSpace: 'pre-line' }}>{u.bio}</p></Card></Section>}
      {extra}
      <MedalList medals={u.medals} />
    </>
  );
}

export function MemberProfileView({ member: m, linkBase, photoAction, extra }) {
  return (
    <>
      <div className="hero">
        <div className="profile-head">
          <Avatar src={m.photo} name={m.name} size={104} />
          {photoAction}
          <h1>{m.name}{m.verified && <Verified size={24} />}</h1>
          <span className="handle-chip"><Hash size={14} /> {m.code}</span>
          <div className="chips">
            <span className="chip yellow">{m.cargo}</span>
            <span className="chip">{m.age} anos</span>
            {m.cargo !== m.role && <span className="chip ico">{m.kind === 'desbravador' ? <Compass size={14} /> : <Award size={14} />} {m.role}</span>}
          </div>
          <div className="chips">
            <Link to={to(linkBase, 'clube', m.club_id, clanLink(m.club_code))} className="chip ico"><Tent size={14} /> {m.club_name}</Link>
            {m.unit_id ? <Link to={to(linkBase, 'unidade', m.unit_id, groupLink(m.club_code, m.unit_number, m.unit_is_leadership))} className="chip ico"><Flag size={14} /> {m.unit_name}</Link> : <span className="chip ico"><Flag size={14} /> Sem unidade</span>}
          </div>
          <div className="row wrap" style={{ justifyContent: 'center', marginTop: '.4rem' }}>
            {m.ranking && <PositionBadge position={m.ranking.position} points={m.ranking.points} label={m.kind === 'desbravador' ? 'no ranking de desbravadores do distrito' : 'no ranking da liderança do distrito'} />}
          </div>
          <div className="mt"><ShareButton path={`/${m.code}`} title={m.name} /></div>
        </div>
      </div>

      {extra}
      {m.streaks && <BibleStreak list={m.streaks} />}
      <RanksGrid r={m.ranks} />
      <NameList title="Classes" items={m.classes} empty="Nenhuma classe ainda." emptyIcon="compass" icon="compass" />
      <NameList title="Especialidades" items={m.specialties} empty="Nenhuma especialidade ainda." emptyIcon="knot" icon="award" byCategory />
      {m.courses?.length ? <NameList title="Cursos concluídos" items={m.courses} /> : null}
      <MedalList medals={m.medals} />
      <EventsList events={m.events} />
    </>
  );
}

const KIND_URL = {
  cla: (id) => `/public/clubs/${id}`, grupo: (id) => `/public/units/${id}`, membro: (id) => `/public/members/${id}`,
  // Links públicos pelo código: "4821" (clube) e "4821/2" (unidade nº 2 do clube)
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
      <ProfileByKind kind={kind} id={id} linkBase={`${base}/ver`} />
    </>
  );
}

/** Link público do clube e das unidades: /cla/4821 e /cla/4821/2 (ou /cla/4821/tutores). */
export function ClanLinkPage({ code, n }) {
  if (n) return <PublicProfilePage kind="grupo_codigo" id={`${code}/${n}`} />;
  return <PublicProfilePage kind="cla_codigo" id={code} />;
}

/** Link de bio do desbravador: site/123456 (só para ver; editar é pelo app). */
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
