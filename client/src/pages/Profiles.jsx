import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { fmtDate, plural } from '../format.js';
import { useAuth, homeFor } from '../auth.jsx';
import { Avatar, Empty, Loading, LogoHorizontal, MedalList, PositionBadge, Section, ShareButton, useLoad, Button } from '../ui.jsx';

/** linkBase: "/p" (páginas públicas) ou "<app>/ver" (dentro do app). */
const to = (linkBase, kind, id) => `${linkBase}/${kind}/${id}`;

export function EventsList({ events }) {
  if (!events?.length) return <Empty icon="⛺">Nenhum evento registrado ainda.</Empty>;
  return (
    <div className="list">
      {events.map((e) => (
        <div key={e.id} className="list-item">
          <span className="trophy-bg">⛺</span>
          <div className="grow">
            <div className="title">{e.name}</div>
            <div className="sub">{fmtDate(e.date)}{e.location ? ' · ' + e.location : ''}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ClubProfileView({ club: c, linkBase }) {
  return (
    <>
      <div className="hero">
        {c.photo && <div className="hero-cover" style={{ backgroundImage: `url(${c.photo})` }} />}
        <div className="profile-head">
          <Avatar src={c.logo} name={c.name} size={96} square />
          <h1>{c.name}</h1>
          <div className="chips">
            <span className="chip">📍 {c.district_name}</span>
            <span className="chip">👥 {plural(c.member_count, 'membro', 'membros')}</span>
            <span className="chip">🚩 {plural(c.unit_count, 'unidade', 'unidades')}</span>
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
              <span className="chev">›</span>
            </Link>
          ))}
        </div>
      </Section>
      <Section title="Medalhas e troféus"><MedalList medals={c.medals} /></Section>
      <Section title="Eventos"><EventsList events={c.events} /></Section>
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
            <Link to={to(linkBase, 'clube', u.club_id)} className="chip">🏕️ {u.club_name}</Link>
            <span className="chip">👥 {plural(u.member_count, 'membro', 'membros')}</span>
          </div>
          <div className="row wrap" style={{ justifyContent: 'center', marginTop: '.4rem' }}>
            {u.ranking_club && <PositionBadge position={u.ranking_club.position} points={u.ranking_club.points} label="no clube" />}
            {u.ranking_general && <PositionBadge position={u.ranking_general.position} points={u.ranking_general.points} label="no ranking geral" />}
          </div>
          <div className="mt"><ShareButton path={`/p/unidade/${u.id}`} title={'Unidade ' + u.name} /></div>
        </div>
      </div>
      <Section title="Medalhas e troféus"><MedalList medals={u.medals} /></Section>
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
          <div className="chips">
            <span className="chip yellow">{m.cargo}</span>
            <span className="chip">{m.age} anos</span>
            <span className="chip">{m.kind === 'desbravador' ? '🧭 Desbravador' : '🎖️ Liderança'}</span>
          </div>
          <div className="chips">
            <Link to={to(linkBase, 'clube', m.club_id)} className="chip">🏕️ {m.club_name}</Link>
            {m.unit_id ? <Link to={to(linkBase, 'unidade', m.unit_id)} className="chip">🚩 {m.unit_name}</Link> : <span className="chip">🚩 Sem unidade</span>}
          </div>
          <div className="chips"><span className="chip">Código: <b>{m.code}</b></span></div>
          <div className="row wrap" style={{ justifyContent: 'center', marginTop: '.4rem' }}>
            {m.ranking && <PositionBadge position={m.ranking.position} points={m.ranking.points} label="no ranking de membros" />}
          </div>
          <div className="mt"><ShareButton path={`/p/membro/${m.code}`} title={m.name} /></div>
        </div>
      </div>

      {m.excellence ? (
        <div className="summary-card gold mt">
          <span className="trophy-bg">🌟</span>
          <div><b>Insígnia de Excelência</b><div className="muted small">Conquistada pelo membro</div></div>
        </div>
      ) : null}

      <Section title={`Classes concluídas (${m.classes.length})`}>
        {m.classes.length ? (
          <div className="chips" style={{ justifyContent: 'flex-start' }}>
            {m.classes.map((c) => <span key={c.id} className="chip-light">{c.icon} {c.name}</span>)}
          </div>
        ) : <Empty icon="🧭">Nenhuma classe concluída ainda.</Empty>}
      </Section>
      <Section title={`Especialidades (${m.specialties.length})`}>
        {m.specialties.length ? (
          <div className="chips" style={{ justifyContent: 'flex-start' }}>
            {m.specialties.map((c) => <span key={c.id} className="chip-light">{c.icon} {c.name}</span>)}
          </div>
        ) : <Empty icon="🪢">Nenhuma especialidade ainda.</Empty>}
      </Section>
      {m.courses?.length ? (
        <Section title="Cursos concluídos">
          <div className="chips" style={{ justifyContent: 'flex-start' }}>
            {m.courses.map((c) => <span key={c.id} className="chip-light">{c.icon} {c.name}</span>)}
          </div>
        </Section>
      ) : null}
      <Section title="Medalhas e troféus"><MedalList medals={m.medals} /></Section>
      <Section title="Eventos"><EventsList events={m.events} /></Section>
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
      <button className="back-link btn-ghost" style={{ border: 0, background: 'none', cursor: 'pointer', padding: 0 }} onClick={() => history.back()}>← Voltar</button>
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
