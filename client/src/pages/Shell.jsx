import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { BookImage, Gamepad2, LogOut, WifiOff } from 'lucide-react';
import { Avatar, BackButton, Button, LogoHorizontal } from '../ui.jsx';
import { useOnline } from '../offline.js';
import AnnouncementPopup from './Announcement.jsx';

const TYPE_LABEL = { admin: 'Administrador Geral', club: 'Sistema do Clube', unit: 'Portal da Unidade', member: '' };

/**
 * Estrutura de app: cabeçalho + abas na parte de baixo. Fora das abas principais,
 * aparece o botão Voltar (volta para a tela anterior; sem tela anterior, vai para a pasta de cima).
 * parentOf(caminho) diz qual é a pasta de cima de cada tela.
 */
/** Tela "precisa de internet" (sem internet, só os jogos e colar figurinhas funcionam). */
function OfflineNotice({ base, member }) {
  return (
    <div className="offline-screen">
      <span className="offline-ico"><WifiOff size={40} /></span>
      <h1>Sem internet</h1>
      <p className="muted">Esta parte do app precisa de internet.{member ? ' Enquanto isso, dá para jogar os mini jogos e colar as figurinhas que você já tem.' : ''}</p>
      {member && (
        <div className="offline-actions">
          <Link to={`${base}/jogos`}><Button block><Gamepad2 size={18} /> Jogar</Button></Link>
          <Link to={`${base}/albuns/biblico`}><Button block variant="secondary"><BookImage size={18} /> Meu álbum</Button></Link>
        </div>
      )}
    </div>
  );
}

/**
 * offlineOk(caminho): telas que funcionam sem internet (as outras mostram "Sem internet").
 */
export default function Shell({ tabs, children, hideNav = false, parentOf = null, offlineOk = null }) {
  const { actor, logout } = useAuth();
  const online = useOnline();
  const offline = !online || !!actor.offline;
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
      {offline && online && actor.offline ? (
        <div className="offline-bar back">
          A internet voltou: entre de novo para salvar o que você fez.
          <button type="button" onClick={async () => { await logout(); nav('/'); }}>Entrar</button>
        </div>
      ) : offline && <div className="offline-bar"><WifiOff size={15} /> Sem internet: {actor.type === 'member' ? 'dá para jogar e colar figurinhas.' : 'conecte-se para continuar.'}</div>}
      <main className={'main' + (hideNav ? ' no-nav' : '')}>
        {!tabs.some((t) => t.to === path) && <BackButton fallback={(parentOf && parentOf(path)) || base} />}
        {offline && !(offlineOk && offlineOk(path)) ? <OfflineNotice base={base} member={actor.type === 'member'} /> : children}
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
