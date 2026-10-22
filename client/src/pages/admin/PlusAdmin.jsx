// DBV+ (só o administrador geral): assinantes, plano, validade e as especialidades escolhidas.
import { useState } from 'react';
import { BadgeCheck, Copy } from 'lucide-react';
import { api } from '../../api.js';
import { Button, Card, Loading, PageHeader, Tabs, notify, useLoad } from '../../ui.jsx';

const br = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');

export default function PlusAdmin() {
  const state = useLoad(() => api.get('/admin/plus'));
  const [tab, setTab] = useState('especialidades');
  const copy = async (text) => { try { await navigator.clipboard.writeText(text); notify('Texto copiado!'); } catch { window.prompt('Copie o texto:', text); } };
  return (
    <>
      <PageHeader title="DBV+" subtitle="Assinantes e especialidades escolhidas" />
      <Loading {...state}>
        {(rows) => {
          const withPicks = rows.filter((r) => r.active && r.picks_needed > 0);
          const text = (r) => `${r.name} (${r.code}) — ${r.club_name}, ${r.district_name}\nPlano: ${r.plan_name} (${r.picks_needed === 15 ? 3 : 7} especialidades)\nEscolhidas: ${r.picks.length ? r.picks.join(', ') : 'ainda não escolheu'}`;
          const all = withPicks.map(text).join('\n\n');
          return (
            <>
              <Tabs tabs={[['especialidades', `Especialidades (${withPicks.length})`], ['assinantes', `Assinantes (${rows.filter((r) => r.active).length})`]]} value={tab} onChange={setTab} />
              {tab === 'especialidades' ? (
                <>
                  {withPicks.length > 0 && <Button block onClick={() => copy(all)}><Copy size={16} /> Copiar tudo</Button>}
                  {withPicks.length ? withPicks.map((r) => (
                    <Card key={r.member_id} className="small mt">
                      <p style={{ margin: 0 }}><b>{r.name}</b> · {r.code} · {r.club_name} ({r.district_name})</p>
                      <p className="muted" style={{ margin: '.2rem 0' }}>{r.plan_name} · compra {r.picks_needed === 15 ? 3 : 7} · até {br(r.until)}</p>
                      <p style={{ margin: '.2rem 0' }}>{r.picks.length ? r.picks.join(', ') : <i>Ainda não escolheu.</i>}</p>
                      <Button small variant="secondary" onClick={() => copy(text(r))}><Copy size={14} /> Copiar</Button>
                    </Card>
                  )) : <p className="muted small">Nenhum assinante com especialidades ainda.</p>}
                </>
              ) : (
                <div className="list">
                  {rows.map((r) => (
                    <div key={r.member_id} className="list-item">
                      <BadgeCheck size={22} style={{ color: r.active ? '#d4a017' : '#94a3b8' }} />
                      <div className="grow"><div className="title">{r.name}</div><div className="sub">{r.plan_name} · {r.active ? `ativo até ${br(r.until)}` : `venceu em ${br(r.until)}`} · {r.club_name}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </>
          );
        }}
      </Loading>
    </>
  );
}
