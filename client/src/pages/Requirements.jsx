import { useState } from 'react';
import { CalendarClock, CheckCircle2, ClipboardList, Globe2, Star, Trash2, X, XCircle } from 'lucide-react';
import { api, toForm } from '../api.js';
import { useAuth } from '../auth.jsx';
import { AUDIENCE_LABEL, MODEL_LABEL, fmtDateTime, isoToLocal, localToIso, timeLeft } from '../format.js';
import { Avatar, Badge, Button, Card, Confirm, Empty, Field, Loading, Modal, Section, StateBadge, Tabs, useAsync, useLoad, notify } from '../ui.jsx';

const needsText = (m) => m === 'texto' || m === 'texto_foto';
const needsPhoto = (m) => m === 'foto' || m === 'texto_foto' || m === 'quiz_foto';
const hasQuiz = (m) => m === 'quiz' || m === 'quiz_foto';

export function Lightbox({ src, onClose }) {
  if (!src) return null;
  return <div className="lightbox" onClick={onClose}><img src={src} alt="" /></div>;
}

function RequirementCard({ r, onSubmit }) {
  const left = timeLeft(r.deadline);
  const canSend = ['pendente', 'fora_do_prazo', 'recusado'].includes(r.state);
  const s = r.submission;
  return (
    <Card className="req-card">
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <h3 className="grow">{r.title}</h3>
        <StateBadge state={r.state} late={!!s?.late} />
      </div>
      {r.description && <p className="muted small">{r.description}</p>}
      <div className="req-meta">
        <span className="ico"><ClipboardList size={14} /> {MODEL_LABEL[r.model]}</span>
        <span className="req-points ico"><Star size={14} /> {r.points} pts no prazo</span>
        <span>⏱️ {r.late_points} pts fora do prazo</span>
      </div>
      <div className="req-meta">
        <span className={'ico' + (left && left.includes('hora') ? ' deadline-soon' : '')}><CalendarClock size={14} /> Prazo: {fmtDateTime(r.deadline)}{left ? ` (faltam ${left})` : ' — encerrado'}</span>
      </div>
      {s && s.status !== 'recusado' && (
        <div className="small" style={{ marginTop: '.3rem' }}>
          {s.status === 'aprovado' ? <b className="ico" style={{ color: 'var(--green)' }}><CheckCircle2 size={15} /> +{s.points} pontos</b> : <span className="muted">Aguardando avaliação de quem criou o requisito.</span>}
          {s.quiz_total ? <span className="muted"> · Quiz: {s.quiz_correct}/{s.quiz_total} acertos</span> : null}
        </div>
      )}
      {s?.status === 'recusado' && <p className="small" style={{ color: 'var(--red)' }}>Envio recusado{s.feedback ? `: “${s.feedback}”` : ''}. Você pode enviar de novo.</p>}
      {s?.status === 'aprovado' && s.feedback && <p className="small muted">Comentário: “{s.feedback}”</p>}
      {canSend && (
        <div className="mt">
          <Button block variant={r.state === 'pendente' ? 'primary' : 'red'} onClick={() => onSubmit(r)}>
            {r.state === 'recusado' ? 'Enviar novamente' : r.state === 'fora_do_prazo' ? `Enviar fora do prazo (${r.late_points} pts)` : 'Cumprir requisito'}
          </Button>
        </div>
      )}
    </Card>
  );
}

