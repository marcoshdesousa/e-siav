import { useState } from 'react';
import { FileUp, ImageUp, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { api, toForm } from '../../api.js';
import { Badge, Button, Card, Confirm, Field, Loading, Modal, PageHeader, Section, Tabs, notify, useAsync, useLoad } from '../../ui.jsx';
import { CatalogBadge, groupCatalog } from '../Catalog.jsx';

/** Edita um item (nome, área, código e foto). */
function EditItem({ item, areas, onClose, onDone }) {
  const [f, setF] = useState({ name: item.name, category: item.category || '', code: item.code || '', image: null, remove_image: false });
  const [busy, run] = useAsync();
  const save = async () => {
    await run(() => api.put('/admin/catalog/' + item.id, toForm({ ...f, image: f.image || undefined, remove_image: f.remove_image ? 1 : 0 })), 'Salvo!');
    onDone();
  };
  const preview = f.image ? URL.createObjectURL(f.image) : f.remove_image ? null : item.image;
  return (
    <Modal title={item.name} onClose={onClose} footer={<Button busy={busy} onClick={save}>Salvar</Button>}>
      <div className="form">
        <div className="row">
          <CatalogBadge c={{ ...item, image: preview }} size={84} />
          <div className="stack" style={{ gap: '.4rem' }}>
            <label className="btn btn-secondary btn-sm"><ImageUp size={15} /> Trocar foto
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && setF({ ...f, image: e.target.files[0], remove_image: false })} />
            </label>
            {preview && <Button small variant="danger" onClick={() => setF({ ...f, image: null, remove_image: true })}>Tirar foto</Button>}
          </div>
        </div>
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

function AddItem({ type, areas, onClose, onDone }) {
  const [f, setF] = useState({ name: '', category: areas[0] || '', code: '', age: '', leader: false });
  const [busy, run] = useAsync();
  const save = async () => {
    await run(() => api.post('/admin/catalog', { ...f, type }), type === 'classe' ? 'Classe adicionada!' : 'Especialidade adicionada!');
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
        ) : (
          <div className="grid2">
            <label className="check"><input type="checkbox" checked={f.leader} onChange={(e) => setF({ ...f, leader: e.target.checked })} /> Classe de liderança</label>
            {!f.leader && <Field label="Idade"><input type="number" min="10" max="15" value={f.age} onChange={(e) => setF({ ...f, age: e.target.value })} /></Field>}
          </div>
        )}
        <p className="muted small">Depois é só enviar a foto (aqui ou pelo envio em lote). Nada no catálogo é vendido.</p>
      </div>
    </Modal>
  );
}

/**
 * Catálogo oficial de classes e especialidades: aqui só se mantém a lista e as fotos
 * (nada é vendido nem tem requisito online). Quem registra no perfil é a diretoria do clube.
 */
export default function CatalogAdmin() {
  const [type, setType] = useState('especialidade');
  const state = useLoad(() => api.get('/admin/catalog?type=' + type), [type]);
  const [importing, setImporting] = useState(false);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(null);
  const [result, setResult] = useState(null);
  const [adding, setAdding] = useState(false);
  const [busy, run] = useAsync();

  const doImport = async () => {
    const r = await run(() => api.post('/admin/catalog/import', { text }));
    notify(`${r.created} novas · ${r.updated} atualizadas${r.skipped ? ` · ${r.skipped} linhas ignoradas` : ''}`);
    setText('');
    setImporting(false);
    state.reload();
  };
  const uploadImages = async (files) => {
    if (!files.length) return;
    const r = await run(() => api.post('/admin/catalog/images', toForm({ images: [...files] })));
    setResult(r);
    state.reload();
  };

  return (
    <>
      <PageHeader title="Catálogo oficial" subtitle="Classes e especialidades com as fotos originais" />
      <Tabs tabs={[['especialidade', 'Especialidades'], ['classe', 'Classes']]} value={type} onChange={(t) => { setType(t); setResult(null); }} />
      <Card>
        <div className="stack">
          <label className="btn btn-primary btn-block"><Upload size={18} /> Enviar fotos (várias de uma vez)
            <input type="file" accept="image/*" multiple hidden onChange={(e) => { uploadImages(e.target.files); e.target.value = ''; }} />
          </label>
          <p className="muted small">Cada foto é ligada pelo <b>nome do arquivo</b>: “Nós e Amarras.png”, “nos-e-amarras.jpg” ou pelo código (“AR-012.png”). Pode mandar a pasta inteira.</p>
          <div className="grid2">
            <Button variant="secondary" onClick={() => setAdding(true)}><Plus size={16} /> Adicionar {type === 'classe' ? 'classe' : 'especialidade'}</Button>
            {type === 'especialidade' && <Button variant="secondary" onClick={() => setImporting(true)}><FileUp size={16} /> Importar lista</Button>}
          </div>
          {busy && <p className="small muted">Enviando…</p>}
          {result && (
            <div className="small">
              <Badge kind="green">{result.matched.length} fotos ligadas</Badge>{' '}
              {result.unmatched.length > 0 && <><Badge kind="red">{result.unmatched.length} sem par</Badge><p className="muted small">Sem par: {result.unmatched.slice(0, 20).join(', ')}{result.unmatched.length > 20 ? '…' : ''}</p></>}
            </div>
          )}
        </div>
      </Card>
      <Loading {...state}>
        {(d) => {
          const withImg = d.items.filter((c) => c.image).length;
          return (
            <>
              <p className="muted small mt">{d.items.length} itens · {withImg} com foto</p>
              {groupCatalog(type, d.items).map(([g, list]) => (
                <Section key={g} title={`${g} (${list.length})`}>
                  <div className="list">
                    {list.map((c) => (
                      <div key={c.id} className="list-item">
                        <CatalogBadge c={c} size={48} />
                        <div className="grow">
                          <div className="title">{c.name}</div>
                          <div className="sub">{c.code ? c.code + ' · ' : ''}{c.age ? `${c.age} anos · ` : ''}{c.holders} no perfil{!c.image ? ' · sem foto' : ''}</div>
                        </div>
                        <button type="button" className="icon-btn" aria-label="Editar" onClick={() => setEditing(c)}><Pencil size={18} /></button>
                        {!c.holders && <Confirm text={`Excluir "${c.name}" do catálogo?`} onYes={() => run(() => api.del('/admin/catalog/' + c.id), 'Excluído').then(state.reload)}><Trash2 size={14} /></Confirm>}
                      </div>
                    ))}
                  </div>
                </Section>
              ))}
              {adding && <AddItem type={type} areas={d.areas} onClose={() => setAdding(false)} onDone={() => { setAdding(false); state.reload(); }} />}
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
