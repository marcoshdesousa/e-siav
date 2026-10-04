import { useState } from 'react';
import { ArrowLeft, Award, Check, ChevronRight, Clock, XCircle } from 'lucide-react';
import { api } from '../../api.js';
import { fmtDateTime } from '../../format.js';
import { Avatar, Badge, Button, Card, ContentIcon, Empty, Loading, PageHeader, modesLabel, useAsync, useLoad } from '../../ui.jsx';
import { Lightbox } from '../Requirements.jsx';

const ST = { enviado: ['yellow', Clock, 'Para analisar'], aprovado: ['green', Check, 'Aprovado'], recusado: ['red', XCircle, 'Recusado'] };

function ItemReview({ contentId, memberId, item, index, onDone }) {
  const [feedback, setFeedback] = useState('');
  const [photo, setPhoto] = useState(null);
  const [busy, run] = useAsync();
  const s = item.submission;
  const st = s && ST[s.status];
  const decide = (decision) =>
    run(() => api.post(`/admin/content-review/${contentId}/members/${memberId}/items/${item.id}`, { decision, feedback }), decision === 'aprovado' ? 'Requisito aprovado!' : 'Requisito recusado')
      .then((r) => onDone(r.completed));
  return (
    <Card>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <h3 className="grow">{index + 1}. {item.title}</h3>
        {st ? <Badge kind={st[0]}>{(() => { const I = st[1]; return <I size={12} />; })()} {st[2]}</Badge> : <Badge>Não enviado</Badge>}
      </div>
      <p className="small muted">Enviar: {modesLabel(item.modes)}{s?.submitted_at ? ` · ${fmtDateTime(s.submitted_at)}` : ''}</p>
      {s && (
        <>
          {s.text && <p className="text-box">{s.text}</p>}
          {s.photos?.length > 0 && <div className="photo-strip">{s.photos.map((p) => <img key={p} src={p} alt="" onClick={() => setPhoto(p)} style={{ cursor: 'zoom-in' }} />)}</div>}
          {s.quiz_total ? (
            <div className="quiz-q small" style={{ marginTop: '.5rem' }}>
              <b>Quiz: {s.quiz_correct}/{s.quiz_total} acertos</b>
              {item.questions.map((q, i) => (
                <div key={q.id} style={{ marginTop: '.3rem' }}>
                  {q.question} — <span style={{ color: s.answers?.[i] === q.correct ? 'var(--green-ink)' : 'var(--red-ink)' }}>{q.options[s.answers?.[i]] ?? '—'}</span>
                  {s.answers?.[i] !== q.correct && <span className="muted"> (certa: {q.options[q.correct]})</span>}
                </div>
              ))}
            </div>
          ) : null}
          {s.feedback && <p className="small muted">Comentário: “{s.feedback}”</p>}
          {s.status === 'enviado' && (
            <div className="stack mt">
              <input placeholder="Comentário (opcional)" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
              <div className="grid2">
                <Button variant="danger" busy={busy} onClick={() => decide('recusado')}>Recusar</Button>
                <Button variant="green" busy={busy} onClick={() => decide('aprovado')}>Aprovar</Button>
              </div>
            </div>
          )}
          {s.status === 'aprovado' && item.modes.length > 0 && <div className="mt"><Button small variant="danger" busy={busy} onClick={() => decide('recusado')}>Desfazer aprovação</Button></div>}
        </>
      )}
      <Lightbox src={photo} onClose={() => setPhoto(null)} />
    </Card>
  );
}

function MemberDetail({ contentId, memberId, onBack }) {
  const state = useLoad(() => api.get(`/admin/content-review/${contentId}/members/${memberId}`), [contentId, memberId]);
  const [doneMsg, setDoneMsg] = useState(false);
  return (
    <Loading {...state}>
      {(d) => (
        <>
          <button type="button" className="back-link" onClick={onBack}><ArrowLeft size={16} /> {d.content.name}</button>
          <div className="list-item" style={{ marginBottom: '.8rem' }}>
            <Avatar src={d.member.photo} name={d.member.name} size={48} />
            <div className="grow"><div className="title">{d.member.name}</div><div className="sub">{d.member.handle ? '@' + d.member.handle + ' · ' : ''}{d.member.club_name}</div></div>
            {(d.completed || doneMsg) && <Badge kind="yellow"><Award size={12} /> Concluída</Badge>}
          </div>
          {d.items.map((it, i) => (
            <ItemReview key={it.id} contentId={contentId} memberId={memberId} item={it} index={i} onDone={(completed) => { if (completed) setDoneMsg(true); state.reload(); }} />
          ))}
        </>
      )}
    </Loading>
  );
}