function SubmitModal({ r, onClose, onDone }) {
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState([]);
  const [answers, setAnswers] = useState(r.questions.map(() => null));
  const [busy, run] = useAsync();
  const submit = async () => {
    if (hasQuiz(r.model) && answers.some((a) => a === null)) return notify('Responda todas as perguntas', 'error');
    const res = await run(() => api.post(`/requirements/${r.id}/submit`, toForm({ text, photos, answers: hasQuiz(r.model) ? answers : undefined })));
    if (res.status === 'aprovado') notify(`Quiz enviado! ${res.quiz_correct}/${res.quiz_total} acertos · +${res.points} pontos`);
    else notify('Enviado! Agora é aguardar a avaliação.');
    onDone();
  };
  return (
    <Modal title={r.title} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button busy={busy} onClick={submit}>Enviar</Button></>}>
      <div className="form">
        {Date.parse(r.deadline) < Date.now() && <Badge kind="red">Fora do prazo: vale {r.late_points} pontos</Badge>}
        {r.description && <p className="muted">{r.description}</p>}
        {needsText(r.model) && (
          <Field label="Relatório"><textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Conte como foi..." /></Field>
        )}
        {hasQuiz(r.model) && r.questions.map((q, i) => (
          <div key={q.id} className="quiz-q">
            <h4>{i + 1}. {q.question}</h4>
            {q.options.map((o, j) => (
              <label key={j} className={'quiz-opt' + (answers[i] === j ? ' selected' : '')}>
                <input type="radio" name={'q' + q.id} checked={answers[i] === j} onChange={() => setAnswers((a) => a.map((x, k) => (k === i ? j : x)))} />
                {o}
              </label>
            ))}
          </div>
        ))}
        {needsPhoto(r.model) && (
          <Field label="Fotos de comprovação" hint="Até 5 fotos">
            <input type="file" accept="image/*" multiple onChange={(e) => setPhotos([...e.target.files].slice(0, 5))} />
            {photos.length > 0 && <div className="photo-strip">{photos.map((p, i) => <img key={i} src={URL.createObjectURL(p)} alt="" />)}</div>}
          </Field>
        )}
      </div>
    </Modal>
  );
}

/** Requisitos para a conta logada cumprir. groupByOrigin: para a unidade (clube x geral). */
export function RequirementsTodo({ groupByOrigin = false }) {
  const state = useLoad(() => api.get('/requirements/mine'));
  const [sending, setSending] = useState(null);
  const [filter, setFilter] = useState('abertos');
  const open = (r) => ['pendente', 'fora_do_prazo', 'recusado', 'enviado'].includes(r.state);
  return (
    <Loading {...state}>
      {(list) => {
        const shown = list.filter((r) => (filter === 'abertos' ? open(r) && r.state !== 'enviado' : filter === 'enviados' ? r.state === 'enviado' : r.state === 'aprovado'));
        const counts = { abertos: list.filter((r) => open(r) && r.state !== 'enviado').length, enviados: list.filter((r) => r.state === 'enviado').length };
        const groups = groupByOrigin
          ? [['clube', 'Requisitos do seu clube'], ['geral', 'Requisitos gerais de unidade']]
          : [[null, null]];
        return (
          <>
            <Tabs tabs={[['abertos', 'A cumprir', counts.abertos], ['enviados', 'Em avaliação', counts.enviados], ['aprovados', 'Aprovados']]} value={filter} onChange={setFilter} />
            {groups.map(([origin, title]) => {
              const items = shown.filter((r) => !origin || r.origin === origin);
              return (
                <Section key={origin || 'all'} title={title}>
                  {items.length ? items.map((r) => <RequirementCard key={r.id} r={r} onSubmit={setSending} />) : <Empty icon={CheckCircle2}>Nada por aqui.</Empty>}
                </Section>
              );
            })}
            {sending && <SubmitModal r={sending} onClose={() => setSending(null)} onDone={() => { setSending(null); state.reload(); }} />}
          </>
        );
      }}
    </Loading>
  );
}

