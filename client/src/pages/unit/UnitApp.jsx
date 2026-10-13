import { useState } from 'react';
import { CalendarDays, ClipboardCheck, ClipboardPlus, Flag, LifeBuoy, Menu, Tent, Trophy } from 'lucide-react';
import { EmbeddedSite, SupportChat } from '../Shared.jsx';
import { AgendaLeitura, ProximasDatas } from '../club/Folders.jsx';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Button, Card, Loading, PageHeader, Section, Tabs, useAsync, useLoad } from '../../ui.jsx';
import Shell, { MoreMenu } from '../Shell.jsx';
import { InAppProfile, UnitProfileView } from '../Profiles.jsx';
import { CreatedRequirements, RequirementsTodo, ReviewsPanel } from '../Requirements.jsx';
import RankingHub from '../Ranking.jsx';

const base = '/unidade';

/** Perfil da unidade: a unidade escreve a biografia; nome, logo e membros são do clube. */
function BioForm({ bio, onDone }) {
  const [text, setText] = useState(bio || '');
  const [busy, run] = useAsync();
  return (
    <Section title="Sobre a unidade">
      <Card>
        <div className="form">
          <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Conte quem é a unidade: grito de guerra, conquistas, o que vocês gostam de fazer..." />
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
          <p className="muted small center mt">Nome, logo e membros da unidade são cadastrados pelo clube.</p>
        </>
      )}
    </Loading>
  );
}

/** O conselheiro cria requisitos para os desbravadores da unidade e avalia os envios. */
function GroupRequirements() {
  const [tab, setTab] = useState('criados');
  return (
    <>
      <PageHeader title="Para os desbravadores" subtitle="Requisitos que a unidade cria para os próprios desbravadores" />
      <Tabs tabs={[['criados', 'Criados pela unidade'], ['avaliar', 'Avaliar']]} value={tab} onChange={setTab} />
      {tab === 'criados' ? <CreatedRequirements /> : <ReviewsPanel />}
    </>
  );
}

/** Portal da Unidade: abre no perfil; cumpre requisitos em unidade e cria requisitos para os desbravadores da unidade. */
export default function UnitApp() {
  const { pathname } = useLocation();
  const { actor } = useAuth();
  // A unidade Liderança não cumpre requisitos de unidade nem entra no ranking de unidades.
  const lid = !!actor.is_leadership;
  // Bolinha com o número de requisitos em aberto (atualiza a cada troca de tela).
  const reqs = useLoad(() => (lid ? Promise.resolve([]) : api.get('/requirements/mine')), [pathname]);
  const abertos = (reqs.data || []).filter((r) => ['pendente', 'fora_do_prazo', 'recusado'].includes(r.state)).length;
  const tabs = [
    { to: base, icon: Flag, label: 'Perfil', end: true },
    ...(lid ? [] : [{ to: `${base}/requisitos`, icon: ClipboardCheck, label: 'Requisitos', badge: abertos }]),
    { to: `${base}/ranking`, icon: Trophy, label: 'Ranking' },
    { to: `${base}/cantinho`, icon: Tent, label: 'Cantinho' },
    { to: `${base}/mais`, icon: Menu, label: 'Mais' },
  ];
  const more = [
    ...(lid ? [] : [{ to: `${base}/exploradores`, icon: ClipboardPlus, label: 'Criar requisitos', hint: 'Para os desbravadores da unidade' }]),
    { to: `${base}/agenda`, icon: CalendarDays, label: 'Agenda', hint: 'Datas do clube e do App' },
    { to: `${base}/suporte`, icon: LifeBuoy, label: 'Suporte', hint: 'Fale com a equipe' },
  ];
  return (
    <Shell tabs={tabs} parentOf={(path) => (['exploradores', 'agenda', 'suporte'].includes(path.split('/')[2]) ? `${base}/mais` : base)}>
      <Routes>
        <Route path="cantinho" element={<EmbeddedSite title="Cantinho da Unidade" linkKey="link_cantinho" subtitle="Relatórios e atividades da unidade" />} />
        <Route path="suporte" element={<SupportChat />} />
        <Route path="mais" element={<><PageHeader title="Mais" /><MoreMenu items={more} /></>} />
        <Route index element={<UnitProfile />} />
        <Route path="requisitos" element={<><PageHeader title="Requisitos da unidade" subtitle="Cumpram juntos dentro do prazo e subam no ranking" /><RequirementsTodo originTabs clubLabel="Do clube" /></>} />
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
