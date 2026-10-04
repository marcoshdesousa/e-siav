import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, ClipboardCheck, Medal, MessageCircle, Smartphone, Trophy } from 'lucide-react';
import { api } from '../api.js';
import { homeFor, useAuth } from '../auth.jsx';
import { plural } from '../format.js';
import { Avatar, LogoHorizontal, LogoIcon, Spinner, useLoad } from '../ui.jsx';

const FEATURES = [
  [ClipboardCheck, 'Requisitos com pontuação', 'Tarefas com prazo: relatório, fotos e quiz. Cada envio aprovado vale pontos.'],
  [Trophy, 'Ranking ao vivo', 'Desbravadores, unidades e clubes subindo na tabela a cada envio.'],
  [Medal, 'Medalhas e eventos', 'Conquistas, classes e especialidades no perfil de cada membro.'],
  [MessageCircle, 'Chat do clube', 'Grupo da unidade, conversa com a diretoria e mensagens diretas, com denúncia e bloqueio.'],
];

function ClubsStrip() {
  const districts = useLoad(() => api.get('/public/districts'));
  const first = districts.data?.[0];
  const clubs = useLoad(() => (first ? api.get(`/public/districts/${first.id}/clubs`) : Promise.resolve([])), [first?.id]);
  if (!first || !clubs.data?.length) return null;
  return (
    <section className="lp-section">
      <h2>Clubes do {first.name}</h2>
      <div className="lp-clubs">
        {clubs.data.map((c) => (
          <Link key={c.id} to={`/p/clube/${c.id}`} className="lp-club">
            <Avatar src={c.logo} name={c.name} size={48} square />
            <div className="grow">
              <b>{c.name}</b>
              <span>{plural(c.unit_count, 'unidade', 'unidades')} · {plural(c.member_count, 'membro', 'membros')}</span>
            </div>
            <ArrowRight size={18} />
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Página inicial pública. Quem já está logado vai direto para o app. */
export default function Landing() {
  const { actor } = useAuth();
  if (actor === undefined) return <Spinner />;
  if (actor) return <Navigate to={homeFor(actor)} replace />;

  return (
    <div className="lp">
      <header className="lp-nav">
        <LogoHorizontal size={38} />
        <Link to="/entrar" className="btn btn-primary btn-sm">Entrar</Link>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-text">
          <span className="lp-kicker">Para clubes de Desbravadores</span>
          <h1>O seu clube inteiro na palma da mão</h1>
          <p>Membros, unidades, requisitos, ranking, medalhas e chat em um só aplicativo, feito para o celular.</p>
          <div className="lp-cta">
            <Link to="/entrar" className="btn btn-yellow lp-btn">Entrar no app <ArrowRight size={18} /></Link>
          </div>
          <p className="lp-note">As contas são criadas pelo seu clube. Peça seu usuário à secretaria.</p>
        </div>
        <div className="lp-phone" aria-hidden="true">
          <div className="lp-phone-screen">
            <div className="lp-phone-top"><LogoIcon size={26} /><span /></div>
            <div className="lp-phone-card gold"><Trophy size={18} /><span /><b>1º</b></div>
            <div className="lp-phone-card"><ClipboardCheck size={18} /><span /><b>2º</b></div>
            <div className="lp-phone-card"><Medal size={18} /><span /><b>3º</b></div>
            <div className="lp-phone-bars"><i /><i /><i /><i /></div>
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-features">
          {FEATURES.map(([Ico, title, text]) => (
            <div key={title} className="lp-feature">
              <span className="lp-feature-ico"><Ico size={24} /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <ClubsStrip />

      <section className="lp-section">
        <div className="lp-install">
          <Smartphone size={28} />
          <div>
            <b>Instale como aplicativo</b>
            <p>No Android, abra o menu do navegador e toque em “Instalar app”. No iPhone, toque em Compartilhar e “Adicionar à Tela de Início”.</p>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <span>App do DBV</span>
        <Link to="/entrar">Entrar</Link>
      </footer>
    </div>
  );
}
