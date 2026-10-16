import { useState } from 'react';
import { FileUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, toForm } from '../../api.js';
import { Button, Card, Confirm, Field, Loading, Modal, PageHeader, Section, notify, useAsync, useLoad } from '../../ui.jsx';
import { CatalogBadge, groupCatalog } from '../Catalog.jsx';

/** Edita um item (nome, área e código). Sem foto: só o nome aparece no app. */
function EditItem({ item, areas, onClose, onDone }) {
  const [f, setF] = useState({ name: item.name, category: item.category || '', code: item.code || '' });
  const [busy, run] = useAsync();
  const save = async () => {
    await run(() => api.put('/admin/catalog/' + item.id, toForm(f)), 'Salvo!');
    onDone();
  };
  return (
    <Modal title={item.name} onClose={onClose} footer={<Button busy={busy} onClick={save}>Salvar</Button>}>
      <div className="form">
        <Field label="Nome"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        {item.type === 'especialidade' && (
          <div className="grid2">
            <Field label="Área">
              <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                {[...new Set([...areas, f.category])].filter(Boolean).map((a) => <option key={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Código"><input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="Opcional" /></Field>
          </div>
        )}
      </div>
    </Modal>
  );
}

function AddItem({ type, areas, area, onClose, onDone }) {
  const [f, setF] = useState({ name: '', category: area || areas[0] || '', code: '', age: '', leader: false });
  const [busy, run] = useAsync();
  const save = async () => {
    await run(() => api.post('/admin/catalog', toForm({ ...f, type, leader: f.leader ? 1 : 0 })), type === 'classe' ? 'Classe adicionada!' : 'Especialidade adicionada!');
    onDone();
  };
  return (
    <Modal title={type === 'classe' ? 'Nova classe' : 'Nova especialidade'} onClose={onClose} footer={<Button busy={busy} disabled={f.name.trim().length < 2} onClick={save}>Adicionar</Button>}>
      <div className="form">
        <Field label="Nome"><input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        {type === 'especialidade' ? (
          <div className="grid2">
            <Field label="Área">
              <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{areas.map((a) => <option key={a}>{a}</option>)}</select>
            </Field>
            <Field label="Código"><input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="Opcional" /></Field>
          </div>
        ) : null}
        <p className="muted small">Nada no catálogo é vendido: os membros informam as que têm e o clube aprova.</p>
      </div>
    </Modal>
  );
}

/** Especialidades: todas as áreas oficiais aparecem, mesmo vazias. */
function sections(type, d) {
  const groups = groupCatalog(type, d.items);
  if (type !== 'especialidade') return groups;
  const map = new Map(groups);
  const extra = groups.map(([g]) => g).filter((g) => !d.areas.includes(g));
  return [...d.areas, ...extra].map((g) => [g, map.get(g) || []]);
}

/**
 * Catálogo oficial de especialidades e classes: aqui só se mantém a lista de nomes
 * (sem fotos, para o app ficar leve; nada é vendido nem tem requisito online).
 * Quem registra no perfil é a diretoria do clube.
 */
export default function CatalogAdmin() {
  const [type, setType] = useState('especialidade');
  const state = useLoad(() => api.get('/admin/catalog?type=' + type), [type]);
  const [importing, setImporting] = useState(false);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [busy, run] = useAsync();

  const doImport = async () => {
    const r = await run(() => api.post('/admin/catalog/import', { text }));
    notify(`${r.created} novas · ${r.updated} atualizadas${r.skipped ? ` · ${r.skipped} linhas ignoradas` : ''}`);
    setText('');
    setImporting(false);
    state.reload();
  };
  return (
    <>
      <PageHeader title="Catálogo oficial" subtitle="Especialidades e classes (só os nomes)" />
      <div className="seg" style={{ marginBottom: '1rem' }}>
        {[['especialidade', 'Especialidades'], ['classe', 'Classes']].map(([k, l]) => (
          <button key={k} type="button" className={type === k ? 'active' : ''} onClick={() => { setType(k); setAdding(false); setEditing(null); }}>{l}</button>
        ))}
      </div>
      <Card>
        <div className="grid2">
          <Button variant="secondary" onClick={() => setAdding(true)}><Plus size={16} /> {type === 'classe' ? 'Nova classe' : 'Nova especialidade'}</Button>
          {type === 'especialidade' && <Button variant="secondary" onClick={() => setImporting(true)}><FileUp size={16} /> Importar lista</Button>}
        </div>
      </Card>
      <Loading {...state}>
        {(d) => {
          return (
            <>
              <p className="muted small mt">{d.items.length} {type === 'classe' ? 'classes' : 'especialidades'}</p>
              {sections(type, d).map(([g, list]) => (
                <Section key={g} title={`${g} (${list.length})`}
                  action={type === 'especialidade' && <Button small variant="secondary" onClick={() => setAdding(g)}><Plus size={14} /> Adicionar</Button>}>
                  {!list.length && <p className="muted small">Nenhuma especialidade nesta área ainda.</p>}
                  <div className="list">
                    {list.map((c) => (
                      <div key={c.id} className="list-item">
                        <CatalogBadge c={c} size={40} />
                        <div className="grow">
                          <div className="title">{c.name}</div>
                          <div className="sub">{c.code ? c.code + ' · ' : ''}{c.age ? c.age + ' anos · ' : c.leader ? 'Liderança · ' : ''}{c.holders} no perfil</div>
                        </div>
                        <button type="button" className="icon-btn" aria-label="Editar" onClick={() => setEditing(c)}><Pencil size={18} /></button>
                        {!c.holders && <Confirm text={`Excluir "${c.name}" do catálogo?`} onYes={() => run(() => api.del('/admin/catalog/' + c.id), 'Excluído').then(state.reload)}><Trash2 size={14} /></Confirm>}
                      </div>
                    ))}
                  </div>
                </Section>
              ))}
              {adding && <AddItem type={type} areas={d.areas} area={typeof adding === 'string' ? adding : ''} onClose={() => setAdding(false)} onDone={() => { setAdding(false); state.reload(); }} />}
              {editing && <EditItem item={editing} areas={d.areas} onClose={() => setEditing(null)} onDone={() => { setEditing(null); state.reload(); }} />}
            </>
          );
        }}
      </Loading>
      {importing && (
        <Modal title="Importar lista do manual" onClose={() => setImporting(false)} footer={<Button busy={busy} disabled={!text.trim()} onClick={doImport}>Importar</Button>}>
          <p className="muted small">Cole a relação do Manual de Especialidades, <b>uma por linha</b>, no formato <code>código; nome; área</code> (ou <code>nome; área</code>). Pode colar direto de uma planilha. As que já existem são atualizadas.</p>
          <textarea style={{ minHeight: 240, fontFamily: 'monospace', fontSize: '.85rem' }} value={text} onChange={(e) => setText(e.target.value)}
            placeholder={'AR-001; Nós e Amarras; Atividades Recreativas\nEB-001; Profecias de Daniel; Ensinos Bíblicos'} />
        </Modal>
      )}
    </>
  );
}
