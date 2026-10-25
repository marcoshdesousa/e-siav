// Área Downloads do membro: os certificados que o app gera sozinho (Ano Bíblico, Bom Líder,
// classes, especialidades e cursos). Cada um abre numa página para imprimir ou salvar em PDF.
import { Link, useParams } from 'react-router-dom';
import { Award, BookOpen, ChevronLeft, ChevronRight, Download, GraduationCap, Printer, Trophy as TrophyIco } from 'lucide-react';
import { api } from '../../api.js';
import { fmtDate } from '../../format.js';
import { Button, Empty, Loading, PageHeader, useLoad } from '../../ui.jsx';
import { Trophy } from '../../trophies.jsx';

const ICON = { 'ano-biblico': BookOpen, 'bom-lider': GraduationCap, trofeu: TrophyIco };

export function DownloadsPage({ base }) {
  const state = useLoad(() => api.get('/me/certificados'));
  return (
    <>
      <PageHeader title="Downloads" subtitle="Os seus certificados para baixar e imprimir" />
      <Loading {...state}>
        {(list) => (list.length ? (
          <div className="list">
            {list.map((c) => {
              const Ico = ICON[c.kind] || Award;
              return (
                <Link key={c.kind + c.id} to={`${base}/certificado/${c.kind}/${c.id}`} className="list-item">
                  <span className="trophy-bg"><Ico size={22} /></span>
                  <div className="grow"><div className="title">{c.title}</div><div className="sub">Certificado · {c.subtitle}{c.date ? ` · ${fmtDate(c.date)}` : ''}</div></div>
                  <Download size={18} className="muted" />
                  <ChevronRight size={16} className="muted" />
                </Link>
              );
            })}
          </div>
        ) : (
          <Empty icon="trophy">Ainda não tem certificados. Termine o Ano Bíblico, o Bom Líder, uma classe, uma especialidade ou um curso, ou fique no pódio de um ranking, e o certificado aparece aqui.</Empty>
        ))}
      </Loading>
    </>
  );
}

/** O certificado em si (para imprimir ou salvar em PDF). Troféu: aparece o desenho escolhido. */
function CertificateView({ state, back }) {
  return (
    <div className="cert-page">
      <div className="cert-tools no-print">
        {back}
        <Button small onClick={() => window.print()}><Printer size={14} /> Baixar (salvar PDF) / imprimir</Button>
      </div>
      <Loading {...state}>
        {(c) => (
          <div className={'cert' + (c.design ? ' cert-trophy' : '')}>
            <div className="cert-logos">
              <img src="/marca/logo.png" alt="App do DBV" />
              {c.club_logo && <img src={c.club_logo} alt={c.club_name} />}
            </div>
            <p className="cert-kicker">App do DBV{c.club_name ? ` · ${c.club_name}` : ''}</p>
            <h1>{c.design ? 'Certificado de Honra' : 'Certificado'}</h1>
            {c.design && <div className="cert-art"><Trophy design={c.design} pos={c.place} size={110} /></div>}
            <p className="cert-text">Certificamos que</p>
            <p className="cert-name">{c.member_name}</p>
            <p className="cert-text">{c.what}</p>
            <p className="cert-item">{c.title}</p>
            {c.date && <p className="cert-text">em {fmtDate(c.date)}.</p>}
            <div className="cert-sign">
              <div><span />{c.director_name || 'Equipe App do DBV'}<small>{c.director_name ? 'Diretor(a) do clube' : 'App do DBV'}</small></div>
            </div>
          </div>
        )}
      </Loading>
    </div>
  );
}

export function MemberCertificatePage({ base }) {
  const { kind, id } = useParams();
  const state = useLoad(() => api.get(`/me/certificados/${kind}/${id}`), [kind, id]);
  return <CertificateView state={state} back={<Link to={`${base}/downloads`}><Button variant="secondary" small><ChevronLeft size={14} /> Voltar</Button></Link>} />;
}

/** Certificado de um troféu (aberto pelo troféu no perfil de qualquer pessoa, unidade ou clube). */
export function TrophyCertificatePage() {
  const { id } = useParams();
  const state = useLoad(() => api.get(`/public/trofeus/${id}/certificado`), [id]);
  return <CertificateView state={state} back={<Button variant="secondary" small onClick={() => window.history.back()}><ChevronLeft size={14} /> Voltar</Button>} />;
}
