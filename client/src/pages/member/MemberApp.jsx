import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Award, BookImage, Camera, ClipboardCheck, Gamepad2, IdCard, LifeBuoy, Menu, Tent, Trophy, UserRound, BookOpenText, Hourglass, BadgeCheck, Lock, Bell, X } from 'lucide-react';
import { api, toForm } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Button, Card, Loading, Modal, PageHeader, notify, useAsync, useLoad } from '../../ui.jsx';
import Shell, { MoreMenu } from '../Shell.jsx';
import { InAppProfile, MemberProfileView } from '../Profiles.jsx';
import { RequirementsTodo } from '../Requirements.jsx';
import RankingHub from '../Ranking.jsx';
import ClubsBrowser from '../Clubs.jsx';
import { EmbeddedSite, SupportChat } from '../Shared.jsx';
import { GamePage, GamesHub } from '../games/GamesHub.jsx';

import { AlbumPage, AlbumsPage } from '../albums/AlbumsHub.jsx';
import { BibleDay, BibleYear, BomDeBiblia, BomDeBibliaPhase, LearningHub, StreakCard } from '../learning/Learning.jsx';
import { MeditationDay, MeditationList, SabbathHub, SabbathLesson } from '../learning/Devotional.jsx';
import { CertificatesPage, MemberCertificate } from '../Certificates.jsx';
import PlusPage, { PlusNudge } from './PlusPage.jsx';
import { BomLider, BomLiderLesson } from '../learning/BomLider.jsx';
import { HandleField } from '../AppSignup.jsx';
import { enablePush, installedApp, pushSupported, syncPush } from '../../push.js';

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
  const { actor, refresh } = useAuth();
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
        <PushCard />
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
        {/* Conta antiga sem @: cria aqui (quem já tem vê no "Ver meu @ e código"). */}
        {!actor.handle && <HandleCard />}
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
 * Liderança (16 anos ou mais) sem plano: vê o app inteiro, mas nada funciona até assinar.
 * Qualquer toque no conteúdo abre o convite (só os planos ficam liberados).
 */
function AppLock({ children }) {
  const { actor } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [ask, setAsk] = useState(false);
  if (!actor.access?.locked || pathname.startsWith(`${base}/dbv-mais`)) return children;
  const title = actor.access.trial_ended ? 'O seu teste grátis terminou' : 'O seu acesso terminou';
  const stop = (e) => {
    // Só olhar continua liberado: as abas e filtros das telas (e o caminho para os planos).
    if (e.target.closest?.(`a[href^="${base}/dbv-mais"], .tabs button, .seg button`)) return;
    e.preventDefault();
    e.stopPropagation();
    setAsk(true);
  };
  return (
    <>
      <Link to={`${base}/dbv-mais`} className="app-lock-bar"><Lock size={16} /><span><b>{title}</b><small>Assine o DBV ou o DBV+ para continuar</small></span><span className="app-lock-btn">Ver planos</span></Link>
      <div className="app-locked" onClickCapture={stop} onSubmitCapture={stop}>{children}</div>
      {ask && (
        <Modal title="Assine para continuar" onClose={() => setAsk(false)} footer={<><Button variant="secondary" onClick={() => setAsk(false)}>Agora não</Button><Button onClick={() => { setAsk(false); nav(`${base}/dbv-mais`); }}>Ver planos</Button></>}>
          <p>{actor.access.trial_ended ? 'O seu teste grátis de 7 dias' : 'O seu acesso ao'} <b>App do DBV</b> terminou. Para a liderança (16 anos ou mais), o app é assinado. Não perca as suas sequências e o seu lugar no ranking!</p>
          <p className="small muted">Com o <b>DBV</b> (R$ 1,90) você continua lendo a Bíblia todo dia e subindo no ranking. O <b>DBV+</b> (R$ 3,90) libera todos os benefícios: todos os jogos, Bom Líder, figurinhas em triplo e o selo de verificado.</p>
        </Modal>
      )}
    </>
  );
}

/** O @ do membro: cria uma vez (não muda depois) e entra com ele no lugar do código. */
function HandleCard() {
  const { actor, refresh } = useAuth();
  const [h, setH] = useState('');
  const [busy, run] = useAsync();
  const save = () => {
    if (!confirm(`Criar o @${h.replace(/^@/, '')}? Depois de criado ele não pode ser trocado.`)) return;
    run(() => api.post('/me/arroba', { handle: h }), 'Seu @ foi criado!').then((r) => r && refresh());
  };
  return (
    <Card style={{ marginBottom: '.8rem' }}>
      <div className="form">
        <p style={{ margin: 0 }}><b>Seu @</b></p>
        {actor.handle ? (
          <p className="small" style={{ margin: 0 }}>Você é <b>@{actor.handle}</b>. Dá para entrar com ele no lugar do código. Ele aparece no seu perfil, mas ninguém pesquisa pelo @.</p>
        ) : (
          <>
            <p className="small muted" style={{ margin: 0 }}>Crie o seu @ para entrar com ele no lugar do código. Cada @ é de uma pessoa só e, depois de criado, não muda.</p>
            <HandleField value={h} onChange={setH} />
            <Button busy={busy} disabled={h.replace(/^@/, '').length < 3} onClick={save}>Criar meu @</Button>
          </>
        )}
      </div>
    </Card>
  );
}

