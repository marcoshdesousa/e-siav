import { useState } from 'react';
import { ArrowLeft, CalendarClock, CheckCircle2, ChevronRight, ClipboardList, Globe2, Star, Timer, XCircle } from 'lucide-react';
import { api, toForm } from '../api.js';
import { useAuth } from '../auth.jsx';
import { AUDIENCE_LABEL, fmtDateTime, isoToLocal, localToIso, timeLeft } from '../format.js';
import {
  Avatar, Badge, Button, Card, Confirm, Empty, Field, Gallery, ImagesInput, Loading, Modal, ModesPicker, QuizAnswer, QuizBuilder, Section, StateBadge, Tabs,
  modesLabel, notify, useAsync, useLoad,
} from '../ui.jsx';

export function Lightbox({ src, onClose }) {
  if (!src) return null;
  return <div className="lightbox" onClick={onClose}><img src={src} alt="" /></div>;
}

/** Públicos dos requisitos, na ordem pedida: desbravadores, unidades e clubes. */
const AUDIENCES = [['member', 'Desbravadores'], ['unit', 'Unidades'], ['club', 'Clubes']];

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
      {r.description && <p className="muted small" style={{ whiteSpace: 'pre-wrap' }}>{r.description}</p>}
      <Gallery images={r.images} />
      <div className="req-meta">
        <span className="ico"><ClipboardList size={14} /> {modesLabel(r.modes)}</span>
        <span className="req-points ico"><Star size={14} /> {r.points} pts no prazo</span>
        <span className="ico"><Timer size={14} /> {r.late_points} pts fora do prazo</span>
      </div>
      <div className="req-meta">
        <span className={'ico' + (left && left.includes('hora') ? ' deadline-soon' : '')}><CalendarClock size={14} /> Prazo: {fmtDateTime(r.deadline)}{left ? ` (faltam ${left})` : ' — encerrado'}</span>
      </div>
      {s && s.status !== 'recusado' && (
        <div className="small" style={{ marginTop: '.3rem' }}>
          {s.status === 'aprovado' ? <b className="ico" style={{ color: 'var(--green-ink)' }}><CheckCircle2 size={15} /> +{s.points} pontos</b> : <span className="muted">Aguardando avaliação de quem criou o requisito.</span>}
          {s.quiz_total ? <span className="muted"> · Quiz: {s.quiz_correct}/{s.quiz_total} acertos</span> : null}
        </div>
      )}
      {s?.status === 'recusado' && <p className="small" style={{ color: 'var(--red-ink)' }}>Envio recusado{s.feedback ? `: “${s.feedback}”` : ''}. Você pode enviar de novo.</p>}
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

/** Formulário de resposta conforme as formas de envio escolhidas (relatório, foto, quiz). */
export function ResponseFields({ modes, questions, text, setText, photos, setPhotos, answers, setAnswers }) {
  return (
    <>
      {modes.includes('texto') && (
        <Field label="Relatório"><textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Conte como foi..." /></Field>
      )}
      {modes.includes('quiz') && <QuizAnswer questions={questions} answers={answers} setAnswers={setAnswers} />}
      {modes.includes('foto') && (
        <ImagesInput label="Fotos de comprovação" max={5} files={photos} onFiles={setPhotos} urls={[]} onUrls={() => {}} />
      )}
    </>
  );
}

function SubmitModal({ r, onClose, onDone }) {
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState([]);
  const [answers, setAnswers] = useState(r.questions.map(() => null));
  const [busy, run] = useAsync();
  const submit = async () => {
    if (r.modes.includes('quiz') && answers.some((a) => a === null)) return notify('Responda todas as perguntas', 'error');
    const res = await run(() => api.post(`/requirements/${r.id}/submit`, toForm({ text, photos, answers: r.modes.includes('quiz') ? answers : undefined })));
    if (res.status === 'aprovado') notify(`Quiz enviado! ${res.quiz_correct}/${res.quiz_total} acertos · +${res.points} pontos`);
    else notify('Enviado! Agora é aguardar a avaliação.');
    onDone();
  };
  return (
    <Modal title={r.title} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button busy={busy} onClick={submit}>Enviar</Button></>}>
      <div className="form">
        {Date.parse(r.deadline) < Date.now() && <Badge kind="red">Fora do prazo: vale {r.late_points} pontos</Badge>}
        {r.description && <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>{r.description}</p>}
        <Gallery images={r.images} />
        <ResponseFields modes={r.modes} questions={r.questions} text={text} setText={setText} photos={photos} setPhotos={setPhotos} answers={answers} setAnswers={setAnswers} />
      </div>
    </Modal>
  );
}

