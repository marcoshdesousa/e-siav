import { useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { BookImage, CalendarDays, Camera, ClipboardCheck, Gamepad2, IdCard, LifeBuoy, GraduationCap, Menu, Tent, Trophy, UserRound, BookOpenText, Waypoints, Hourglass, BadgeCheck, Lock, Trash2, UserCog } from 'lucide-react';
import { api, toForm } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Button, Card, Field, Loading, Modal, PageHeader, useAsync, useLoad } from '../../ui.jsx';
import Shell, { MoreMenu } from '../Shell.jsx';
import { InAppProfile, MemberProfileView } from '../Profiles.jsx';
import { RequirementsTodo } from '../Requirements.jsx';
import { ContentDetail, ContentList } from '../Content.jsx';
import RankingHub from '../Ranking.jsx';
import ClubsBrowser from '../Clubs.jsx';
import MyAchievements from './MyAchievements.jsx';
import { AgendaLeitura, ProximasDatas } from '../club/Folders.jsx';
import { EmbeddedSite, SupportChat } from '../Shared.jsx';
import { GamePage, GamesHub } from '../games/GamesHub.jsx';

import { AlbumPage, AlbumsPage } from '../albums/AlbumsHub.jsx';
import { BibleDay, BibleYear, BomDeBiblia, BomDeBibliaPhase, LearningHub, StreakCard } from '../learning/Learning.jsx';
import { MeditationDay, MeditationList, SabbathHub, SabbathLesson } from '../learning/Devotional.jsx';
import PlusPage, { PlusNudge, PlusPicksGate } from './PlusPage.jsx';
import { BomLider, BomLiderLesson } from '../learning/BomLider.jsx';

const base = '/membro';

/** Aba Requisitos: os requisitos e, ao lado, o ranking. */
function RequirementsAndRanking({ isDbv }) {
  const [tab, setTab] = useState(() => { try { return window.sessionStorage.getItem('dbv-req-tab') || 'req'; } catch { return 'req'; } });
  const pick = (t) => { setTab(t); try { window.sessionStorage.setItem('dbv-req-tab', t); } catch { /* sem armazenamento */ } };
  return (
    <>
      <div className="seg req-switch" role="tablist">
        <button type="button" className={tab === 'req' ? 'active' : ''} onClick={() => pick('req')}><ClipboardCheck size={14} /> Requisitos</button>
        <button type="button" className={tab === 'rank' ? 'active' : ''} onClick={() => pick('rank')}><Trophy size={14} /> Ranking</button>
      </div>
      {tab === 'req'
        ? <><PageHeader title="Requisitos" subtitle={isDbv ? 'Cumpra os requisitos e suba no ranking' : 'Requisitos para a liderança'} /><RequirementsTodo originTabs groupTab={isDbv} /></>
        : <RankingHub base={base} />}
    </>
  );
}

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
        <>
        <MemberProfileView
          member={m}
          linkBase={`${base}/ver`}
          extra={<StreakCard base={base} />}
          photoAction={
            <label className="chip yellow" style={{ cursor: 'pointer' }}>
              {busy ? 'Enviando...' : <span className="ico"><Camera size={14} /> Trocar foto</span>}
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && changePhoto(e.target.files[0])} />
            </label>
          }
        />
        <ProximasDatas to={`${base}/agenda`} />
        </>
      )}
    </Loading>
  );
}

/** Membro ainda não liberado pelo clube: qualquer aba mostra só esta mensagem. */
function Waiting({ text }) {
  return (
    <div className="waiting-screen">
      <Hourglass size={48} />
      <h1>{text}</h1>
      <p className="muted">Quando o seu clube liberar, tudo aparece aqui. Não precisa fazer nada.</p>
    </div>
  );
}

/**
 * Conta do App Brasil sem plano: vê o app inteiro, mas nada funciona até assinar.
 * Qualquer toque no conteúdo abre o convite (só os planos e a conta ficam liberados).
 */
