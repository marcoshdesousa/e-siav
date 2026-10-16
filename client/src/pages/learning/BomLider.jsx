// Bom Líder: 50 aulas de liderança (leitura + perguntas de marcar e de escrever).
import './learning.css';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ChevronRight, Lock, PenLine, RotateCcw, Users } from 'lucide-react';
import { api } from '../../api.js';
import { Button, Card, Loading, PageHeader, useAsync, useLoad } from '../../ui.jsx';

export function BomLider({ base }) {
  const state = useLoad(() => api.get('/bom-lider'));
  return (
    <>
      <PageHeader title="Bom Líder" subtitle="Aulas de liderança: leia, responda e escreva com as suas palavras" />
      <Loading {...state}>
        {(d) => (d.preparing ? (
          <Card className="center">
            <Users size={34} />
            <p><b>As aulas estão sendo preparadas.</b></p>
            <p className="small muted">Serão {50} aulas com leitura, perguntas de marcar e perguntas para escrever. Assim que estiverem prontas, aparecem aqui.</p>
          </Card>
        ) : (
          <>
            <Card className="small center">{d.done} de {d.total} aulas concluídas</Card>
            <div className="day-list">
              {d.lessons.map((l) => {
                const body = (
                  <>
                    <span className="day-n">{l.n}</span>
                    <span className="grow"><b>{l.title}</b>{l.theme && <small>{l.theme}</small>}</span>
                    <span className="day-st">{l.done ? <CheckCircle2 size={18} /> : l.locked ? <Lock size={16} /> : <ChevronRight size={18} />}</span>
                  </>
                );
                return l.locked ? <div key={l.n} className="day-row locked">{body}</div>
                  : <Link key={l.n} to={`${base}/aprendizagem/bom-lider/${l.n}`} className={'day-row' + (l.done ? ' feito' : '')}>{body}</Link>;
              })}
            </div>
          </>
        ))}
      </Loading>
    </>
  );
}

export function BomLiderLesson({ base }) {
  const { n } = useParams();
  const nav = useNavigate();
  const state = useLoad(() => api.get(`/bom-lider/aula/${n}`), [n]);
  return (
    <Loading {...state}>
      {(d) => <Lesson key={n} d={d} base={base} nav={nav} />}
    </Loading>
  );
}

function Lesson({ d, base, nav }) {
  const [answers, setAnswers] = useState(() => d.questions.map((q, i) => (q.type === 'escrita' ? d.written?.[i] || '' : null)));
  const [result, setResult] = useState(null);
  const [busy, run] = useAsync();
  const set = (i, v) => setAnswers((a) => a.map((x, k) => (k === i ? v : x)));
  const ready = d.questions.every((q, i) => (q.type === 'escrita' ? answers[i].trim().length >= (q.min || 20) : answers[i] != null));
  const send = () => run(async () => setResult(await api.post(`/bom-lider/aula/${d.n}`, { answers })));
  return (
    <>
      <PageHeader title={`Aula ${d.n}: ${d.title}`} subtitle={d.theme || `Bom Líder · ${d.n} de ${d.total}`} />
      {d.objective && <Card className="small"><b>Objetivo:</b> {d.objective}</Card>}
      {d.verse && <blockquote className="lesson-verse">{d.verse}</blockquote>}
      {d.reading && <p className="small muted">Leitura: {d.reading}</p>}
      <div className="lesson-text">{d.content.map((p, i) => <p key={i}>{p}</p>)}</div>
      {d.activity && <Card className="small"><b>Atividade:</b> {d.activity}</Card>}
      <h3>Perguntas</h3>
      {d.questions.map((q, i) => (
        <Card key={i} className="lesson-q">
          <p><b>{i + 1}.</b> {q.q}</p>
          {q.type === 'escrita' ? (
            <>
              <textarea rows={4} value={answers[i]} onChange={(e) => set(i, e.target.value)} placeholder="Escreva com as suas palavras..." disabled={!!result} />
              <small className="muted"><PenLine size={12} /> Pelo menos {q.min || 20} letras</small>
            </>
          ) : (
            <div className="quiz-opts">
              {q.options.map((o, k) => {
                const right = result && result.correct[i] === k;
                const wrong = result && answers[i] === k && !right;
                return <button key={k} type="button" className={'quiz-opt' + (answers[i] === k ? ' picked' : '') + (right ? ' right' : '') + (wrong ? ' wrong' : '')} disabled={!!result} onClick={() => set(i, k)}>{o}</button>;
              })}
            </div>
          )}
        </Card>
      ))}
      {!result ? <Button block busy={busy} disabled={!ready} onClick={send}>Enviar respostas</Button> : (
        <Card className="center">
          <p><b>{result.passed ? 'Aula concluída!' : 'Quase lá!'}</b> Você acertou {result.score} de {result.total} perguntas de marcar.</p>
          {result.next ? <Button onClick={() => nav(`${base}/aprendizagem/bom-lider/${result.next}`)}>Próxima aula <ChevronRight size={16} /></Button>
            : result.passed ? <Button onClick={() => nav(`${base}/aprendizagem/bom-lider`)}><ArrowLeft size={16} /> Voltar às aulas</Button>
              : <Button variant="secondary" onClick={() => setResult(null)}><RotateCcw size={16} /> Tentar de novo</Button>}
        </Card>
      )}
    </>
  );
}
