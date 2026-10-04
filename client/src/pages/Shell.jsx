import { NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useRealtime } from '../realtime.jsx';
import { Avatar, LogoHorizontal } from '../ui.jsx';

const TYPE_LABEL = { admin: 'Administrador Geral', club: 'Sistema do Clube', unit: 'Portal da Unidade', member: '' };

/** Estrutura de app: cabeçalho azul + abas na parte de baixo. */
export default function Shell({ tabs, children, hideNav = false }) {
  const { actor, logout } = useAuth();
  const { toast, setToast } = useRealtime();
  const nav = useNavigate();
  const base = { admin: '/admin', club: '/clube', unit: '/unidade', member: '/membro' }[actor.type];
  const subtitle = actor.type === 'member' ? actor.club_name : actor.type === 'unit' ? actor.club_name : TYPE_LABEL[actor.type];

  return (
    <div className="app">
      <header className="topbar">
        <Link to={base} aria-label="Início"><LogoHorizontal light size={34} /></Link>
        <div className="who">
          <b className="ellipsis">{actor.name}</b>
          <span className="ellipsis">{subtitle}</span>
        </div>
        <Avatar src={actor.photo || actor.logo} name={actor.name} size={34} />
        <button className="btn btn-sm btn-secondary" style={{ padding: ".35rem .6rem" }} onClick={async () => { await logout(); nav("/entrar"); }}>Sair</button>
      </header>
      <main className={'main' + (hideNav ? ' no-nav' : '')}>{children}</main>
      {!hideNav && (
        <nav className="bottom-nav" aria-label="Navegação principal">
          <div className="bottom-nav-inner">
            {tabs.map((t) => (
              <NavLink key={t.to} to={t.to} end={t.end}>
                <span className="nav-ico">{t.icon}</span>
                {t.label}
                {t.badge ? <span className="nav-badge">{t.badge > 99 ? '99+' : t.badge}</span> : null}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
      {toast && (
        <div className="chat-toast" onClick={() => { setToast(null); nav(`${base}/chat/${toast.conversation_id}`); }}>
          <span style={{ fontSize: '1.4rem' }}>💬</span>
          <div className="grow">
            <b className="ellipsis" style={{ display: 'block' }}>{toast.who}</b>
            <span className="muted ellipsis" style={{ display: 'block' }}>{toast.text}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function MoreMenu({ items }) {
  return (
    <div className="more-grid">
      {items.map((i) => (
        <Link key={i.to} to={i.to} className="more-tile">
          <span>{i.icon}</span>
          {i.label}
          {i.hint && <small>{i.hint}</small>}
        </Link>
      ))}
    </div>
  );
}
