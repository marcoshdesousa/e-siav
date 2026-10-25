import { useState } from 'react';
import { Send } from 'lucide-react';
import { api } from '../../api.js';
import { Button, Card, ContentIcon, Field, MedalIcon, PageHeader, Section, Tabs, notify, useAsync, useLoad } from '../../ui.jsx';
import PeoplePicker, { emptySelection } from './PeoplePicker.jsx';

const KIND_TABS = [['curso', 'Cursos']];

/**
 * Entregar conteúdo: escolhe o item, depois o clube, a unidade e as pessoas
 * (com "selecionar todos"), e confirma de uma vez.
 */
export default function Deliver() {
  const [kind, setKind] = useState('curso');
  const medals = useLoad(() => api.get('/admin/medals'));
  const content = useLoad(() => api.get('/admin/content'));
  const directory = useLoad(() => api.get('/admin/directory'));
  const [item, setItem] = useState(null);
  const action = 'concluir';
  const [note, setNote] = useState('');
  const [sel, setSel] = useState(emptySelection);
  const [busy, run] = useAsync();

  const items = kind === 'medal' ? medals.data || [] : (content.data || []).filter((c) => c.type === kind);
  const isMedal = kind === 'medal';
  const count = sel.members.size + (isMedal ? sel.clubs.size + sel.units.size : 0);

  const deliver = async () => {
    if (!item) return notify('Escolha o que vai entregar', 'error');
    if (!count) return notify('Escolha quem vai receber', 'error');
    const r = await run(() => api.post('/admin/deliver', {
      item_type: isMedal ? 'medal' : 'content', item_id: item.id, action, note,
      clubs: isMedal ? [...sel.clubs] : [], units: isMedal ? [...sel.units] : [], members: [...sel.members],
    }));
    notify(`Entregue para ${r.delivered} destinatário${r.delivered === 1 ? '' : 's'}!`);
    setSel(emptySelection());
    setNote('');
  };

  return (
    <>
      <PageHeader title="Entregar conteúdo" subtitle="Escolha o item e quem vai receber" />
      <Section title="1. O que vai entregar">
        <Tabs tabs={KIND_TABS} value={kind} onChange={(k) => { setKind(k); setItem(null); }} />
        <div className="deliver-items">
          {items.map((it) => (
            <button key={it.id} type="button" className={'deliver-item' + (item?.id === it.id ? ' on' : '')} onClick={() => setItem(it)}>
              <span className={isMedal ? 'medal-icon' : 'content-icon'} style={{ width: 46, height: 46 }}>
                {isMedal ? <MedalIcon icon={it.icon} size={24} /> : <ContentIcon c={it} size={22} />}
              </span>
              <span className="grow"><b>{it.name}</b><small>{isMedal ? (it.kind === 'trofeu' ? 'Troféu' : 'Medalha') : 'Curso'}</small></span>
            </button>
          ))}
          {!items.length && <p className="muted small">Nada cadastrado ainda. Crie em Conteúdo.</p>}
        </div>
      </Section>

      {item && !isMedal && <p className="muted small">O curso aparece no perfil das pessoas como concluído.</p>}
      {item && isMedal && (
        <Section title="Observação">
          <Field hint="Ex.: Setembro de 2026 — aparece embaixo da medalha"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" /></Field>
        </Section>
      )}

      <Section title="2. Quem vai receber">
        <Card>
          <PeoplePicker directory={directory.data} value={sel} onChange={setSel} allowClubs={isMedal} allowUnits={isMedal} />
        </Card>
      </Section>

      <div className="mt">
        <Button block busy={busy} disabled={!item || !count} onClick={deliver}><Send size={18} /> Entregar {item ? `“${item.name}”` : ''}{count ? ` para ${count}` : ''}</Button>
      </div>
    </>
  );
}
