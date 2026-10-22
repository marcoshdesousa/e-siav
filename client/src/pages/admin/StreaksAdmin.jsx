// Sequências: porcentagem dos membros com cada sequência em dia, por distrito e por clube.
import { Flame } from 'lucide-react';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Card, Loading, PageHeader, Section, useLoad } from '../../ui.jsx';

function Bars({ g }) {
  return (
    <div className="seq-bars">
      {[['Ano Bíblico', 'bible', '#1d4ed8'], ['Meditação', 'meditation', '#f97316'], ['Escola Sabatina', 'sabbath', '#0d9488']].map(([label, k, c]) => (
        <div key={k} className="seq-bar">
          <small>{label}</small>
          <span><i style={{ width: `${g.pct[k]}%`, background: c }} /></span>
          <b>{g.pct[k]}%</b>
        </div>
      ))}
    </div>
  );
}

export default function StreaksAdmin() {
  const { actor } = useAuth();
  const state = useLoad(() => api.get('/admin/sequencias'));
  return (
    <>
      <PageHeader title="Sequências" subtitle={actor.district_id ? `Distrito ${actor.district_name}` : 'Todos os distritos e clubes'} />
      <p className="small muted">Porcentagem dos membros ativos com a sequência em dia (fizeram no próprio dia hoje ou ontem).</p>
      <Loading {...state}>
        {(d) => (
          <>
            {!actor.district_id && (
              <Section title="Distritos">
                {d.districts.map((g) => (
                  <Card key={g.id} className="seq-card">
                    <div className="seq-head"><Flame size={18} /><b>{g.name}</b><small>{g.members} membros</small></div>
                    <Bars g={g} />
                  </Card>
                ))}
              </Section>
            )}
            <Section title="Clubes">
              {d.clubs.length ? d.clubs.map((g) => (
                <Card key={g.id} className="seq-card">
                  <div className="seq-head"><b>{g.name}</b><small>{actor.district_id ? '' : `${g.district_name} · `}{g.members} membros</small></div>
                  <Bars g={g} />
                </Card>
              )) : <p className="muted small">Nenhum clube com membros ativos.</p>}
            </Section>
          </>
        )}
      </Loading>
    </>
  );
}