/** Requisitos para a conta logada cumprir. groupByOrigin: para a unidade (clube x geral). */
export function RequirementsTodo({ groupByOrigin = false }) {
  const state = useLoad(() => api.get('/requirements/mine'));
  const [sending, setSending] = useState(null);
  const [filter, setFilter] = useState('abertos');
  const open = (r) => ['pendente', 'fora_do_prazo', 'recusado'].includes(r.state);
  return (
    <Loading {...state}>
      {(list) => {
        const shown = list.filter((r) => (filter === 'abertos' ? open(r) : filter === 'enviados' ? r.state === 'enviado' : r.state === 'aprovado'));
        const counts = { abertos: list.filter(open).length, enviados: list.filter((r) => r.state === 'enviado').length };
        const groups = groupByOrigin ? [['clube', 'Requisitos do seu clube'], ['geral', 'Requisitos gerais de unidade']] : [[null, null]];
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
export function RequirementForm({ audience: fixedAudience, onClose, onDone }) {
  const { actor, meta } = useAuth();
  const isAdmin = actor.type === 'admin';
  const due = new Date(Date.now() + 7 * 864e5);
  due.setHours(23, 59, 0, 0);
  const [f, setF] = useState({
    title: '', description: '', points: 50, late_points: 20, deadline: isoToLocal(due.toISOString()),
    audience: fixedAudience || 'member', scope: 'geral', district_id: meta.districts[0]?.id || '',
  });
  const [modes, setModes] = useState(['texto']);
  const [images, setImages] = useState([]);
  const [questions, setQuestions] = useState([{ question: '', options: ['', ''], correct: 0 }]);
  const [busy, run] = useAsync();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    if (!modes.length) return notify('Escolha pelo menos uma forma de envio', 'error');
    await run(
      () => api.post('/requirements', toForm({ ...f, deadline: localToIso(f.deadline), modes, questions: modes.includes('quiz') ? questions : [], images })),
      'Requisito criado!',
    );
    onDone();
  };
  return (
    <Modal title="Novo requisito" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button busy={busy} onClick={submit}>Criar requisito</Button></>}>
      <div className="form">
        {isAdmin ? (
          <div className="grid2">
            <Field label="Para quem">
              <select value={f.audience} onChange={set('audience')}>
                {AUDIENCES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
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
        <Field label="Como fazer" hint="Explique o requisito e o que deve ser enviado."><textarea value={f.description} onChange={set('description')} /></Field>
        <ImagesInput label="Fotos de exemplo (opcional)" urls={[]} onUrls={() => {}} files={images} onFiles={setImages} />
        <Field group label="O que o membro vai enviar" hint="Marque quantas quiser: relatório, foto e/ou quiz.">
          <ModesPicker value={modes} onChange={setModes} />
        </Field>
        <div className="grid2">
          <Field label="Pontos no prazo"><input type="number" min="0" value={f.points} onChange={set('points')} /></Field>
          <Field label="Pontos fora do prazo" hint="Menor ou zero"><input type="number" min="0" value={f.late_points} onChange={set('late_points')} /></Field>
        </div>
        <Field label="Prazo (data e hora)"><input type="datetime-local" value={f.deadline} onChange={set('deadline')} /></Field>
        {modes.includes('quiz') && (
          <Field group label="Perguntas do quiz" hint={modes.length === 1 ? 'Só quiz: a nota é proporcional aos acertos e sai na hora.' : 'Com relatório ou foto, quem criou avalia e a nota do quiz é proporcional.'}>
            <QuizBuilder questions={questions} setQuestions={setQuestions} />
          </Field>
        )}
      </div>
    </Modal>
  );
}

export function CreatedRequirements() {
  const { actor } = useAuth();
  const isAdmin = actor.type === 'admin';
  const state = useLoad(() => api.get('/requirements/created'));
  const [audience, setAudience] = useState('member');
  const [creating, setCreating] = useState(false);
  const [, run] = useAsync();
  return (
    <>
      {isAdmin && <Tabs tabs={AUDIENCES.map(([k, l]) => [k, l])} value={audience} onChange={setAudience} />}
      <Button block onClick={() => setCreating(true)}>+ Novo requisito{isAdmin ? ` para ${AUDIENCE_LABEL[audience].toLowerCase()}` : ''}</Button>
      <div className="mt">
        <Loading data={state.data && state.data.filter((r) => !isAdmin || r.audience === audience)} loading={state.loading} error={state.error} empty="Nenhum requisito criado ainda.">
          {(list) => list.map((r) => (
            <Card key={r.id} className="req-card">
              <h3>{r.title}</h3>
              <Gallery images={r.images} />
              <div className="req-meta">
                <span className="ico"><ClipboardList size={14} /> {modesLabel(r.modes)}</span>
                <span className="req-points ico"><Star size={14} /> {r.points}/{r.late_points} pts</span>
                <span className="ico"><CalendarClock size={14} /> {fmtDateTime(r.deadline)}</span>
                {isAdmin && <span className="ico"><Globe2 size={14} /> {r.scope === 'geral' ? 'Geral' : r.district_name}</span>}
              </div>
              <div className="row between">
                <span className="small muted">{r.submission_count} envios{r.pending_count ? ` · ${r.pending_count} para avaliar` : ''}</span>
                <Confirm text="Excluir este requisito e todos os envios (os pontos saem do ranking)?" onYes={() => run(() => api.del('/requirements/' + r.id), 'Requisito excluído').then(state.reload)}>Excluir</Confirm>
              </div>
            </Card>
          ))}
        </Loading>
      </div>
      {creating && <RequirementForm audience={isAdmin ? audience : 'unit'} onClose={() => setCreating(false)} onDone={() => { setCreating(false); state.reload(); }} />}
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
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <h3 className="grow">{s.title}</h3>
        {s.late ? <Badge kind="red">Fora do prazo</Badge> : <Badge kind="green">No prazo</Badge>}
      </div>
      <div className="req-meta">
        <span className="ico"><ClipboardList size={14} /> {modesLabel(s.modes)}</span>
        <span className="req-points ico"><Star size={14} /> vale {s.late ? s.req_late_points : s.req_points} pts</span>
        <span>{fmtDateTime(s.submitted_at)}</span>
      </div>
      {s.quiz_total ? <p className="small"><b>Quiz:</b> {s.quiz_correct}/{s.quiz_total} acertos (a pontuação é proporcional)</p> : null}
      {s.text && <p className="text-box">{s.text}</p>}
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
        <p className="small mt ico">{s.status === 'aprovado' ? <><CheckCircle2 size={15} color="var(--green-ink)" /> Aprovado · {s.points} pts</> : <><XCircle size={15} color="var(--red-ink)" /> Recusado</>}{s.feedback ? ` — “${s.feedback}”` : ''}</p>
      )}
      <Lightbox src={photo} onClose={() => setPhoto(null)} />
    </Card>
  );
}

/** Envios de uma pessoa (ou unidade/clube) para avaliar. */
function PersonReviews({ person, status, onBack }) {
  const state = useLoad(() => api.get(`/reviews?status=${status}&submitter_type=${person.submitter_type}&submitter_id=${person.submitter_id}`), [status, person.submitter_id]);
  return (
    <>
      <button type="button" className="back-link" onClick={onBack}><ArrowLeft size={16} /> Voltar para a lista</button>
      <div className="list-item" style={{ marginBottom: '.8rem' }}>
        <Avatar src={person.submitter.photo} name={person.submitter.name} size={46} square={person.submitter_type !== 'member'} />
        <div className="grow"><div className="title">{person.submitter.name}</div><div className="sub">{person.submitter.sub || ''}</div></div>
      </div>
      <Loading {...state} empty="Nada por aqui.">
        {(list) => list.map((s) => <ReviewCard key={s.id} s={s} onDone={() => { state.reload(); }} />)}
      </Loading>
    </>
  );
}

/**
 * Avaliar envios: separado por público (desbravadores, unidades, clubes) e por pessoa.
 * Toque em alguém para ver só os envios dela.
 */
export function ReviewsPanel() {
  const { actor } = useAuth();
  const isAdmin = actor.type === 'admin';
  const [audience, setAudience] = useState(isAdmin ? 'member' : 'unit');
  const [status, setStatus] = useState('enviado');
  const [person, setPerson] = useState(null);
  const state = useLoad(() => api.get(`/reviews/people?status=${status}&submitter_type=${audience}`), [status, audience, person]);
  const pending = state.data?.pending_by_type || {};
  if (person) return <PersonReviews person={person} status={status} onBack={() => setPerson(null)} />;
  return (
    <>
      {isAdmin && <Tabs tabs={AUDIENCES.map(([k, l]) => [k, l, pending[k]])} value={audience} onChange={setAudience} />}
      <div className="row" style={{ marginBottom: '.8rem' }}>
        <div className="seg">
          {[['enviado', 'Para avaliar'], ['aprovado', 'Aprovados'], ['recusado', 'Recusados']].map(([k, l]) => (
            <button key={k} type="button" className={status === k ? 'active' : ''} onClick={() => setStatus(k)}>{l}</button>
          ))}
        </div>
      </div>
      <Loading data={state.data?.people} loading={state.loading} error={state.error} empty={status === 'enviado' ? 'Nenhum envio aguardando avaliação.' : 'Nada por aqui.'}>
        {(people) => (
          <div className="list">
            {people.map((p) => (
              <button key={p.submitter_type + p.submitter_id} type="button" className="list-item" style={{ font: 'inherit', textAlign: 'left', cursor: 'pointer' }} onClick={() => setPerson(p)}>
                <Avatar src={p.submitter.photo} name={p.submitter.name} size={44} square={p.submitter_type !== 'member'} />
                <div className="grow">
                  <div className="title">{p.submitter.name}</div>
                  <div className="sub">{p.submitter.sub || ''}</div>
                </div>
                <Badge kind={status === 'enviado' ? 'yellow' : status === 'aprovado' ? 'green' : 'red'}>{p.count}</Badge>
                <ChevronRight className="chev" size={20} />
              </button>
            ))}
          </div>
        )}
      </Loading>
    </>
  );
}