function AppLock({ children }) {
  const { actor } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [ask, setAsk] = useState(false);
  if (!actor.app?.locked || pathname.startsWith(`${base}/dbv-mais`) || pathname.startsWith(`${base}/conta`)) return children;
  const stop = (e) => {
    // Só olhar continua liberado: as abas e filtros das telas (e o caminho para os planos e a conta).
    if (e.target.closest?.(`a[href^="${base}/dbv-mais"], a[href^="${base}/conta"], .tabs button, .seg button`)) return;
    e.preventDefault();
    e.stopPropagation();
    setAsk(true);
  };
  return (
    <>
      <Link to={`${base}/dbv-mais`} className="app-lock-bar"><Lock size={16} /><span><b>Libere o seu acesso</b><small>Planos a partir de R$ 3,90 por mês</small></span><span className="app-lock-btn">Ver planos</span></Link>
      <div className="app-locked" onClickCapture={stop} onSubmitCapture={stop}>{children}</div>
      {ask && (
        <Modal title="Assine para usar o app" onClose={() => setAsk(false)} footer={<><Button variant="secondary" onClick={() => setAsk(false)}>Agora não</Button><Button onClick={() => { setAsk(false); nav(`${base}/dbv-mais`); }}>Ver planos</Button></>}>
          <p>Você criou a conta pelo <b>App do DBV</b>, sem clube. Para usar o app é preciso assinar um plano: isso evita contas falsas e ajuda a manter o app no ar.</p>
          <p className="small muted">Com <b>R$ 3,90</b> por mês você usa tudo do plano grátis dos clubes. O <b>DBV+</b> (R$ 7,90) libera todos os benefícios. Faz parte de um clube? Peça o link de inscrição dele: pelo clube é de graça.</p>
        </Modal>
      )}
    </>
  );
}

/** Minha conta: o membro pode apagar a própria conta (de vez), confirmando com a senha. */
function AccountPage() {
  const { actor, logout } = useAuth();
  const nav = useNavigate();
  const [pw, setPw] = useState('');
  const [busy, run] = useAsync();
  const remove = () => {
    if (!confirm('Apagar a sua conta de vez? Os seus pontos, sequências, figurinhas e especialidades somem e não dá para desfazer.')) return;
    run(() => api.post('/me/conta/apagar', { password: pw }), 'Conta apagada').then((r) => { if (r) logout().then(() => nav('/', { replace: true })); });
  };
  return (
    <>
      <PageHeader title="Minha conta" subtitle={`${actor.name} · código ${actor.code}`} />
      <Card>
        <div className="form">
          <p style={{ margin: 0 }}><b>Apagar minha conta</b></p>
          <p className="small muted" style={{ margin: 0 }}>A conta some de vez, com os pontos, as sequências, as figurinhas e as especialidades. Não dá para desfazer.</p>
          <Field label="Sua senha (ano de nascimento)"><input type="password" inputMode="numeric" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          <Button variant="red" busy={busy} disabled={pw.length < 4} onClick={remove}><Trash2 size={16} /> Apagar minha conta</Button>
        </div>
      </Card>
    </>
  );
}

/** Para onde o "Voltar" do topo leva em cada tela. */
function parentOf(path) {
  const [seg, sub, sub2] = path.split('/').slice(2);
  if (seg === 'aprendizagem') return ['meditacao', 'escola-sabatina'].includes(sub) && sub2 ? `${base}/aprendizagem/${sub}` : sub === 'bom-lider' && sub2 ? `${base}/aprendizagem/bom-lider` : sub === 'bom-de-biblia' && sub2 ? `${base}/aprendizagem/bom-de-biblia` : sub === 'ano-biblico' && sub2 ? `${base}/aprendizagem/ano-biblico` :  sub ? `${base}/aprendizagem` : base;
  if ((seg === 'jogos' || seg === 'albuns') && sub) return `${base}/${seg}`;
  if (['cursos', 'clubes', 'agenda', 'suporte', 'especialidades', 'albuns', 'conta'].includes(seg)) return `${base}/mais`;
  return base;
}

