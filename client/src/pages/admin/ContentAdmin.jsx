import { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronUp, ImageUp, Pencil, Trash2, X } from 'lucide-react';
import { api, toForm } from '../../api.js';
import { fmtDateTime, fmtMoney, plural } from '../../format.js';
import { CONTENT_ICON_KEYS, IconPicker, MEDAL_ICON_KEYS } from '../../icons.jsx';
import {
  Badge, Button, Card, Confirm, ContentIcon, Field, ImagesInput, Loading, MedalIcon, Modal, ModesPicker, PageHeader, QuizBuilder, Section, Tabs,
  modesLabel, useAsync, useLoad,
} from '../../ui.jsx';

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
        <Field group label={f.type === 'classe' ? 'Insígnia da classe' : 'Imagem'} hint="Envie a imagem oficial (PNG com fundo transparente fica melhor). Sem imagem, usa o ícone abaixo.">
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
          <label className="check"><input type="checkbox" checked={f.is_free} onChange={set('is_free')} /> Grátis</label>
          {!f.is_free && <Field label={f.type === 'classe' ? 'Preço da classe (R$)' : 'Preço (R$)'} hint="Valor fixo do item inteiro"><input inputMode="decimal" value={f.price} onChange={set('price')} placeholder="19,90" /></Field>}
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
                  {c.type === 'classe' ? (c.leader ? 'Líder · ' : `${c.age} anos · `) : ''}{plural(c.items_count, c.type === 'curso' ? 'aula' : 'requisito', c.type === 'curso' ? 'aulas' : 'requisitos')} · {c.is_free ? 'Grátis' : fmtMoney(c.price_cents)}
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

/** Medalhas e troféus: aqui só se cria (sempre grátis). A entrega fica em "Entregar conteúdo". */
function MedalsList() {
  const state = useLoad(() => api.get('/admin/medals'));
  const [creating, setCreating] = useState(false);
  const [f, setF] = useState({ kind: 'medalha', name: '', description: '', icon: 'medal', icon_file: null });
  const [busy, run] = useAsync();
  const create = async () => {
    await run(() => api.post('/admin/medals', toForm(f)), 'Criado!');
    setCreating(false);
    setF({ kind: 'medalha', name: '', description: '', icon: 'medal', icon_file: null });
    state.reload();
  };
  return (
    <>
      <Button block onClick={() => setCreating(true)}>+ Nova medalha ou troféu</Button>
      <p className="muted small mt">Para entregar, use “Entregar conteúdo” no menu Mais.</p>
      <Loading {...state} empty="Nenhuma medalha criada.">
        {(list) => (
          <div className="list mt">
            {list.map((m) => (
              <div key={m.id} className="list-item">
                <span className="medal-icon" style={{ width: 50, height: 50 }}><MedalIcon icon={m.icon} size={26} /></span>
                <div className="grow">
                  <div className="title">{m.name}</div>
                  <div className="sub">{m.kind === 'trofeu' ? 'Troféu' : 'Medalha'} · entregue {plural(m.award_count, 'vez', 'vezes')}</div>
                </div>
                <Confirm text="Excluir? Também some de quem recebeu." onYes={() => run(() => api.del('/admin/medals/' + m.id), 'Excluída').then(state.reload)}><Trash2 size={14} /></Confirm>
              </div>
            ))}
          </div>
        )}
      </Loading>
      {creating && (
        <Modal title="Nova medalha ou troféu" onClose={() => setCreating(false)} footer={<Button busy={busy} onClick={create}>Criar</Button>}>
          <div className="form">
            <Tabs tabs={[['medalha', 'Medalha'], ['trofeu', 'Troféu']]} value={f.kind} onChange={(kind) => setF({ ...f, kind, icon: kind === 'trofeu' ? 'trophy' : 'medal' })} />
            <Field label="Nome" hint="Ex.: Melhor clube do mês"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Descrição"><textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
            <Field group label="Ícone"><IconPicker keys={MEDAL_ICON_KEYS} value={f.icon_file ? null : f.icon} onChange={(icon) => setF({ ...f, icon, icon_file: null })} /></Field>
            <Field label="ou envie uma imagem"><input type="file" accept="image/*" onChange={(e) => setF({ ...f, icon_file: e.target.files[0] || null })} /></Field>
          </div>
        </Modal>
      )}
    </>
  );
}

