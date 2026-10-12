import { useState } from 'react';
import { CalendarDays, ClipboardCheck, ClipboardPlus, Flag, Trophy } from 'lucide-react';
import { AgendaLeitura, ProximasDatas } from '../club/Folders.jsx';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Button, Card, Loading, PageHeader, Section, Tabs, useAsync, useLoad } from '../../ui.jsx';
import Shell from '../Shell.jsx';
import { InAppProfile, UnitProfileView } from '../Profiles.jsx';
import { CreatedRequirements, RequirementsTodo, ReviewsPanel } from '../Requirements.jsx';
import RankingHub from '../Ranking.jsx';

const base = '/grupo';

/** Perfil do grupo: o grupo escreve a biografia; nome, logo e membros são do clã. */
function BioForm({ bio, onDone }) {
  const [text, setText] = useState(bio || '');
  const [busy, run] = useAsync();
  return (
    <Section title="Sobre o grupo">
      <Card>
        <div className="form">
          <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Conte quem é o grupo: grito de guerra, conquistas, o que vocês gostam de fazer..." />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button busy={busy} disabled={text === (bio || '')} onClick={() => run(() => api.put('/me/bio', { bio: text }), 'Biografia salva!').then(onDone)}>Salvar</Button>
          </div>
        </div>
      </Card>
    </Section>
  );
}

function UnitProfile() {
  const state = useLoad(() => api.get('/me/profile'));
  return (
    <Loading {...state}>
      {(u) => (
        <>
          <UnitProfileView unit={u} linkBase={`${base}/ver`} hideBio extra={<><ProximasDatas to={`${base}/agenda`} /><BioForm bio={u.bio} onDone={state.reload} /></>} />
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

/** Portal do Grupo: abre no perfil; cumpre requisitos em grupo e cria requisitos para os exploradores do grupo. */
export default function UnitApp() {
  const { pathname } = useLocation();
  const { actor } = useAuth();
  // O grupo Tutores não cumpre requisitos de grupo nem entra no ranking de grupos.
  const lid = !!actor.is_leadership;
  // Bolinha com o número de requisitos em aberto (atualiza a cada troca de tela).
  const reqs = useLoad(() => (lid ? Promise.resolve([]) : api.get('/requirements/mine')), [pathname]);
  const abertos = (reqs.data || []).filter((r) => ['pendente', 'fora_do_prazo', 'recusado'].includes(r.state)).length;
  const tabs = [
    { to: base, icon: Flag, label: 'Perfil', end: true },
    ...(lid ? [] : [
      { to: `${base}/requisitos`, icon: ClipboardCheck, label: 'Requisitos', badge: abertos },
      { to: `${base}/exploradores`, icon: ClipboardPlus, label: 'Criar' },
    ]),
    { to: `${base}/ranking`, icon: Trophy, label: 'Ranking' },
    { to: `${base}/agenda`, icon: CalendarDays, label: 'Agenda' },
  ];
  return (
    <Shell tabs={tabs}>
      <Routes>
        <Route index element={<UnitProfile />} />
        <Route path="requisitos" element={<><PageHeader title="Requisitos do grupo" subtitle="Cumpram juntos dentro do prazo e subam no ranking" /><RequirementsTodo originTabs clubLabel="Do clã" /></>} />
        <Route path="exploradores" element={<GroupRequirements />} />
        <Route path="ranking" element={<RankingHub base={base} />} />
        <Route path="agenda" element={<AgendaLeitura />} />
        <Route path="perfil" element={<Navigate to={base} replace />} />
        <Route path="ver/:kind/:id" element={<InAppProfile base={base} />} />
        <Route path="*" element={<Navigate to={base} replace />} />
      </Routes>
    </Shell>
  );
}
