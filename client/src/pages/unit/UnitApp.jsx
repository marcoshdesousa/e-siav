import { useState } from 'react';
import { Award, ClipboardCheck, Flag, Frame as FrameIcon, LifeBuoy, Menu, Tent, Trophy } from 'lucide-react';
import { FramesPage } from '../../frames.jsx';
import { GroupCertificatesPage } from '../Certificates.jsx';
import { EmbeddedSite, SupportChat } from '../Shared.jsx';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Button, Card, Loading, PageHeader, Section, useAsync, useLoad } from '../../ui.jsx';
import Shell, { MoreMenu } from '../Shell.jsx';
import { InAppProfile, UnitProfileView } from '../Profiles.jsx';
import { RequirementsTodo } from '../Requirements.jsx';
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
          <UnitProfileView unit={u} linkBase={`${base}/ver`} hideBio extra={<BioForm bio={u.bio} onDone={state.reload} />} frameAction={<Link to={`${base}/molduras`} className="chip yellow"><span className="ico"><FrameIcon size={14} /> Molduras</span></Link>} />
          <p className="muted small center mt">Nome, logo e membros da unidade são cadastrados pelo clube.</p>
        </>
      )}
    </Loading>
  );
}

/** Portal da Unidade: abre no perfil (foto e recado) e cumpre os requisitos de unidade. Não cria requisitos. */
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
    { to: `${base}/certificados`, icon: Award, label: 'Certificados', hint: 'De honra da unidade' },
    { to: `${base}/suporte`, icon: LifeBuoy, label: 'Suporte', hint: 'Fale com a equipe' },
  ];
  return (
    <Shell tabs={tabs} parentOf={(path) => (['certificados', 'suporte'].includes(path.split('/')[2]) ? `${base}/mais` : base)}>
      <Routes>
        <Route path="cantinho" element={<EmbeddedSite title="Cantinho da Unidade" linkKey="link_cantinho" subtitle="Relatórios e atividades da unidade" />} />
        <Route path="certificados" element={<GroupCertificatesPage />} />
        <Route path="suporte" element={<SupportChat />} />
        <Route path="molduras" element={<FramesPage photo={actor.logo} name={actor.name} square />} />
        <Route path="mais" element={<><PageHeader title="Mais" /><MoreMenu items={more} /></>} />
        <Route index element={<UnitProfile />} />
        <Route path="requisitos" element={<><PageHeader title="Requisitos da unidade" subtitle="Cumpram juntos dentro do prazo e subam no ranking" /><RequirementsTodo originTabs clubLabel="Do clube" /></>} />
        <Route path="ranking" element={<RankingHub base={base} />} />
        <Route path="perfil" element={<Navigate to={base} replace />} />
        <Route path="ver/:kind/:id" element={<InAppProfile base={base} />} />
        <Route path="*" element={<Navigate to={base} replace />} />
      </Routes>
    </Shell>
  );
}