// ---------- Criação ----------
function QuizBuilder({ questions, setQuestions }) {
  const upd = (i, patch) => setQuestions(questions.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  return (
    <div className="stack">
      {questions.map((q, i) => (
        <div key={i} className="quiz-q stack">
          <div className="row between"><b>Pergunta {i + 1}</b><button type="button" className="icon-btn" onClick={() => setQuestions(questions.filter((_, k) => k !== i))} aria-label="Remover pergunta"><Trash2 size={18} /></button></div>
          <input placeholder="Enunciado" value={q.question} onChange={(e) => upd(i, { question: e.target.value })} />
          {q.options.map((o, j) => (
            <div key={j} className="row">
              <input type="radio" name={'c' + i} checked={q.correct === j} onChange={() => upd(i, { correct: j })} title="Resposta correta" />
              <input placeholder={`Opção ${j + 1}`} value={o} onChange={(e) => upd(i, { options: q.options.map((x, k) => (k === j ? e.target.value : x)) })} />
              {q.options.length > 2 && <button type="button" className="icon-btn" onClick={() => upd(i, { options: q.options.filter((_, k) => k !== j), correct: q.correct >= j && q.correct > 0 ? q.correct - 1 : q.correct })}><X size={16} /></button>}
            </div>
          ))}
          <div className="row">
            {q.options.length < 6 && <Button type="button" small variant="secondary" onClick={() => upd(i, { options: [...q.options, ''] })}>+ Opção</Button>}
            <span className="muted small">Marque a bolinha da resposta correta</span>
          </div>
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={() => setQuestions([...questions, { question: '', options: ['', ''], correct: 0 }])}>+ Adicionar pergunta</Button>
    </div>
  );
}

export function RequirementForm({ onClose, onDone }) {
  const { actor, meta } = useAuth();
  const isAdmin = actor.type === 'admin';
  const tomorrow = new Date(Date.now() + 7 * 864e5);
  tomorrow.setHours(23, 59, 0, 0);
  const [f, setF] = useState({
    title: '', description: '', model: 'texto', points: 50, late_points: 20, deadline: isoToLocal(tomorrow.toISOString()),
    audience: 'club', scope: 'geral', district_id: meta.districts[0]?.id || '',
  });
  const [questions, setQuestions] = useState([{ question: '', options: ['', ''], correct: 0 }]);
  const [busy, run] = useAsync();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    await run(() => api.post('/requirements', { ...f, deadline: localToIso(f.deadline), questions: hasQuiz(f.model) ? questions : [] }), 'Requisito criado!');
    onDone();
  };
  return (
    <Modal title="Novo requisito" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button busy={busy} onClick={submit}>Criar requisito</Button></>}>
      <div className="form">
        {isAdmin ? (
          <div className="grid2">
            <Field label="Para quem">
              <select value={f.audience} onChange={set('audience')}>
                <option value="club">Clubes</option>
                <option value="unit">Unidades (todos os clubes)</option>
                <option value="member">Desbravadores</option>
              </select>
            </Field>
            <Field label="Alcance">
              <select value={f.scope} onChange={set('scope')}>
                <option value="geral">Geral (todos os distritos)</option>
                <option value="distrito">Distrito</option>
              </select>
            </Field>
            {f.scope === 'distrito' && (
              <Field label="Distrito">
                <select value={f.district_id} onChange={set('district_id')}>
                  {meta.districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
            )}
          </div>
        ) : <Badge kind="blue">Para as unidades do seu clube</Badge>}
        <Field label="Título"><input value={f.title} onChange={set('title')} /></Field>
        <Field label="Descrição"><textarea value={f.description} onChange={set('description')} /></Field>
        <Field label="Modelo de envio">
          <select value={f.model} onChange={set('model')}>
            {Object.entries(MODEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <div className="grid2">
          <Field label="Pontos no prazo"><input type="number" min="0" value={f.points} onChange={set('points')} /></Field>
          <Field label="Pontos fora do prazo" hint="Menor ou zero"><input type="number" min="0" value={f.late_points} onChange={set('late_points')} /></Field>
        </div>
        <Field label="Prazo (data e hora)"><input type="datetime-local" value={f.deadline} onChange={set('deadline')} /></Field>
        {hasQuiz(f.model) && (
          <Field label="Perguntas do quiz" hint="A nota é proporcional aos acertos e calculada na hora.">
            <QuizBuilder questions={questions} setQuestions={setQuestions} />
          </Field>
        )}
      </div>
    </Modal>
  );
}

export function CreatedRequirements() {
  const { actor } = useAuth();
  const state = useLoad(() => api.get('/requirements/created'));
  const [creating, setCreating] = useState(false);
  const [, run] = useAsync();
  return (
    <>
      <Button block onClick={() => setCreating(true)}>+ Novo requisito</Button>
      <div className="mt">
        <Loading {...state} empty="Nenhum requisito criado ainda.">
          {(list) => list.map((r) => (
            <Card key={r.id} className="req-card">
              <div className="row between" style={{ alignItems: 'flex-start' }}>
                <h3 className="grow">{r.title}</h3>
                {actor.type === 'admin' && <Badge kind="blue">{AUDIENCE_LABEL[r.audience]}</Badge>}
              </div>
              <div className="req-meta">
                <span className="ico"><ClipboardList size={14} /> {MODEL_LABEL[r.model]}</span>
                <span className="req-points ico"><Star size={14} /> {r.points}/{r.late_points} pts</span>
                <span className="ico"><CalendarClock size={14} /> {fmtDateTime(r.deadline)}</span>
                {actor.type === 'admin' && <span className="ico"><Globe2 size={14} /> {r.scope === 'geral' ? 'Geral' : r.district_name}</span>}
              </div>
              <div className="row between">
                <span className="small muted">{r.submission_count} envios{r.pending_count ? ` · ${r.pending_count} para avaliar` : ''}</span>
                <Confirm text="Excluir este requisito e todos os envios (os pontos saem do ranking)?" onYes={() => run(() => api.del('/requirements/' + r.id), 'Requisito excluído').then(state.reload)}>Excluir</Confirm>
              </div>
            </Card>
          ))}
        </Loading>
      </div>
      {creating && <RequirementForm onClose={() => setCreating(false)} onDone={() => { setCreating(false); state.reload(); }} />}
    </>
  );
}

// ---------- Avaliação ----------
function ReviewCard({ s, onDone }) {
  const [feedback, setFeedback] = useState('');
  const [busy, run] = useAsync();
  const [photo, setPhoto] = useState(null);
  const decide = (decision) => run(() => api.post('/reviews/' + s.id, { decision, feedback }), decision === 'aprovado' ? 'Envio aprovado!' : 'Envio recusado').then(onDone);
  return (
    <Card>
      <div className="row">
        <Avatar src={s.submitter.photo} name={s.submitter.name} size={42} square={s.submitter_type !== 'member'} />
        <div className="grow">
          <b>{s.submitter.name}</b>
          <div className="small muted">{s.submitter.sub || AUDIENCE_LABEL[s.audience]} · {fmtDateTime(s.submitted_at)}</div>
        </div>
        {s.late ? <Badge kind="red">Fora do prazo</Badge> : <Badge kind="green">No prazo</Badge>}
      </div>
      <h3 className="mt">{s.title}</h3>
      <div className="req-meta"><span className="ico"><ClipboardList size={14} /> {MODEL_LABEL[s.model]}</span><span className="req-points ico"><Star size={14} /> vale {s.late ? s.req_late_points : s.req_points} pts</span></div>
      {s.quiz_total ? <p className="small"><b>Quiz:</b> {s.quiz_correct}/{s.quiz_total} acertos (a pontuação é proporcional)</p> : null}
      {s.text && <p style={{ whiteSpace: 'pre-wrap', background: 'var(--bg)', padding: '.6rem', borderRadius: 12 }}>{s.text}</p>}
      {s.photos.length > 0 && <div className="photo-strip">{s.photos.map((p) => <img key={p} src={p} alt="" onClick={() => setPhoto(p)} style={{ cursor: 'zoom-in' }} />)}</div>}
      {s.status === 'enviado' ? (
        <div className="stack mt">
          <input placeholder="Comentário (opcional)" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          <div className="grid2">
            <Button variant="danger" busy={busy} onClick={() => decide('recusado')}>Recusar</Button>
            <Button variant="green" busy={busy} onClick={() => decide('aprovado')}>Aprovar</Button>
          </div>
        </div>
      ) : (
        <p className="small mt ico">{s.status === 'aprovado' ? <><CheckCircle2 size={15} color="var(--green)" /> Aprovado · {s.points} pts</> : <><XCircle size={15} color="var(--red)" /> Recusado</>}{s.feedback ? ` — “${s.feedback}”` : ''}</p>
      )}
      <Lightbox src={photo} onClose={() => setPhoto(null)} />
    </Card>
  );
}

export function ReviewsPanel() {
  const [status, setStatus] = useState('enviado');
  const state = useLoad(() => api.get('/reviews?status=' + status), [status]);
  return (
    <>
      <Tabs tabs={[['enviado', 'Para avaliar'], ['aprovado', 'Aprovados'], ['recusado', 'Recusados']]} value={status} onChange={setStatus} />
      <Loading {...state} empty={status === 'enviado' ? 'Nenhum envio aguardando avaliação.' : 'Nada por aqui.'}>
        {(list) => list.map((s) => <ReviewCard key={s.id} s={s} onDone={state.reload} />)}
      </Loading>
    </>
  );
}
