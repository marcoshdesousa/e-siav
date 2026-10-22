// Lição da Escola Sabatina (admin geral): envia os PDFs e cria a lição de cada dia
// (categoria, páginas do PDF, vídeo do YouTube opcional e 1 a 5 perguntinhas).
import { useState } from 'react';
import { FileText, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { api } from '../../api.js';
import { Button, Card, Field, Loading, Modal, Section, useAsync, useLoad } from '../../ui.jsx';

const br = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
const emptyQ = () => ({ q: '', options: ['', '', '', ''], answer: 0 });

function LessonForm({ item, d, onClose, onSaved }) {
  const [f, setF] = useState(() => item ? { ...item, pdf_id: item.pdf_id || '', page_from: item.page_from || '', page_to: item.page_to || '', youtube: item.youtube || '' }
    : { category: d.categories[0].id, date: new Date().toISOString().slice(0, 10), title: '', pdf_id: d.pdfs[0]?.id || '', page_from: '', page_to: '', youtube: '', questions: [emptyQ(), emptyQ()] });
  const [busy, run] = useAsync();
  const setQ = (i, patch) => setF({ ...f, questions: f.questions.map((q, k) => (k === i ? { ...q, ...patch } : q)) });
  const save = () => run(async () => {
    const body = { ...f, questions: f.questions.map((q) => ({ ...q, options: q.options.filter((o) => o.trim()) })) };
    if (item) await api.put(`/admin/escola-sabatina/licoes/${item.id}`, body); else await api.post('/admin/escola-sabatina/licoes', body);
    onSaved();
  }, 'Lição salva!');
  return (
    <Modal title={item ? 'Editar lição' : 'Nova lição'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button busy={busy} onClick={save}>Salvar</Button></>}>
      <div className="form">
        <div className="grid2">
          <Field label="Categoria"><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{d.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Dia da lição"><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        </div>
        <Field label="Título"><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ex.: Domingo — A criação" /></Field>
        <Field label="PDF da lição" hint="Envie o PDF na lista abaixo e escolha aqui. Pode deixar sem PDF se tiver vídeo.">
          <select value={f.pdf_id} onChange={(e) => setF({ ...f, pdf_id: e.target.value })}>
            <option value="">Sem PDF</option>
            {d.pdfs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        {f.pdf_id && (
          <div className="grid2">
            <Field label="Da página"><input type="number" min="1" value={f.page_from} onChange={(e) => setF({ ...f, page_from: e.target.value })} /></Field>
            <Field label="Até a página"><input type="number" min="1" value={f.page_to} onChange={(e) => setF({ ...f, page_to: e.target.value })} /></Field>
          </div>
        )}
        <Field label="Vídeo do YouTube (opcional)"><input value={f.youtube} onChange={(e) => setF({ ...f, youtube: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." /></Field>
        <p className="small"><b>Perguntas</b> (2 ou 3 bastam para confirmar o estudo)</p>
        {f.questions.map((q, i) => (
          <Card key={i} className="small">
            <Field label={`Pergunta ${i + 1}`}><input value={q.q} onChange={(e) => setQ(i, { q: e.target.value })} /></Field>
            {q.options.map((o, k) => (
              <label key={k} className="row" style={{ alignItems: 'center', gap: '.4rem' }}>
                <input type="radio" name={`ans${i}`} checked={q.answer === k} onChange={() => setQ(i, { answer: k })} aria-label="Resposta certa" />
                <input value={o} onChange={(e) => setQ(i, { options: q.options.map((x, j) => (j === k ? e.target.value : x)) })} placeholder={`Opção ${'ABCD'[k]}`} />
              </label>
            ))}
            {f.questions.length > 1 && <Button small variant="secondary" onClick={() => setF({ ...f, questions: f.questions.filter((_x, k) => k !== i) })}><Trash2 size={14} /> Tirar pergunta</Button>}
          </Card>
        ))}
        {f.questions.length < 5 && <Button small variant="secondary" onClick={() => setF({ ...f, questions: [...f.questions, emptyQ()] })}><Plus size={14} /> Pergunta</Button>}
        <p className="small muted">Marque a bolinha da resposta certa de cada pergunta.</p>
      </div>
    </Modal>
  );
}

export default function SabbathAdmin() {
  const state = useLoad(() => api.get('/admin/escola-sabatina'));
  const [busy, run] = useAsync();
  const [modal, setModal] = useState(null);
  const upload = async (files) => {
    const form = new FormData();
    [...files].forEach((f) => form.append('files', f));
    await run(() => api.post('/admin/escola-sabatina/pdfs', form), 'PDF enviado!');
    state.reload();
  };
  return (
    <Loading {...state}>
      {(d) => (
        <>
          <Section title="PDFs das lições">
            <label className="btn btn-primary btn-block"><Upload size={16} /> Enviar PDF<input type="file" accept="application/pdf" multiple hidden onChange={(e) => upload(e.target.files)} /></label>
            <div className="list mt">
              {d.pdfs.map((p) => (
                <div key={p.id} className="list-item">
                  <FileText size={22} />
                  <div className="grow"><div className="title">{p.name}</div><div className="sub">{Math.round(p.size / 1024)} KB</div></div>
                  <Button small variant="secondary" busy={busy} onClick={() => window.confirm('Apagar este PDF?') && run(() => api.del(`/admin/escola-sabatina/pdfs/${p.id}`)).then(state.reload)}><Trash2 size={14} /></Button>
                </div>
              ))}
            </div>
          </Section>
          <Section title="Lições">
            <Button block onClick={() => setModal({})}><Plus size={16} /> Nova lição</Button>
            <div className="list mt">
              {d.lessons.length ? d.lessons.map((l) => (
                <div key={l.id} className="list-item">
                  <div className="grow">
                    <div className="title">{l.title}</div>
                    <div className="sub">{d.categories.find((c) => c.id === l.category)?.name} · {br(l.date)}{l.pdf_name ? ` · ${l.pdf_name} (p. ${l.page_from || 1}–${l.page_to || '…'})` : ''}{l.youtube ? ' · vídeo' : ''} · {l.questions.length} perguntas · {l.done} fizeram</div>
                  </div>
                  <Button small variant="secondary" onClick={() => setModal({ item: l })}><Pencil size={14} /></Button>
                  <Button small variant="secondary" busy={busy} onClick={() => window.confirm('Apagar esta lição?') && run(() => api.del(`/admin/escola-sabatina/licoes/${l.id}`)).then(state.reload)}><Trash2 size={14} /></Button>
                </div>
              )) : <p className="small muted">Nenhuma lição ainda.</p>}
            </div>
          </Section>
          {modal && <LessonForm item={modal.item} d={d} onClose={() => setModal(null)} onSaved={() => { setModal(null); state.reload(); }} />}
        </>
      )}
    </Loading>
  );
}
