import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Gamepad2, LogOut, WifiOff } from 'lucide-react';
import { Avatar, BackButton, Button, LogoHorizontal } from '../ui.jsx';
import { useOnline } from '../offline.js';
import AnnouncementPopup from './Announcement.jsx';
import RankingFinalPopup from './RankingFinal.jsx';

const TYPE_LABEL = { admin: 'Administrador Geral', club: 'Sistema do Clube', unit: 'Portal da Unidade', member: '' };

/**
 * Estrutura de app: cabeçalho + abas na parte de baixo. Fora das abas principais,
 * aparece o botão Voltar (volta para a tela anterior; sem tela anterior, vai para a pasta de cima).
 * parentOf(caminho) diz qual é a pasta de cima de cada tela.
 */
/** Sem internet: o App do DBV só funciona online (quem é DBV+ ainda pode jogar). */
function OfflineNotice({ games }) {
  return (
    <div className="offline-screen">
      <span className="offline-ico"><WifiOff size={40} /></span>
      <h1>Sem internet</h1>
      {games ? (
        <>
          <p className="muted">Esta parte precisa de internet. Como você é DBV+, os jogos funcionam sem internet.</p>
          <div className="offline-actions"><Link to={games}><Button block><Gamepad2 size={18} /> Jogar</Button></Link></div>
        </>
      ) : <p className="muted">O App do DBV precisa de internet para funcionar. Conecte-se e tudo volta sozinho.</p>}
    </div>
  );
}

export default function Shell({ tabs, children, hideNav = false, parentOf = null }) {
  const { actor, logout } = useAuth();
  const online = useOnline();
  const offline = !online || !!actor.offline;
  const nav = useNavigate();
  const { pathname } = useLocation();
  const path = pathname.replace(/\/+$/, '') || '/';
  const base = { admin: '/admin', club: '/clube', unit: '/unidade', member: '/membro' }[actor.type];
  // DBV+ sem internet: os jogos continuam funcionando.
  const games = actor.type === 'member' && actor.plus ? `${base}/jogos` : null;
  const gamesOk = games && (path === games || path.startsWith(games + '/'));
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
      {offline && <div className="offline-bar"><WifiOff size={15} /> Sem internet: {games ? 'os jogos funcionam (DBV+).' : 'conecte-se para continuar.'}</div>}
      <main className={'main' + (hideNav ? ' no-nav' : '')}>
        {!tabs.some((t) => t.to === path) && <BackButton fallback={(parentOf && parentOf(path)) || base} />}
        {offline && !gamesOk ? <OfflineNotice games={games} /> : children}
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
      {actor.type !== 'admin' && !offline && <AnnouncementPopup />}
      {actor.type !== 'admin' && !offline && <RankingFinalPopup />}
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
