import { useState } from 'react';
import { Clock, Plus, Send, X, XCircle } from 'lucide-react';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { fmtDate } from '../../format.js';
import { Button, Empty, Loading, Modal, PageHeader, Section, notify, useAsync, useLoad } from '../../ui.jsx';
import CatalogPicker, { CatalogBadge, groupCatalog } from '../Catalog.jsx';

const LABEL = {
  classe: { title: 'Classes', one: 'classe', many: 'classes', add: 'Informar classes que eu tenho' },
  especialidade: { title: 'Especialidades', one: 'especialidade', many: 'especialidades', add: 'Informar especialidades que eu tenho' },
};

/**
 * Classes e especialidades do membro: ele marca as que já tem e envia para a
 * diretoria do clube. Depois de aprovadas, aparecem no perfil.
 */
export default function MyAchievements({ type }) {
  const { actor } = useAuth();
  const L = LABEL[type];
  const mine = useLoad(() => api.get('/me/achievements?type=' + type), [type]);
  const cat = useLoad(() => api.get('/catalog?type=' + type), [type]);
  const [adding, setAdding] = useState(false);
  const [sel, setSel] = useState(new Set());
  const [busy, run] = useAsync();

  const items = (cat.data || []).filter((c) => !(type === 'classe' && c.leader && actor.kind !== 'lideranca'));
  const locked = {};
  for (const a of mine.data?.approved || []) locked[a.id] = 'Já no perfil';
  for (const r of mine.data?.requests || []) if (r.status === 'pendente') locked[r.content_id] = 'Aguardando';

  const send = async () => {
    const r = await run(() => api.post('/me/achievement-requests', { content_ids: [...sel] }));
    notify(`${r.created} enviada${r.created === 1 ? '' : 's'} para a diretoria aprovar!`);
    setSel(new Set());
    setAdding(false);
    mine.reload();
  };
  const cancel = (id) => run(() => api.del('/me/achievement-requests/' + id), 'Pedido cancelado').then(mine.reload);

  return (
    <>
      <PageHeader title={L.title} subtitle={`As ${L.many} que você tem, aprovadas pela diretoria do seu clube`} />
      <Button block onClick={() => setAdding(true)}><Plus size={18} /> {L.add}</Button>
      <Loading {...mine}>
        {(d) => {
          const pending = d.requests.filter((r) => r.status === 'pendente');
          const refused = d.requests.filter((r) => r.status === 'recusado');
          return (
            <>
              {pending.length > 0 && (
                <Section title={`Aguardando a diretoria (${pending.length})`}>
                  <div className="list">
                    {pending.map((r) => (
                      <div key={r.id} className="list-item">
                        <CatalogBadge c={r} size={44} />
                        <div className="grow"><div className="title">{r.name}</div><div className="sub ico"><Clock size={13} /> Enviado em {fmtDate(r.created_at)}</div></div>
                        <button type="button" className="icon-btn" aria-label="Cancelar pedido" title="Cancelar pedido" onClick={() => cancel(r.id)}><X size={18} /></button>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
              <Section title={`No meu perfil (${d.approved.length})`}>
                {d.approved.length ? groupCatalog(type, d.approved).map(([g, list]) => (
                  <div key={g} className="cat-group">
                    <h3>{g}</h3>
                    <div className="cat-grid">
                      {list.map((c) => (
                        <div key={c.id} className="cat-item static"><CatalogBadge c={c} size={56} /><span className="cat-name">{c.name}</span></div>
                      ))}
                    </div>
                  </div>
                )) : <Empty icon="award">Nenhuma {L.one} aprovada ainda. Toque no botão acima para informar as que você tem.</Empty>}
              </Section>
              {refused.length > 0 && (
                <Section title="Não aprovadas">
                  <div className="list">
                    {refused.map((r) => (
                      <div key={r.id} className="list-item">
                        <CatalogBadge c={r} size={40} />
                        <div className="grow"><div className="title">{r.name}</div><div className="sub ico"><XCircle size={13} /> Fale com a diretoria do seu clube</div></div>
                        <button type="button" className="icon-btn" aria-label="Remover da lista" onClick={() => cancel(r.id)}><X size={18} /></button>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </>
          );
        }}
      </Loading>
      {adding && (
        <Modal title={L.add} onClose={() => setAdding(false)}
          footer={<Button block busy={busy} disabled={!sel.size} onClick={send}><Send size={16} /> Enviar {sel.size || ''} para a diretoria</Button>}>
          <p className="muted small" style={{ marginBottom: '.8rem' }}>Marque todas as {L.many} que você já concluiu. A diretoria do seu clube confere e aprova.</p>
          <Loading {...cat}>{() => <CatalogPicker type={type} items={items} selected={sel} onChange={setSel} locked={locked} />}</Loading>
        </Modal>
      )}
    </>
  );
}