const STATUS = { pendente: ['yellow', 'Pendente'], pago: ['green', 'Aprovada'], cancelado: ['red', 'Recusada'] };

/** Compras: aprovar ou recusar. Com pagamento automático, a aprovação acontece sozinha. */
function Purchases() {
  const purchases = useLoad(() => api.get('/admin/purchases'));
  const access = useLoad(() => api.get('/admin/access'));
  const [, run] = useAsync();
  const reload = () => { purchases.reload(); access.reload(); };
  return (
    <>
      <Card className="small muted">Quando o pagamento automático estiver ligado, a compra é aprovada sozinha assim que o pagamento é confirmado. Sem ele, aprove ou recuse aqui.</Card>
      <Section title="Pedidos de compra">
        <Loading {...purchases} empty="Nenhum pedido.">
          {(list) => (
            <div className="list">
              {list.map((p) => (
                <div key={p.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                  <span className="content-icon"><ContentIcon c={p} size={22} /></span>
                  <div className="grow">
                    <div className="row between"><span className="title">{p.content_name}</span><Badge kind={STATUS[p.status][0]}>{STATUS[p.status][1]}</Badge></div>
                    <div className="sub">{p.member_name}{p.member_handle ? ` · @${p.member_handle}` : ''} · {p.club_name}</div>
                    <div className="sub">{fmtMoney(p.price_cents)} · {fmtDateTime(p.created_at)}</div>
                    {p.status === 'pendente' && (
                      <div className="row" style={{ marginTop: '.5rem' }}>
                        <Button small variant="green" onClick={() => run(() => api.post(`/admin/purchases/${p.id}/confirm`), 'Compra aprovada').then(reload)}><Check size={14} /> Aprovar</Button>
                        <Button small variant="danger" onClick={() => run(() => api.post(`/admin/purchases/${p.id}/cancel`), 'Compra recusada').then(reload)}><X size={14} /> Recusar</Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Loading>
      </Section>
      <Section title="Acessos liberados">
        <Loading {...access} empty="Nenhum acesso liberado.">
          {(list) => (
            <div className="list">
              {list.map((a) => (
                <div key={a.member_id + '-' + a.content_id} className="list-item">
                  <span className="content-icon"><ContentIcon c={a} size={22} /></span>
                  <div className="grow"><div className="title">{a.content_name}</div><div className="sub">{a.member_name} · {a.source === 'admin' ? 'liberado pela administração' : 'compra'}</div></div>
                  <Confirm text="Remover este acesso?" onYes={() => run(() => api.del(`/admin/access/${a.member_id}/${a.content_id}`), 'Acesso removido').then(reload)}>Remover</Confirm>
                </div>
              ))}
            </div>
          )}
        </Loading>
      </Section>
    </>
  );
}

const TABS = [['curso', 'Cursos'], ['medalhas', 'Medalhas e troféus'], ['compras', 'Compras']];

/** Conteúdo: tudo o que o Administrador Geral cria (e vende). */
export default function ContentAdmin() {
  const [tab, setTab] = useState(new URLSearchParams(location.search).get('aba') || 'curso');
  return (
    <>
      <PageHeader title="Conteúdo" subtitle="Cursos (grátis ou pagos), medalhas e troféus (sempre grátis)" />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'medalhas' ? <MedalsList /> : tab === 'compras' ? <Purchases /> : <ContentList key={tab} type={tab} />}
    </>
  );
}
