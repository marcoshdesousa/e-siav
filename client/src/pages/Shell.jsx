import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { LogOut } from 'lucide-react';
import { Avatar, BackButton, LogoHorizontal } from '../ui.jsx';
import AnnouncementPopup from './Announcement.jsx';

const TYPE_LABEL = { admin: 'Administrador Geral', club: 'Sistema do Clube', unit: 'Portal da Unidade', member: '' };

/**
 * Estrutura de app: cabeçalho + abas na parte de baixo. Fora das abas principais,
 * aparece o botão Voltar (volta para a tela anterior; sem tela anterior, vai para a pasta de cima).
 * parentOf(caminho) diz qual é a pasta de cima de cada tela.
 */
export default function Shell({ tabs, children, hideNav = false, parentOf = null }) {
  const { actor, logout } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const path = pathname.replace(/\/+$/, '') || '/';
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
        <button className="icon-btn" title="Sair" aria-label="Sair" onClick={async () => { await logout(); nav('/'); }}><LogOut size={20} /></button>
      </header>
      <main className={'main' + (hideNav ? ' no-nav' : '')}>
        {!tabs.some((t) => t.to === path) && <BackButton fallback={(parentOf && parentOf(path)) || base} />}
        {children}
      </main>
      {!hideNav && (
        <nav className="bottom-nav" aria-label="Navegação principal">
          <div className="bottom-nav-inner">
            {tabs.map((t) => (
              <NavLink key={t.to} to={t.to} end={t.end}>
                <span className="nav-ico"><t.icon size={22} strokeWidth={2} /></span>
                {t.label}
                {t.badge ? <span className="nav-badge">{t.badge > 99 ? '99+' : t.badge}</span> : null}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
      {actor.type !== 'admin' && <AnnouncementPopup />}
    </div>
  );
}

export function MoreMenu({ items }) {
  return (
    <div className="more-grid">
      {items.map((i) => (
        <Link key={i.to} to={i.to} className="more-tile">
          <span className="tile-ico"><i.icon size={22} /></span>
          {i.label}
          {i.hint && <small>{i.hint}</small>}
        </Link>
      ))}
    </div>
  );
}