function ContentMembers({ contentId, onBack, onPick }) {
  const state = useLoad(() => api.get('/admin/content-review/' + contentId), [contentId]);
  return (
    <Loading {...state}>
      {(c) => (
        <>
          <button type="button" className="back-link" onClick={onBack}><ArrowLeft size={16} /> Voltar</button>
          <div className="row" style={{ marginBottom: '1rem' }}>
            <span className="content-icon" style={{ width: 60, height: 60 }}><ContentIcon c={c} size={28} /></span>
            <div><h2>{c.name}</h2><p className="muted small">{c.items_count} requisitos · {c.members.length} pessoas fazendo</p></div>
          </div>
          {c.members.length ? (
            <div className="list">
              {c.members.map((m) => (
                <button key={m.id} type="button" className="list-item" style={{ font: 'inherit', textAlign: 'left', cursor: 'pointer' }} onClick={() => onPick(m.id)}>
                  <Avatar src={m.photo} name={m.name} size={44} />
                  <div className="grow">
                    <div className="title">{m.name}</div>
                    <div className="sub">{m.club_name}{m.unit_name ? ' · ' + m.unit_name : ''}</div>
                    <div className="progress"><span style={{ width: `${c.items_count ? (m.approved / c.items_count) * 100 : 0}%` }} /></div>
                  </div>
                  {m.completed ? <Badge kind="yellow"><Award size={12} /> Concluída</Badge> : m.pending ? <Badge kind="yellow">{m.pending} p/ analisar</Badge> : <Badge>{m.approved}/{c.items_count}</Badge>}
                  <ChevronRight className="chev" size={20} />
                </button>
              ))}
            </div>
          ) : <Empty>Ninguém começou ainda.</Empty>}
        </>
      )}
    </Loading>
  );
}

/** Análise de classes ou especialidades: classe → pessoas → requisitos de cada pessoa. */
export default function ContentReview({ type, embedded = false }) {
  const [contentId, setContentId] = useState(null);
  const [memberId, setMemberId] = useState(null);
  const list = useLoad(() => api.get('/admin/content-review?type=' + type), [type, contentId, memberId]);
  const title = { classe: 'Classes', especialidade: 'Especialidades', curso: 'Cursos' }[type];

  let body;
  if (contentId && memberId) body = <MemberDetail contentId={contentId} memberId={memberId} onBack={() => setMemberId(null)} />;
  else if (contentId) body = <ContentMembers contentId={contentId} onBack={() => setContentId(null)} onPick={setMemberId} />;
  else {
    body = (
      <Loading {...list} empty="Nenhum curso cadastrado.">
        {(items) => (
          <div className="list">
            {items.map((c) => (
              <button key={c.id} type="button" className="list-item" style={{ font: 'inherit', textAlign: 'left', cursor: 'pointer' }} onClick={() => setContentId(c.id)}>
                <span className="content-icon"><ContentIcon c={c} size={24} /></span>
                <div className="grow">
                  <div className="title">{c.name}</div>
                  <div className="sub">{type === 'classe' ? (c.leader ? 'Líder · ' : `${c.age} anos · `) : ''}{c.members} pessoa{c.members === 1 ? '' : 's'} fazendo</div>
                </div>
                {c.pending ? <Badge kind="yellow">{c.pending} p/ analisar</Badge> : null}
                <ChevronRight className="chev" size={20} />
              </button>
            ))}
          </div>
        )}
      </Loading>
    );
  }
  return (
    <>
      {!embedded && <PageHeader title={`Análise de ${title.toLowerCase()}`} subtitle="Toque em um curso para ver quem está fazendo" />}
      {body}
    </>
  );
}
