import { Navigate, Route, Routes } from 'react-router-dom';
import {
  Camera, ClipboardCheck, GraduationCap, Menu, Tent, Trophy, UserRound, Waypoints, Hourglass,
} from 'lucide-react';
import { api, toForm } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Loading, PageHeader, useAsync, useLoad } from '../../ui.jsx';
import Shell, { MoreMenu } from '../Shell.jsx';
import { InAppProfile, MemberProfileView } from '../Profiles.jsx';
import { RequirementsTodo } from '../Requirements.jsx';
import { ContentDetail, ContentList } from '../Content.jsx';
import RankingHub from '../Ranking.jsx';
import ClubsBrowser from '../Clubs.jsx';
import MyAchievements from './MyAchievements.jsx';

const base = '/membro';

function MyProfile() {
  const { refresh } = useAuth();
  const state = useLoad(() => api.get('/me/profile'));
  const [busy, run] = useAsync();
  // O membro só troca a própria foto; os demais dados são editados pelo clã.
  const changePhoto = async (file) => {
    await run(() => api.put('/me/photo', toForm({ photo: file })), 'Foto atualizada!');
    state.reload();
    refresh();
  };
  return (
    <Loading {...state}>
      {(m) => (
        <>
        <MemberProfileView
          member={m}
          linkBase={`${base}/ver`}
          photoAction={
            <label className="chip yellow" style={{ cursor: 'pointer' }}>
              {busy ? 'Enviando...' : <span className="ico"><Camera size={14} /> Trocar foto</span>}
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && changePhoto(e.target.files[0])} />
            </label>
          }
        />
        </>
      )}
    </Loading>
  );
}

/** Membro ainda não liberado pelo clã: qualquer aba mostra só esta mensagem. */
function Waiting({ text }) {
  return (
    <div className="waiting-screen">
      <Hourglass size={48} />
      <h1>{text}</h1>
      <p className="muted">Quando o seu clã liberar, tudo aparece aqui. Não precisa fazer nada.</p>
    </div>
  );
}

export default function MemberApp() {
  const { actor } = useAuth();
  const isDbv = actor.kind === 'desbravador';
  const tabs = [
    { to: base, icon: UserRound, label: 'Perfil', end: true },
    { to: `${base}/requisitos`, icon: ClipboardCheck, label: 'Requisitos' },
    { to: `${base}/ranking`, icon: Trophy, label: 'Ranking' },
    { to: `${base}/especialidades`, icon: Waypoints, label: 'Insígnias' },
    { to: `${base}/mais`, icon: Menu, label: 'Mais' },
  ];
  const more = [
    { to: `${base}/cursos`, icon: GraduationCap, label: 'Cursos', hint: 'Aulas' },
    { to: `${base}/clas`, icon: Tent, label: 'Clãs', hint: 'Por distrito' },
  ];
  return (
    <Routes>
      <Route
        path="*"
        element={
          <Shell tabs={tabs}>
            {actor.waiting ? <Waiting text={actor.waiting} /> : <Routes>
              <Route index element={<MyProfile />} />
              <Route path="requisitos" element={<><PageHeader title="Requisitos" subtitle={isDbv ? 'Cumpra os requisitos e suba no ranking' : 'Requisitos para a liderança e os tutores'} /><RequirementsTodo originTabs groupTab={isDbv} /></>} />
              <Route path="especialidades" element={<MyAchievements key="e" type="especialidade" />} />
              <Route path="cursos" element={<ContentList type="curso" base={base} />} />
              <Route path="conteudo/:id" element={<ContentDetail />} />
              <Route path="ranking" element={<RankingHub base={base} />} />
              <Route path="clas" element={<ClubsBrowser base={base} />} />
              <Route path="ver/:kind/:id" element={<InAppProfile base={base} />} />
              <Route path="mais" element={<><PageHeader title="Mais" /><MoreMenu items={more} /></>} />
              <Route path="*" element={<Navigate to={base} replace />} />
            </Routes>}
          </Shell>
        }
      />
    </Routes>
  );
}
