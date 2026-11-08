// Certificado de honra do troféu (ranking finalizado): abre pelo troféu no perfil, para imprimir ou
// salvar em PDF.
import { useParams } from 'react-router-dom';
import { ChevronLeft, Printer } from 'lucide-react';
import { api } from '../api.js';
import { fmtDate } from '../format.js';
import { Button, Loading, useLoad } from '../ui.jsx';
import { Trophy } from '../trophies.jsx';

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

/** Certificado de um troféu (aberto pelo troféu no perfil de qualquer pessoa, unidade ou clube). */
export function TrophyCertificatePage() {
  const { id } = useParams();
  const state = useLoad(() => api.get(`/public/trofeus/${id}/certificado`), [id]);
  return <CertificateView state={state} back={<Button variant="secondary" small onClick={() => window.history.back()}><ChevronLeft size={14} /> Voltar</Button>} />;
}
