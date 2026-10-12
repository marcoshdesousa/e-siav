import { useState } from 'react';
import { ClipboardCheck, ClipboardPlus, Flag, Tent, Trophy } from 'lucide-react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api } from '../../api.js';
import { Loading, PageHeader, Tabs, useLoad } from '../../ui.jsx';
import Shell from '../Shell.jsx';
import { InAppProfile, UnitProfileView } from '../Profiles.jsx';
import { CreatedRequirements, RequirementsTodo, ReviewsPanel } from '../Requirements.jsx';
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
          <p className="muted small center mt">Nome, logo e membros do grupo são cadastrados pelo clã.</p>
        </>
      )}
    </Loading>
  );
}

/** O padrinho cria requisitos para os exploradores do grupo e avalia os envios. */
function GroupRequirements() {
  const [tab, setTab] = useState('criados');
  return (
    <>
      <PageHeader title="Para os exploradores" subtitle="Requisitos que o grupo cria para os próprios exploradores" />
      <Tabs tabs={[['criados', 'Criados pelo grupo'], ['avaliar', 'Avaliar']]} value={tab} onChange={setTab} />
      {tab === 'criados' ? <CreatedRequirements /> : <ReviewsPanel />}
    </>
  );
}

/** Portal do Grupo: cumpre requisitos em grupo e cria requisitos para os exploradores do grupo. */
export default function UnitApp() {
  const tabs = [
    { to: base, icon: ClipboardCheck, label: 'Requisitos', end: true },
    { to: `${base}/exploradores`, icon: ClipboardPlus, label: 'Criar' },
    { to: `${base}/ranking`, icon: Trophy, label: 'Ranking' },
    { to: `${base}/perfil`, icon: Flag, label: 'Perfil' },
    { to: `${base}/clubes`, icon: Tent, label: 'Clãs' },
  ];
  return (
    <Shell tabs={tabs}>
      <Routes>
        <Route index element={<><PageHeader title="Requisitos do grupo" subtitle="Cumpram juntos dentro do prazo e subam no ranking" /><RequirementsTodo originTabs clubLabel="Do clã" /></>} />
        <Route path="exploradores" element={<GroupRequirements />} />
        <Route path="ranking" element={<RankingHub base={base} />} />
        <Route path="perfil" element={<UnitProfile />} />
        <Route path="clubes" element={<ClubsBrowser base={base} />} />
        <Route path="ver/:kind/:id" element={<InAppProfile base={base} />} />
        <Route path="*" element={<Navigate to={base} replace />} />
      </Routes>
    </Shell>
  );
}
