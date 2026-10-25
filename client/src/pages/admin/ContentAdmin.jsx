import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, ImageUp, Pencil, Trash2, X } from 'lucide-react';
import { api, toForm } from '../../api.js';
import { plural } from '../../format.js';
import { CONTENT_ICON_KEYS, IconPicker } from '../../icons.jsx';
import { Button, Confirm, ContentIcon, Field, ImagesInput, Loading, Modal, ModesPicker, PageHeader, QuizBuilder, Section, modesLabel, useAsync, useLoad } from '../../ui.jsx';

const TYPE_LABEL = { especialidade: 'Especialidade', classe: 'Classe', curso: 'Curso' };
const newItem = () => ({ title: '', body: '', modes: [], images: [], files: [], questions: [{ question: '', options: ['', ''], correct: 0 }], open: true });

function ItemEditor({ it, i, label, update, remove, move, count }) {
  return (
    <div className="item-editor">
      <div className="row between">
        <button type="button" className="item-editor-head" onClick={() => update({ open: !it.open })}>
          <span className="num">{i + 1}</span>
          <span className="grow ellipsis"><b>{it.title || `${label} ${i + 1}`}</b><small>{modesLabel(it.modes)}{(it.images.length + it.files.length) ? ` · ${it.images.length + it.files.length} foto(s)` : ''}</small></span>
          {it.open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        <div className="row" style={{ gap: '.1rem' }}>
          <button type="button" className="icon-btn" disabled={i === 0} aria-label="Subir" onClick={() => move(-1)}><ChevronUp size={18} /></button>
          <button type="button" className="icon-btn" disabled={i === count - 1} aria-label="Descer" onClick={() => move(1)}><ChevronDown size={18} /></button>
          <button type="button" className="icon-btn" aria-label="Remover" onClick={remove}><Trash2 size={18} /></button>
        </div>
      </div>
      {it.open && (
        <div className="form" style={{ marginTop: '.6rem' }}>
          <input placeholder="Título" value={it.title} onChange={(e) => update({ title: e.target.value })} />
          <textarea placeholder="Como fazer: explique o requisito" value={it.body} onChange={(e) => update({ body: e.target.value })} />
          <ImagesInput label="Fotos de exemplo (opcional)" urls={it.images} files={it.files} onUrls={(images) => update({ images })} onFiles={(files) => update({ files })} />
          <Field group label="O que o membro envia" hint="Marque quantas quiser. Sem nenhuma, ele só marca como feito.">
            <ModesPicker value={it.modes} onChange={(modes) => update({ modes })} allowNone />
          </Field>
          {it.modes.includes('quiz') && <QuizBuilder questions={it.questions} setQuestions={(questions) => update({ questions })} />}
        </div>
      )}
    </div>
  );
}

function ContentForm({ id, type, onClose, onDone }) {
  const existing = useLoad(() => (id ? api.get('/admin/content/' + id) : Promise.resolve(null)), [id]);
  const [f, setF] = useState(null);
  const [busy, run] = useAsync();
  useEffect(() => {
    if (existing.loading) return;
    const c = existing.data;
    setF(c
      ? {
        ...c, is_free: !!c.is_free, leader: !!c.leader, price: c.price_cents ? (c.price_cents / 100).toFixed(2).replace('.', ',') : '', age: c.age ?? '',
        imageFile: null, remove_image: false,
        items: c.items.map((i) => ({ ...i, files: [], questions: i.questions.length ? i.questions : [{ question: '', options: ['', ''], correct: 0 }], open: false })),
      }
      : { type, name: '', description: '', icon: type === 'curso' ? 'graduation' : type === 'classe' ? 'compass' : 'knot', category: '', age: '', leader: false, is_free: true, price: '', image: null, imageFile: null, items: [newItem()] });
  }, [existing.loading, existing.data, type]);
  if (!f) return null;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const updItem = (i, patch) => setF({ ...f, items: f.items.map((it, k) => (k === i ? { ...it, ...patch } : it)) });
  const moveItem = (i, d) => {
    const items = [...f.items];
    [items[i], items[i + d]] = [items[i + d], items[i]];
    setF({ ...f, items });
  };
  const itemLabel = f.type === 'curso' ? 'Aula' : 'Requisito';
  const save = async () => {
    const data = {
      ...f, imageFile: undefined,
      items: f.items.map(({ id: itemId, title, body, modes, images, questions }) => ({ id: itemId, title, body, modes, images, questions: modes.includes('quiz') ? questions : [] })),
    };
    const extra = {};
    f.items.forEach((it, i) => { if (it.files.length) extra[`item_${i}`] = it.files; });
    const body = toForm({ data, image: f.imageFile || undefined, ...extra });
    await run(() => (id ? api.put('/admin/content/' + id, body) : api.post('/admin/content', body)), 'Salvo!');
    onDone();
  };
  const preview = f.imageFile ? URL.createObjectURL(f.imageFile) : f.remove_image ? null : f.image;
  return (
    <Modal title={(id ? 'Editar ' : 'Nova ') + TYPE_LABEL[f.type].toLowerCase()} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button busy={busy} onClick={save}>Salvar</Button></>}>
      <div className="form">
        <Field label="Nome"><input value={f.name} onChange={set('name')} /></Field>
        <Field group label={f.type === 'classe' ? 'Especialidade da classe' : 'Imagem'} hint="Envie a imagem oficial (PNG com fundo transparente fica melhor). Sem imagem, usa o ícone abaixo.">
          <div className="row">
            <span className="content-icon" style={{ width: 72, height: 72 }}>{preview ? <img src={preview} alt="" className="content-img" /> : <ContentIcon c={{ icon: f.icon }} size={30} />}</span>
            <label className="btn btn-secondary btn-sm"><ImageUp size={15} /> Enviar imagem
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && setF({ ...f, imageFile: e.target.files[0], remove_image: false })} />
            </label>
            {preview && <Button small variant="danger" onClick={() => setF({ ...f, imageFile: null, remove_image: true })}><X size={14} /> Tirar</Button>}
          </div>
        </Field>
        {!preview && <Field group label="Ícone"><IconPicker keys={CONTENT_ICON_KEYS} value={f.icon} onChange={(icon) => setF({ ...f, icon })} /></Field>}
        <Field label="Descrição"><textarea value={f.description} onChange={set('description')} /></Field>
        {f.type === 'especialidade' && <Field label="Categoria"><input value={f.category} onChange={set('category')} /></Field>}
        {f.type === 'classe' && (
          <div className="grid2">
            <label className="check"><input type="checkbox" checked={f.leader} onChange={set('leader')} /> Classe de líder</label>
            {!f.leader && <Field label="Idade"><input type="number" min="10" max="15" value={f.age} onChange={set('age')} /></Field>}
          </div>
        )}
        <div className="grid2">
        </div>
        <Section title={`${itemLabel}s (${f.items.length})`}>
          <div className="stack">
            {f.items.map((it, i) => (
              <ItemEditor key={it.id || 'n' + i} it={it} i={i} label={itemLabel} count={f.items.length}
                update={(p) => updItem(i, p)} move={(d) => moveItem(i, d)} remove={() => setF({ ...f, items: f.items.filter((_, k) => k !== i) })} />
            ))}
            <Button type="button" variant="secondary" onClick={() => setF({ ...f, items: [...f.items.map((x) => ({ ...x, open: false })), newItem()] })}>+ {itemLabel}</Button>
          </div>
        </Section>
      </div>
    </Modal>
  );
}