export default function MemberApp() {
  const { actor } = useAuth();
  const isDbv = actor.kind === 'desbravador';
  const tabs = [
    { to: base, icon: UserRound, label: 'Perfil', end: true },
    { to: `${base}/requisitos`, icon: ClipboardCheck, label: 'Requisitos' },
    { to: `${base}/aprendizagem`, icon: BookOpenText, label: 'Estudos' },
    { to: `${base}/jogos`, icon: Gamepad2, label: 'Jogos' },
    { to: `${base}/cartao`, icon: IdCard, label: 'Cartão' },
    { to: `${base}/mais`, icon: Menu, label: 'Mais' },
  ];
  const more = [
    { to: `${base}/dbv-mais`, icon: BadgeCheck, label: actor.app ? 'Planos' : 'DBV+', hint: actor.plus ? `Assinante até ${new Date(actor.plus.until).toLocaleDateString('pt-BR')}` : actor.app?.locked ? 'Assine para usar o app' : 'Assine e ganhe benefícios' },
    { to: `${base}/especialidades`, icon: Waypoints, label: 'Especialidades e classes', hint: 'As suas especialidades e classes' },
    { to: `${base}/albuns`, icon: BookImage, label: 'Álbuns de figurinhas', hint: 'Álbum Bíblico' },
    { to: `${base}/agenda`, icon: CalendarDays, label: 'Agenda', hint: 'Datas do clube e do App' },
    { to: `${base}/suporte`, icon: LifeBuoy, label: 'Suporte', hint: 'Fale com a equipe' },
    { to: `${base}/cursos`, icon: GraduationCap, label: 'Cursos', hint: 'Aulas' },
    { to: `${base}/clubes`, icon: Tent, label: 'Clubes', hint: 'Por distrito' },
    { to: `${base}/conta`, icon: UserCog, label: 'Minha conta', hint: 'Apagar a conta' },
  ];
  return (
    <Routes>
      <Route
        path="*"
        element={
          <Shell tabs={tabs} parentOf={parentOf}>
            {!actor.waiting && <PlusNudge to={`${base}/dbv-mais`} />}
            {actor.waiting ? <Waiting text={actor.waiting} /> : actor.plus?.picks_pending ? <PlusPicksGate /> : <AppLock><Routes>
              <Route index element={<MyProfile />} />
              <Route path="requisitos" element={<RequirementsAndRanking isDbv={isDbv} />} />
              <Route path="especialidades" element={<MyAchievements key="e" type="especialidade" />} />
              <Route path="agenda" element={<AgendaLeitura />} />
              <Route path="cartao" element={<EmbeddedSite title="Cartão DBV" linkKey="link_cartao" subtitle="Entre com o código e a senha que o seu clube passar" />} />
              <Route path="suporte" element={<SupportChat />} />
              <Route path="jogos" element={<GamesHub base={base} />} />
              <Route path="jogos/:id" element={<GamePage base={base} />} />
              <Route path="dbv-mais" element={<PlusPage />} />
              <Route path="albuns" element={<AlbumsPage base={base} />} />
              <Route path="albuns/:id" element={<AlbumPage />} />
              <Route path="aprendizagem" element={<LearningHub base={base} />} />
              <Route path="aprendizagem/ano-biblico" element={<BibleYear base={base} />} />
              <Route path="aprendizagem/ano-biblico/:day" element={<BibleDay base={base} />} />
              <Route path="aprendizagem/meditacao" element={<MeditationList base={base} />} />
              <Route path="aprendizagem/meditacao/:date" element={<MeditationDay base={base} />} />
              <Route path="aprendizagem/escola-sabatina" element={<SabbathHub base={base} />} />
              <Route path="aprendizagem/escola-sabatina/:id" element={<SabbathLesson base={base} />} />
              <Route path="aprendizagem/bom-de-biblia" element={<BomDeBiblia base={base} />} />
              <Route path="aprendizagem/bom-lider" element={<BomLider base={base} />} />
              <Route path="aprendizagem/bom-lider/:n" element={<BomLiderLesson base={base} />} />
              <Route path="aprendizagem/bom-de-biblia/:phase" element={<BomDeBibliaPhase base={base} />} />
              <Route path="cursos" element={<ContentList type="curso" base={base} />} />
              <Route path="conteudo/:id" element={<ContentDetail />} />
              <Route path="ranking" element={<Navigate to={`${base}/requisitos`} replace />} />
              <Route path="clubes" element={<ClubsBrowser base={base} />} />
              <Route path="ver/:kind/:id" element={<InAppProfile base={base} />} />
              <Route path="mais" element={<><PageHeader title="Mais" /><MoreMenu items={more} /></>} />
              <Route path="conta" element={<AccountPage />} />
              <Route path="*" element={<Navigate to={base} replace />} />
            </Routes></AppLock>}
          </Shell>
        }
      />
    </Routes>
  );
}
