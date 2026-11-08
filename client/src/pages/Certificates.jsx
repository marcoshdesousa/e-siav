// Aba Certificados: os certificados que o app gera sozinho (Ano Bíblico, Bom Líder e o certificado de
// honra de cada troféu de ranking). Cada um abre numa página para baixar em PDF ou imprimir. O membro
// também vê o que ainda dá para conquistar.
import { Link, useParams } from 'react-router-dom';
import { BookOpenText, ChevronLeft, ChevronRight, Download, Lock, Users } from 'lucide-react';
import { api } from '../api.js';
import { fmtDate } from '../format.js';
import { Button, Empty, Loading, PageHeader, Section, useLoad } from '../ui.jsx';
import { Trophy } from '../trophies.jsx';
import { CertificateView } from './TrophyCertificate.jsx';
import './certificates.css';

const ICON = { 'ano-biblico': BookOpenText, 'bom-lider': Users };

function CertCard({ c, to }) {
  const Ico = ICON[c.kind];
  return (
    <Link to={to} className={'cert-card' + (c.kind === 'trofeu' ? ' honor' : '')}>
      <span className="cert-card-art">{c.kind === 'trofeu' ? <Trophy design={c.design} pos={c.place} size={54} /> : <Ico size={30} />}</span>
      <span className="grow">
        {c.who && <small className="cert-card-who">{c.who}</small>}
        <b>{c.title}</b>
        <small>{c.subtitle}{c.date ? ` · ${fmtDate(c.date)}` : ''}</small>
      </span>
      <span className="cert-card-go"><Download size={16} /><ChevronRight size={16} /></span>
    </Link>
  );
}

/** Lista do membro: os conquistados e, embaixo, os que ainda faltam. */
export function CertificatesPage({ base }) {
  const state = useLoad(() => api.get('/me/certificados'));
  return (
    <>
      <PageHeader title="Certificados" subtitle="Os seus certificados para baixar em PDF ou imprimir" />
      <Loading {...state}>
        {(d) => (
          <>
            {d.list.length ? (
              <div className="cert-list">{d.list.map((c) => <CertCard key={c.kind + c.id} c={c} to={`${base}/certificados/${c.kind}/${c.id}`} />)}</div>
            ) : <Empty icon="trophy">Você ainda não tem certificados. Eles aparecem aqui sozinhos quando você conquista.</Empty>}
            {d.goals.length > 0 && (
              <Section title="Para conquistar">
                <div className="cert-list">
                  {d.goals.map((g) => (
                    <div key={g.kind} className="cert-card locked">
                      <span className="cert-card-art"><Lock size={24} /></span>
                      <span className="grow"><b>{g.title}</b><small>{g.progress}</small></span>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </Loading>
    </>
  );
}

export function MemberCertificate({ base }) {
  const { kind, id } = useParams();
  const state = useLoad(() => api.get(`/me/certificados/${kind}/${id}`), [kind, id]);
  return <CertificateView state={state} back={<Link to={`${base}/certificados`}><Button variant="secondary" small><ChevronLeft size={14} /> Voltar</Button></Link>} />;
}

/** Clube e unidade: os certificados de honra dos troféus. */
export function GroupCertificatesPage({ club }) {
  const state = useLoad(() => api.get('/certificados'));
  return (
    <>
      <PageHeader title="Certificados" subtitle={club ? 'Certificados de honra do clube e das unidades' : 'Certificados de honra da unidade'} />
      <Loading {...state}>
        {(d) => (d.list.length
          ? <div className="cert-list">{d.list.map((c) => <CertCard key={c.id} c={c} to={`/certificado/${c.id}`} />)}</div>
          : <Empty icon="trophy">Ainda sem certificados. Quando {club ? 'o clube ou uma unidade' : 'a unidade'} ficar entre os 3 primeiros de um ranking finalizado, o certificado de honra aparece aqui.</Empty>)}
      </Loading>
    </>
  );
}
