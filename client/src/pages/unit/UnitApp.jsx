import { Navigate, Route, Routes } from 'react-router-dom';
import { api } from '../../api.js';
import { Loading, PageHeader, useLoad } from '../../ui.jsx';
import Shell from '../Shell.jsx';
import { InAppProfile, UnitProfileView } from '../Profiles.jsx';
import { RequirementsTodo } from '../Requirements.jsx';
import RankingHub from '../Ranking.jsx';
import ClubsBrowser from '../Clubs.jsx';

const base = '/unidade';

function UnitProfile() {
  const state = useLoad(() => api.get('/me/profile'));
  return (
    <Loading {...state}>
      {(u) => (
        <>
          <UnitProfileView unit={u} linkBase={`${base}/ver`} />
          <p className="muted small center mt">Nome, logo e membros da unidade são cadastrados pelo clube.</p>
        </>
      )}
    </Loading>
  );
}

/** Portal da Unidade: cumpre requisitos em grupo para subir no ranking. */
export default function UnitApp() {
  const tabs = [
    { to: base, icon: '✅', label: 'Requisitos', end: true },
    { to: `${base}/ranking`, icon: '🏆', label: 'Ranking' },
    { to: `${base}/perfil`, icon: '🚩', label: 'Perfil' },
    { to: `${base}/clubes`, icon: '🏕️', label: 'Clubes' },
  ];
  return (
    <Shell tabs={tabs}>
      <Routes>
        <Route index element={<><PageHeader title="Requisitos da unidade" subtitle="Cumpram juntos dentro do prazo e subam no ranking" /><RequirementsTodo groupByOrigin /></>} />
        <Route path="ranking" element={<RankingHub base={base} />} />
        <Route path="perfil" element={<UnitProfile />} />
        <Route path="clubes" element={<ClubsBrowser base={base} />} />
        <Route path="ver/:kind/:id" element={<InAppProfile base={base} />} />
        <Route path="*" element={<Navigate to={base} replace />} />
      </Routes>
    </Shell>
  );
}
