import { Navigate, Route, Routes } from 'react-router-dom';
import { api, toForm } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { useRealtime } from '../../realtime.jsx';
import { Loading, PageHeader, useAsync, useLoad } from '../../ui.jsx';
import Shell, { MoreMenu } from '../Shell.jsx';
import { InAppProfile, MemberProfileView } from '../Profiles.jsx';
import { RequirementsTodo } from '../Requirements.jsx';
import { ContentDetail, ContentList } from '../Content.jsx';
import RankingHub from '../Ranking.jsx';
import ClubsBrowser from '../Clubs.jsx';
import { ChatConversation, ChatHome } from '../Chat.jsx';

const base = '/membro';

function MyProfile() {
  const { refresh } = useAuth();
  const state = useLoad(() => api.get('/me/profile'));
  const [busy, run] = useAsync();
  // O membro só troca a própria foto; os demais dados são editados pelo clube.
  const changePhoto = async (file) => {
    await run(() => api.put('/me/photo', toForm({ photo: file })), 'Foto atualizada!');
    state.reload();
    refresh();
  };
  return (
    <Loading {...state}>
      {(m) => (
        <MemberProfileView
          member={m}
          linkBase={`${base}/ver`}
          photoAction={
            <label className="chip yellow" style={{ cursor: 'pointer' }}>
              {busy ? 'Enviando...' : '📷 Trocar foto'}
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && changePhoto(e.target.files[0])} />
            </label>
          }
        />
      )}
    </Loading>
  );
}

export default function MemberApp() {
  const { actor } = useAuth();
  const { unread } = useRealtime();
  const isDbv = actor.kind === 'desbravador';
  const tabs = [
    { to: base, icon: '🧑', label: 'Perfil', end: true },
    isDbv ? { to: `${base}/requisitos`, icon: '✅', label: 'Requisitos' } : { to: `${base}/classes`, icon: '🧭', label: 'Classes' },
    { to: `${base}/ranking`, icon: '🏆', label: 'Ranking' },
    { to: `${base}/chat`, icon: '💬', label: 'Chat', badge: unread },
    { to: `${base}/mais`, icon: '☰', label: 'Mais' },
  ];
  const more = [
    { to: `${base}/especialidades`, icon: '🪢', label: 'Especialidades', hint: 'Faça online' },
    { to: `${base}/classes`, icon: '🧭', label: 'Classes', hint: isDbv ? 'Sua classe e outras' : 'Regulares e de líder' },
    { to: `${base}/cursos`, icon: '🎓', label: 'Cursos', hint: 'Aulas' },
    { to: `${base}/clubes`, icon: '🏕️', label: 'Clubes', hint: 'Por distrito' },
  ];
  return (
    <Routes>
      <Route path="chat/:id" element={<ChatConversation base={base} />} />
      <Route
        path="*"
        element={
          <Shell tabs={tabs}>
            <Routes>
              <Route index element={<MyProfile />} />
              <Route path="requisitos" element={isDbv ? <><PageHeader title="Requisitos" subtitle="Cumpra os requisitos e suba no ranking" /><RequirementsTodo /></> : <Navigate to={base} replace />} />
              <Route path="especialidades" element={<ContentList type="especialidade" base={base} />} />
              <Route path="classes" element={<ContentList type="classe" base={base} />} />
              <Route path="cursos" element={<ContentList type="curso" base={base} />} />
              <Route path="conteudo/:id" element={<ContentDetail />} />
              <Route path="ranking" element={<RankingHub base={base} />} />
              <Route path="clubes" element={<ClubsBrowser base={base} />} />
              <Route path="chat" element={<ChatHome base={base} />} />
              <Route path="ver/:kind/:id" element={<InAppProfile base={base} />} />
              <Route path="mais" element={<><PageHeader title="Mais" /><MoreMenu items={more} /></>} />
              <Route path="*" element={<Navigate to={base} replace />} />
            </Routes>
          </Shell>
        }
      />
    </Routes>
  );
}
