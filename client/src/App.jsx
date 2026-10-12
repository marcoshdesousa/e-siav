import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { AuthProvider, homeFor, useAuth } from './auth.jsx';
import { Notices, Spinner } from './ui.jsx';
import Login from './pages/Login.jsx';
import SignupPage from './pages/Signup.jsx';
import CreateClanPage from './pages/CreateClan.jsx';
import TermoPage from './pages/Termo.jsx';
import { ClanLinkPage, MemberLinkPage, PublicProfilePage } from './pages/Profiles.jsx';
import AdminApp from './pages/admin/AdminApp.jsx';
import ClubApp from './pages/club/ClubApp.jsx';
import UnitApp from './pages/unit/UnitApp.jsx';
import MemberApp from './pages/member/MemberApp.jsx';

function Guard({ type, children }) {
  const { actor } = useAuth();
  if (actor === undefined) return <Spinner />;
  if (!actor) return <Navigate to="/" replace />;
  if (actor.type !== type) return <Navigate to={homeFor(actor)} replace />;
  return children;
}

/**
 * /cla/4821 e /cla/4821/2 são os links públicos do clã e dos grupos (código de 4 números).
 * O resto de /cla/... é o Sistema do Clã.
 */
function ClaRoute() {
  const rest = useParams()['*'] || '';
  const [first, second] = rest.split('/');
  if (/^\d{4}$/.test(first || '')) return <ClanLinkPage code={first} n={second} />;
  return <Guard type="club"><ClubApp /></Guard>;
}

/** Endereços antigos (/clube/..., /unidade/...) continuam funcionando. */
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
            <Route path="/inscricao/:code" element={<SignupPage />} />
            <Route path="/criar-cla" element={<CreateClanPage />} />
            <Route path="/termo/:token" element={<TermoPage />} />
            <Route path="/admin/*" element={<Guard type="admin"><AdminApp /></Guard>} />
            <Route path="/cla/*" element={<ClaRoute />} />
            <Route path="/grupo/*" element={<Guard type="unit"><UnitApp /></Guard>} />
            <Route path="/clube/*" element={<OldPath to="/cla" />} />
            <Route path="/unidade/*" element={<OldPath to="/grupo" />} />
            <Route path="/membro/*" element={<Guard type="member"><MemberApp /></Guard>} />
            <Route path="/:code" element={<MemberLinkPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Notices />
    </AuthProvider>
  );
}