/** Para onde o "Voltar" do topo leva em cada tela. */
function parentOf(path) {
  const [seg, sub, sub2] = path.split('/').slice(2);
  if (seg === 'aprendizagem') return ['meditacao', 'escola-sabatina'].includes(sub) && sub2 ? `${base}/aprendizagem/${sub}` : sub === 'bom-lider' && sub2 ? `${base}/aprendizagem/bom-lider` : sub === 'bom-de-biblia' && sub2 ? `${base}/aprendizagem/bom-de-biblia` : sub === 'ano-biblico' && sub2 ? `${base}/aprendizagem/ano-biblico` :  sub ? `${base}/aprendizagem` : base;
  if ((seg === 'jogos' || seg === 'albuns') && sub) return `${base}/${seg}`;
  if (['clubes', 'suporte', 'albuns', 'certificados'].includes(seg)) return `${base}/mais`;
  return base;
}

/**
 * Convite para ativar as notificações: só no app baixado (aberto pela tela de início) e pequeno.
 * O X esconde só desta vez; volta a aparecer toda vez que abrir o app, até ativar.
 */
function PushCard() {
  const [show, setShow] = useState(null); // null = escondido; 'default' | 'denied'
  const [busy, run] = useAsync();
  useEffect(() => {
    if (!pushSupported() || !installedApp() || Notification.permission === 'granted') return;
    setShow(Notification.permission);
  }, []);
  const turnOn = () => run(async () => {
    const ok = await enablePush();
    setShow(ok ? null : Notification.permission === 'denied' ? 'denied' : 'default');
    if (ok) notify('Notificações ativadas!');
  }).catch(() => {});
  if (!show) return null;
  return (
    <div className="push-card">
      <Bell size={16} />
      {show === 'default' ? (
        <>
          <span className="grow">Receba lembretes dos seus estudos do dia</span>
          <Button small busy={busy} onClick={turnOn}>Ativar</Button>
        </>
      ) : <span className="grow">Notificações bloqueadas: libere nas configurações do celular</span>}
      <button type="button" className="push-x" aria-label="Fechar" onClick={() => setShow(null)}><X size={15} /></button>
    </div>
  );
}

/** "Estou aqui" a cada minuto com o app aberto e visível: 5 minutos no dia = 1 dia na sequência do app. */
function usePresence() {
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible' || navigator.onLine === false) return;
      api.post('/me/presenca').then((r) => {
        if (r?.rewarded_now) notify('Você usou o app hoje: ganhou 1 pacotinho de figurinhas e 10 pontos no ranking!');
      }).catch(() => {});
    }, 60e3);
    return () => clearInterval(t);
  }, []);
}

export default function MemberApp() {
  const { actor } = useAuth();
  usePresence();
  useEffect(() => { syncPush(); }, []);
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
    { to: `${base}/dbv-mais`, icon: BadgeCheck, label: actor.access ? 'Planos' : 'DBV+', hint: actor.plus ? `Assinante até ${new Date(actor.plus.until).toLocaleDateString('pt-BR')}` : actor.access?.locked ? 'Assine para usar o app' : actor.access?.trial ? 'Você está no teste grátis' : 'Assine e ganhe benefícios' },
    { to: `${base}/certificados`, icon: Award, label: 'Certificados', hint: 'Baixar em PDF ou imprimir' },
    { to: `${base}/albuns`, icon: BookImage, label: 'Álbuns de figurinhas', hint: 'Álbum Bíblico' },
    { to: `${base}/suporte`, icon: LifeBuoy, label: 'Suporte', hint: 'Fale com a equipe' },
    { to: `${base}/clubes`, icon: Tent, label: 'Clubes', hint: 'Por distrito' },
  ];
  return (
    <Routes>
      <Route path="certificados/:kind/:id" element={<MemberCertificate base={base} />} />
      <Route
        path="*"
        element={
          <Shell tabs={tabs} parentOf={parentOf}>
            {!actor.waiting && <PlusNudge to={`${base}/dbv-mais`} />}
            {actor.waiting ? <Waiting text={actor.waiting} /> : <AppLock><Routes>
              <Route index element={<MyProfile />} />
              <Route path="requisitos" element={<RequirementsAndRanking isDbv={isDbv} />} />
              <Route path="cartao" element={<EmbeddedSite title="Cartão DBV" linkKey="link_cartao" subtitle="Entre com o código e a senha que o seu clube passar" />} />
              <Route path="suporte" element={<SupportChat />} />
              <Route path="jogos" element={<GamesHub base={base} />} />
              <Route path="jogos/:id" element={<GamePage base={base} />} />
              <Route path="dbv-mais" element={<PlusPage />} />
              <Route path="certificados" element={<CertificatesPage base={base} />} />
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
              <Route path="ranking" element={<Navigate to={`${base}/requisitos`} replace />} />
              <Route path="clubes" element={<ClubsBrowser base={base} />} />
              <Route path="ver/:kind/:id" element={<InAppProfile base={base} />} />
              <Route path="mais" element={<><PageHeader title="Mais" /><MoreMenu items={more} /></>} />
              <Route path="*" element={<Navigate to={base} replace />} />
            </Routes></AppLock>}
          </Shell>
        }
      />
    </Routes>
  );
}
