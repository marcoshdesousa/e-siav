// Formulários (administrador geral): os criados, o link para mandar, criar outros e ver as respostas.
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, ChevronRight, ClipboardList, Copy, Download, ExternalLink, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import { api } from '../../api.js';
import { fmtDate } from '../../format.js';
import { Button, Card, Confirm, Empty, Field, Loading, Modal, PageHeader, Section, Tabs, notify, useAsync, useLoad } from '../../ui.jsx';
import '../forms.css';

const linkOf = (slug) => `${location.origin}/formulario/${slug}`;
const TYPE_NAME = { estrelas: '1 a 5 estrelas', simnao: 'Sim ou não', texto: 'Texto livre', escolha: 'Escolher uma opção' };

function copy(text) {
  navigator.clipboard?.writeText(text).then(() => notify('Link copiado!'), () => notify('Não deu para copiar', 'error'));
}

/**
 * Criar ou editar formulário: título, texto, clubes e as perguntas. Editar não muda o link e não mexe
 * nas respostas que já chegaram (cada uma continua com as perguntas que foram respondidas).
 */
function FormEditor({ form, onClose, onDone }) {
  const [title, setTitle] = useState(form?.title || '');
  const [description, setDescription] = useState(form?.description || '');
  const [clubs, setClubs] = useState((form?.clubs || ['Clube Titânio', 'Clube Alfa', 'Clube Querubins', 'Clube Astro de Luz', 'Clube Estrela Guia', 'Clube Samuel Snow']).join('\n'));
  const [qs, setQs] = useState(form ? form.questions.map((q) => ({ ...q, optionsText: (q.options || []).join('\n') })) : [{ type: 'estrelas', q: '' }]);
  const [busy, run] = useAsync();
  const setQ = (i, patch) => setQs((l) => l.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  const move = (i, d) => setQs((l) => { const c = [...l]; const j = i + d; if (j < 0 || j >= c.length) return l; [c[i], c[j]] = [c[j], c[i]]; return c; });
  const body = () => ({
    title, description, clubs: clubs.split('\n'),
    questions: qs.map(({ optionsText, ...q }) => ({ ...q, options: q.type === 'escolha' ? String(optionsText || '').split('\n') : undefined })),
  });
  const save = () => run(() => (form ? api.put(`/admin/formularios/${form.id}/editar`, body()) : api.post('/admin/formularios', body())), form ? 'Formulário atualizado' : 'Formulário criado').then((f) => f && onDone(f));
  return (
    <Modal title={form ? 'Editar formulário' : 'Novo formulário'} onClose={onClose} footer={<Button block busy={busy} onClick={save}>{form ? 'Salvar mudanças' : 'Criar formulário'}</Button>}>
      {form && <p className="small muted" style={{ marginTop: 0 }}>O link continua o mesmo e as respostas que já chegaram não mudam. Quem abrir o link depois de salvar já vê o formulário novo.</p>}
      <Field label="Título"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Avaliação do Campori" /></Field>
      <Field label="Texto de abertura" hint="Opcional"><textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <Field label="Clubes para escolher" hint="Um por linha. A opção “Outro clube” aparece sozinha."><textarea rows={4} value={clubs} onChange={(e) => setClubs(e.target.value)} /></Field>
      <span className="field-label">Perguntas</span>
      {qs.map((q, i) => (
        <div key={q.id || `n${i}`} className="fa-q">
          <div className="fa-q-row">
            <span className="fa-q-n">{i + 1}</span>
            {/* Mudar o tipo faz dela uma pergunta nova (as respostas antigas não se misturam). */}
            <select value={q.type} onChange={(e) => setQ(i, { type: e.target.value, id: undefined })}>
              {Object.entries(TYPE_NAME).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button type="button" className="icon-btn" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={16} /></button>
            <button type="button" className="icon-btn" aria-label="Descer" disabled={i === qs.length - 1} onClick={() => move(i, 1)}><ArrowDown size={16} /></button>
            <button type="button" className="icon-btn" aria-label="Tirar pergunta" onClick={() => setQs((l) => l.filter((_, k) => k !== i))}><X size={18} /></button>
          </div>
          <textarea rows={2} value={q.q} onChange={(e) => setQ(i, { q: e.target.value })} placeholder={`Pergunta ${i + 1}`} />
          {q.type === 'escolha' && <textarea rows={3} value={q.optionsText || ''} onChange={(e) => setQ(i, { optionsText: e.target.value })} placeholder="Opções, uma por linha" />}
        </div>
      ))}
      <Button small variant="secondary" onClick={() => setQs((l) => [...l, { type: 'texto', q: '' }])}><Plus size={14} /> Pergunta</Button>
    </Modal>
  );
}

export default function FormsAdmin({ base }) {
  const state = useLoad(() => api.get('/admin/formularios'));
  const [creating, setCreating] = useState(false);
  return (
    <>
      <PageHeader title="Formulários" subtitle="Links para responder fora do app. As respostas aparecem aqui." />
      <div className="row" style={{ marginBottom: '.8rem' }}>
        <Button onClick={() => setCreating(true)}><Plus size={16} /> Novo formulário</Button>
      </div>
      <Section title="Formulários criados">
        <Loading {...state}>
          {(list) => (list.length ? (
            <div className="fa-list">
              {list.map((f) => (
                <Link key={f.id} to={`${base}/formularios/${f.id}`} className="fa-item">
                  <span className="fa-ico"><ClipboardList size={22} /></span>
                  <span className="grow"><b>{f.title}</b><small>{f.active ? 'Recebendo respostas' : 'Encerrado'}{f.last_at ? ` · última em ${fmtDate(f.last_at)}` : ''}</small></span>
                  <span className="fa-count">{f.responses}<small>{f.responses === 1 ? 'resposta' : 'respostas'}</small></span>
                  <ChevronRight size={18} className="muted" />
                </Link>
              ))}
            </div>
          ) : <Empty icon={ClipboardList}>Nenhum formulário ainda.</Empty>)}
        </Loading>
      </Section>
      {creating && <FormEditor onClose={() => setCreating(false)} onDone={() => { setCreating(false); state.reload(); }} />}
    </>
  );
}

function StarsRow({ n }) {
  return <span className="fa-stars-row">{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={18} className={i <= Math.round(n) ? 'on' : ''} />)}</span>;
}
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

/** Resposta de uma pessoa para a pergunta (pelo código da pergunta, na versão que ela respondeu). */
const answerOf = (r, id) => { const i = r.questions.findIndex((q) => q.id === id); return i < 0 ? undefined : r.answers[i]; };
/** As perguntas de agora e, no fim, as que saíram do formulário mas têm respostas. */
function allQuestions(form, rows) {
  const ids = new Set(form.questions.map((q) => q.id));
  const old = [];
  for (const r of rows) for (const q of r.questions) if (!ids.has(q.id)) { ids.add(q.id); old.push({ ...q, removed: true }); }
  return [...form.questions, ...old];
}

/** Resumo de cada pergunta: média das estrelas, sim/não em porcentagem e as respostas escritas. */
function Summary({ form, rows }) {
  return (
    <div className="fa-stats">
      {allQuestions(form, rows).map((q, i) => {
        const vals = rows.map((r) => answerOf(r, q.id)).filter((v) => v != null && v !== '');
        let body;
        if (q.type === 'estrelas') {
          const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
          body = (
            <>
              <div className="fa-big"><strong>{avg.toFixed(1).replace('.', ',')}</strong><StarsRow n={avg} /></div>
              {[5, 4, 3, 2, 1].map((s) => {
                const c = vals.filter((v) => v === s).length;
                return <div key={s} className="fa-bar"><span>{s} estrela{s > 1 ? 's' : ''}</span><i><em style={{ width: `${pct(c, vals.length)}%` }} /></i><span>{c}</span></div>;
              })}
            </>
          );
        } else if (q.type === 'simnao' || q.type === 'escolha') {
          const opts = q.type === 'simnao' ? [['sim', 'Sim'], ['nao', 'Não']] : [...new Set([...(q.options || []), ...vals])].map((o) => [o, o]);
          body = opts.map(([k, l]) => {
            const c = vals.filter((v) => v === k).length;
            return <div key={k} className={'fa-bar ' + (q.type === 'simnao' ? k : '')}><span>{l}</span><i><em style={{ width: `${pct(c, vals.length)}%` }} /></i><span>{pct(c, vals.length)}% ({c})</span></div>;
          });
        } else {
          body = vals.length ? <div className="fa-texts">{rows.filter((r) => answerOf(r, q.id)).map((r) => <p key={r.id}><small>{r.name} · {r.club}</small>{answerOf(r, q.id)}</p>)}</div> : <p className="small muted">Sem respostas.</p>;
        }
        return (
          <div key={q.id} className={'fa-stat' + (q.removed ? ' removed' : '')}>
            {q.removed && <span className="fa-removed">Pergunta que saiu do formulário</span>}
            <b>{q.removed ? '' : `${i + 1}. `}{q.q}</b>
            <small className="fa-n">{vals.length} {vals.length === 1 ? 'resposta' : 'respostas'}</small>
            {body}
          </div>
        );
      })}
    </div>
  );
}

const show = (q, v) => (v == null ? '—' : q.type === 'estrelas' ? `${'★'.repeat(v)}${'☆'.repeat(5 - v)} (${v})` : q.type === 'simnao' ? (v === 'sim' ? 'Sim' : 'Não') : v);

/** Planilha (CSV) com todas as respostas, para abrir no Excel. */
function exportCsv(form, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const qs = allQuestions(form, rows);
  const head = ['Data', 'Nome', 'Clube', ...qs.map((q) => q.q)];
  const lines = rows.map((r) => [fmtDate(r.created_at), r.name, r.club, ...qs.map((q) => { const v = answerOf(r, q.id); return q.type === 'simnao' && v ? (v === 'sim' ? 'Sim' : 'Não') : v; })]);
  const csv = '\ufeff' + [head, ...lines].map((l) => l.map(esc).join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `${form.slug}.csv`;
  a.click();
}

export function FormResponses() {
  const { id } = useParams();
  const state = useLoad(() => api.get(`/admin/formularios/${id}/respostas`), [id]);
  const [tab, setTab] = useState('resumo');
  const [club, setClub] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, run] = useAsync();
  const d = state.data;
  const rows = useMemo(() => (d ? d.responses.filter((r) => !club || r.club === club) : []), [d, club]);
  const clubs = useMemo(() => (d ? [...new Set(d.responses.map((r) => r.club))].sort() : []), [d]);
  return (
    <Loading {...state}>
      {({ form }) => (
        <>
          <PageHeader title={form.title} subtitle={`${d.responses.length} ${d.responses.length === 1 ? 'resposta' : 'respostas'} · ${form.active ? 'recebendo respostas' : 'encerrado'}`} />
          <Card>
            <span className="field-label">Link do formulário</span>
            <div className="fa-link">
              <input readOnly value={linkOf(form.slug)} onFocus={(e) => e.target.select()} />
              <Button small onClick={() => copy(linkOf(form.slug))}><Copy size={14} /> Copiar</Button>
            </div>
            <div className="row wrap" style={{ gap: '.4rem' }}>
              <Button small onClick={() => setEditing(true)}><Pencil size={14} /> Editar</Button>
              <a className="btn btn-secondary btn-sm" href={linkOf(form.slug)} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Abrir</a>
              <Button small variant="secondary" busy={busy} onClick={() => run(() => api.put(`/admin/formularios/${form.id}`, { active: !form.active }), form.active ? 'Formulário encerrado' : 'Formulário aberto').then(state.reload)}>
                {form.active ? 'Encerrar respostas' : 'Abrir de novo'}
              </Button>
              {d.responses.length > 0 && <Button small variant="secondary" onClick={() => exportCsv(form, rows)}><Download size={14} /> Planilha</Button>}
            </div>
          </Card>
          {d.responses.length === 0 ? <Empty icon={ClipboardList}>Ninguém respondeu ainda. Mande o link!</Empty> : (
            <>
              <div className="row wrap" style={{ gap: '.5rem', margin: '.8rem 0 .4rem', alignItems: 'center' }}>
                <Tabs tabs={[['resumo', 'Resumo'], ['respostas', 'Cada resposta']]} value={tab} onChange={setTab} />
                <select value={club} onChange={(e) => setClub(e.target.value)} style={{ width: 'auto' }} aria-label="Clube">
                  <option value="">Todos os clubes ({d.responses.length})</option>
                  {clubs.map((c) => <option key={c} value={c}>{c} ({d.responses.filter((r) => r.club === c).length})</option>)}
                </select>
              </div>
              {tab === 'resumo' ? <Summary form={form} rows={rows} /> : (
                <div className="fa-list">
                  {rows.map((r) => (
                    <div key={r.id} className="fa-resp">
                      <div className="fa-resp-head">
                        <div><b>{r.name}</b><small>{r.club} · {fmtDate(r.created_at)}</small></div>
                        <Confirm variant="secondary" text={`Apagar a resposta de ${r.name}?`} onYes={() => run(() => api.del(`/admin/formularios/${form.id}/respostas/${r.id}`), 'Resposta apagada').then(state.reload)}><Trash2 size={14} /></Confirm>
                      </div>
                      <dl>{r.questions.map((q, i) => <div key={q.id || i}><dt>{q.q}</dt><dd>{show(q, r.answers[i])}</dd></div>)}</dl>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {editing && <FormEditor form={form} onClose={() => setEditing(false)} onDone={() => { setEditing(false); state.reload(); }} />}
        </>
      )}
    </Loading>
  );
}
