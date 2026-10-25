import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import ClubSignup from './pages/ClubSignup.jsx';
import { CreateAccount, RegisterClub } from './pages/AppSignup.jsx';
import { AuthProvider, homeFor, useAuth } from './auth.jsx';
import { Notices, Spinner } from './ui.jsx';
import Login from './pages/Login.jsx';
import { ClanLinkPage, MemberLinkPage, PublicProfilePage } from './pages/Profiles.jsx';
import AdminApp from './pages/admin/AdminApp.jsx';
import ClubApp from './pages/club/ClubApp.jsx';
import UnitApp from './pages/unit/UnitApp.jsx';
import MemberApp from './pages/member/MemberApp.jsx';
import { TrophyCertificatePage } from './pages/member/Downloads.jsx';

function Guard({ type, children }) {
  const { actor } = useAuth();
  if (actor === undefined) return <Spinner />;
  if (!actor) return <Navigate to="/" replace />;
  if (actor.type !== type) return <Navigate to={homeFor(actor)} replace />;
  return children;
}

/**
 * /clube/4821 e /clube/4821/2 são os links públicos do clube e das unidades (código de 4 números).
 * O resto de /clube/... é o Sistema do Clube.
 */
function ClubeRoute() {
  const rest = useParams()['*'] || '';
  const [first, second] = rest.split('/');
  if (/^\d{4}$/.test(first || '')) return <ClanLinkPage code={first} n={second} />;
  return <Guard type="club"><ClubApp /></Guard>;
}

/** Endereços antigos (/cla/..., /grupo/...) continuam funcionando. */
function OldPath({ to }) {
  const { pathname, search } = useLocation();
  return <Navigate to={pathname.replace(/^\/[^/]+/, to) + search} replace />;
}

export default function App() {
  return (
    <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/entrar" element={<Login />} />
            <Route path="/p/:kind/:id" element={<PublicProfilePage />} />
            <Route path="/certificado/:id" element={<TrophyCertificatePage />} />
            <Route path="/inscricao/:token" element={<ClubSignup />} />
            <Route path="/inscricao/*" element={<Navigate to="/" replace />} />
            <Route path="/criar-conta" element={<CreateAccount />} />
            <Route path="/registrar-clube" element={<RegisterClub />} />
            <Route path="/criar-clube" element={<Navigate to="/registrar-clube" replace />} />
            <Route path="/criar-cla" element={<Navigate to="/" replace />} />
            <Route path="/termo/*" element={<Navigate to="/" replace />} />
            <Route path="/admin/*" element={<Guard type="admin"><AdminApp /></Guard>} />
            <Route path="/clube/*" element={<ClubeRoute />} />
            <Route path="/unidade/*" element={<Guard type="unit"><UnitApp /></Guard>} />
            <Route path="/cla/*" element={<OldPath to="/clube" />} />
            <Route path="/grupo/*" element={<OldPath to="/unidade" />} />
            <Route path="/membro/*" element={<Guard type="member"><MemberApp /></Guard>} />
            <Route path="/:code" element={<MemberLinkPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Notices />
    </AuthProvider>
  );
}
