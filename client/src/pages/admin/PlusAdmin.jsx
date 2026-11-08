// DBV+ (só o administrador geral): assinantes, plano e validade; dar ou tirar o DBV+.
import { useState } from 'react';
import { BadgeCheck, X } from 'lucide-react';
import { api } from '../../api.js';
import { Button, Card, Field, Loading, PageHeader, Tabs, notify, useAsync, useLoad } from '../../ui.jsx';

const br = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '');

export default function PlusAdmin() {
  const state = useLoad(() => api.get('/admin/plus'));
  const [tab, setTab] = useState('assinantes');
  const [f, setF] = useState({ code: '', plan: 'plus', days: 30 });
  const [busy, run] = useAsync();
  const give = async () => {
    const r = await run(() => api.post('/admin/plus/dar', f)).catch(() => null);
    if (r) { notify(`${r.name} agora tem o DBV+ até ${br(r.until)}.`); setF({ ...f, code: '' }); state.reload(); }
  };
  const take = async (r) => {
    if (!window.confirm(`Tirar o DBV+ de ${r.name}?`)) return;
    await run(() => api.del('/admin/plus/' + r.member_id), 'DBV+ retirado').then(state.reload, () => {});
  };
  return (
    <>
      <PageHeader title="DBV+" subtitle="Assinantes e dar DBV+" />
      <Loading {...state}>
        {(rows) => {
          return (
            <>
              <Tabs tabs={[['assinantes', `Assinantes (${rows.filter((r) => r.active).length})`], ['dar', 'Dar DBV+']]} value={tab} onChange={setTab} />
              {tab === 'dar' ? (
                <Card>
                  <p className="small muted" style={{ marginTop: 0 }}>Libera o DBV+ sem pagamento (contas de teste ou cortesia). Para tirar, use a aba Assinantes.</p>
                  <Field label="Código do membro (6 dígitos)"><input inputMode="numeric" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>
                  <Field label="Plano">
                    <select value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })}>
                      <option value="app">DBV (R$ 3,90, conta sem clube)</option><option value="plus">DBV+</option>
                    </select>
                  </Field>
                  <Field label="Dias"><input type="number" min="1" value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} /></Field>
                  <Button block busy={busy} disabled={!f.code.trim()} onClick={give}><BadgeCheck size={16} /> Dar DBV+</Button>
                </Card>
              ) : (
                <div className="list">
                  {rows.map((r) => (
                    <div key={r.member_id} className="list-item">
                      <BadgeCheck size={22} style={{ color: r.active ? '#d4a017' : '#94a3b8' }} />
                      <div className="grow"><div className="title">{r.name} · {r.code}</div><div className="sub">{r.plan_name} · {r.active ? `ativo até ${br(r.until)}` : `venceu em ${br(r.until)}`} · {r.club_name}</div></div>
                      <button type="button" className="icon-btn" aria-label="Tirar DBV+" onClick={() => take(r)}><X size={18} /></button>
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
