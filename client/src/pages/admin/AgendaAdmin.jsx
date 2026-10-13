import { useState } from 'react';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { Button, Field, Loading, PageHeader, useAsync, useLoad } from '../../ui.jsx';
import { AgendaForm, AgendaView } from '../club/Folders.jsx';

/** Agenda do App: aparece para todos os clubes, para um distrito ou para um clube. */
export default function AgendaAdmin() {
  const { meta } = useAuth();
  const state = useLoad(() => api.get('/admin/agenda'));
  const clubs = useLoad(() => api.get('/admin/clubs'));
  const [editing, setEditing] = useState(null);
  const [, run] = useAsync();
  const extra = (f, setF) => (
    <>
      <Field label="Para quem">
        <select value={f.scope || 'geral'} onChange={(e) => setF({ ...f, scope: e.target.value })}>
          <option value="geral">Todos os clubes</option>
          <option value="distrito">Um distrito</option>
          <option value="clube">Um clube</option>
        </select>
      </Field>
      {f.scope === 'distrito' && (
        <Field label="Distrito">
          <select value={f.district_id || ''} onChange={(e) => setF({ ...f, district_id: e.target.value })}>
            <option value="">Escolha</option>
            {meta.districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
      )}
      {f.scope === 'clube' && (
        <Field label="Clube">
          <select value={f.club_id || ''} onChange={(e) => setF({ ...f, club_id: e.target.value })}>
            <option value="">Escolha</option>
            {(clubs.data || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      )}
    </>
  );
  return (
    <>
      <PageHeader title="Agenda" subtitle="Datas do App que aparecem na agenda dos clubes" action={<Button small onClick={() => setEditing({ _extra: { scope: 'geral' } })}>+ Marcar</Button>} />
      <Loading {...state}>
        {(items) => (
          <AgendaView items={items} canEdit={() => true}
            onEdit={(a) => setEditing({ ...a, _extra: { scope: a.scope, district_id: a.district_id || '', club_id: a.club_id || '' } })}
            onDelete={(a) => run(() => api.del('/admin/agenda/' + a.id), 'Apagado da agenda').then(state.reload)} />
        )}
      </Loading>
      {editing && <AgendaForm item={editing} extra={extra} onClose={() => setEditing(null)} onSave={(f) => (editing.id ? api.put('/admin/agenda/' + editing.id, f) : api.post('/admin/agenda', f)).then(state.reload)} />}
    </>
  );
}