function ContentList({ type }) {
  const list = useLoad(() => api.get('/admin/content'), [type]);
  const [editing, setEditing] = useState(null);
  const [, run] = useAsync();
  return (
    <>
      <Button block onClick={() => setEditing({ id: null })}>+ Nova {TYPE_LABEL[type].toLowerCase()}</Button>
      <div className="list mt">
        <Loading {...list} empty="Nada cadastrado ainda.">
          {(items) => items.map((c) => (
            <div key={c.id} className="list-item">
              <span className="content-icon"><ContentIcon c={c} size={24} /></span>
              <div className="grow">
                <div className="title">{c.name}</div>
                <div className="sub">
                  {plural(c.items_count, c.type === 'curso' ? 'aula' : 'requisito', c.type === 'curso' ? 'aulas' : 'requisitos')}
                </div>
              </div>
              <button type="button" className="icon-btn" aria-label="Editar" onClick={() => setEditing({ id: c.id })}><Pencil size={18} /></button>
              <Confirm text={`Excluir "${c.name}"? Some também do perfil de quem concluiu.`} onYes={() => run(() => api.del('/admin/content/' + c.id), 'Excluído').then(list.reload)}><Trash2 size={14} /></Confirm>
            </div>
          ))}
        </Loading>
      </div>
      {editing && <ContentForm id={editing.id} type={type} onClose={() => setEditing(null)} onDone={() => { setEditing(null); list.reload(); }} />}
    </>
  );
}

/**
 * Conteúdo: tudo o que o Administrador Geral cria. Nada é vendido. Troféus e medalhas não são criados
 * aqui: os troféus vêm dos rankings finalizados e as medalhas dos mini-jogos.
 */
export default function ContentAdmin() {
  return (
    <>
      <PageHeader title="Conteúdo" subtitle="Cursos" />
      <ContentList type="curso" />
    </>
  );
}
