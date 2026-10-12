import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, homeFor, useAuth } from './auth.jsx';
import { Notices, Spinner } from './ui.jsx';
import Login from './pages/Login.jsx';
import SignupPage from './pages/Signup.jsx';
import CreateClanPage from './pages/CreateClan.jsx';
import TermoPage from './pages/Termo.jsx';
import { MemberLinkPage, PublicProfilePage } from './pages/Profiles.jsx';
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
            <Route path="/clube/*" element={<Guard type="club"><ClubApp /></Guard>} />
            <Route path="/unidade/*" element={<Guard type="unit"><UnitApp /></Guard>} />
            <Route path="/membro/*" element={<Guard type="member"><MemberApp /></Guard>} />
            <Route path="/:code" element={<MemberLinkPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Notices />
    </AuthProvider>
  );
}
