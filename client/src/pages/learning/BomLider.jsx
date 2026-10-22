// Bom Líder: 50 aulas de liderança (leitura + perguntas de marcar e de escrever).
import './learning.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, CheckCircle2, ChevronLeft, ChevronRight, ListChecks, Lock, PenLine, RotateCcw, Users, X } from 'lucide-react';
import { api } from '../../api.js';
import { Button, Card, Loading, PageHeader, Tabs, useAsync, useLoad } from '../../ui.jsx';
import { BackButton, PlayButton, VoiceAudio, useFocusMode } from './Learning.jsx';
import { useNarration } from './voice.js';
import './bomlider.css';

export function BomLider({ base }) {
  const state = useLoad(() => api.get('/bom-lider'));
  return (
    <>
      <PageHeader title="Bom Líder" subtitle="Livros de liderança: leia, ouça, responda e escreva com as suas palavras" />
      {/* Nisto Cremos: bloqueado até o livro chegar. */}
      <Tabs tabs={[['manual', 'Manual Administrativo'], ['nisto', <span key="n" className="tab-locked"><Lock size={13} /> Nisto Cremos <em>em breve</em></span>]]} value="manual" onChange={() => {}} />
      {(
        <Loading {...state}>
          {(d) => (d.preparing ? (
            <Card className="center">
              <Users size={34} />
              <p><b>As aulas estão sendo preparadas.</b></p>
            </Card>
          ) : (
            <>
              <Card className="small center">{d.done} de {d.total} aulas concluídas · Manual Administrativo do Clube de Desbravadores</Card>
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
      )}
    </>
  );
}

export function BomLiderLesson({ base }) {
  const { n } = useParams();
  const state = useLoad(() => api.get(`/bom-lider/aula/${n}`), [n]);
  return (
    <Loading {...state}>
      {(d) => <Lesson key={n} d={d} base={base} />}
    </Loading>
  );
}

const STEPS = [['estudo', 'Estudo', BookOpen], ['perguntas', 'Perguntas', PenLine], ['quiz', 'Quiz', ListChecks]];

/** Páginas do caderno: capa (com o versículo), parágrafos (sem cortar no meio) e a atividade. */
function paginate(d, budget) {
  const pages = [[{ kind: 'capa' }]];
  let cur = [];
  let size = 0;
  d.content.forEach((text, i) => {
    if (cur.length && size + text.length > budget) { pages.push(cur); cur = []; size = 0; }
    cur.push({ kind: 'p', i, text });
    size += text.length;
  });
  if (cur.length) pages.push(cur);
  if (d.activity) pages.push([{ kind: 'atividade' }]);
  return pages;
}

function Lesson({ d, base }) {
  useFocusMode();
  const nav = useNavigate();
  const [step, setStep] = useState('estudo');
  const budget = typeof window !== 'undefined' && window.innerWidth > 700 ? 1400 : 760;
  const pages = useMemo(() => paginate(d, budget), [d, budget]);
  const [page, setPage] = useState(0);
  const [turn, setTurn] = useState('');
  const go = (p) => {
    if (p < 0 || p >= pages.length || p === page) return;
    setTurn(p > page ? 'turn-next' : 'turn-prev');
    setPage(p);
  };

  // Voz: abertura, versículo, cada parágrafo e a atividade (na ordem das páginas), num áudio só.
  const seq = useMemo(() => {
    const out = [{ at: 'capa' }];
    if (d.verse) out.push({ at: 'verso' });
    d.content.forEach((_t, i) => out.push({ at: `p${i}` }));
    if (d.activity) out.push({ at: 'atividade' });
    return out;
  }, [d]);
  const v = useNarration(d.audio);
  const at = v.pos >= 0 ? seq[v.pos]?.at : null;
  const pageOf = (key) => (key === 'capa' || key === 'verso' ? 0 : key === 'atividade' ? pages.length - 1 : pages.findIndex((pg) => pg.some((x) => x.kind === 'p' && `p${x.i}` === key)));
  useEffect(() => {
    if (!at) return;
    const p = pageOf(at);
    if (p >= 0 && p !== page) { setTurn(p > page ? 'turn-next' : 'turn-prev'); setPage(p); }
  }, [at]);
  const toggle = () => {
    if (v.playing) { v.stop(); return; }
    if (at && pageOf(at) === page) { v.startAt(-1); return; }
    const first = pages[page][0];
    const key = first.kind === 'capa' ? 'capa' : first.kind === 'atividade' ? 'atividade' : `p${first.i}`;
    v.startAt(seq.findIndex((x) => x.at === key));
  };
  const hl = (key) => (at === key ? ' reading' : '');

  // Perguntas para escrever e quiz (de marcar), cada um na sua etapa.
  const written = d.questions.map((q, i) => ({ ...q, i })).filter((q) => q.type === 'escrita');
  const choice = d.questions.map((q, i) => ({ ...q, i })).filter((q) => q.type !== 'escrita');
  const [answers, setAnswers] = useState(() => d.questions.map((q, i) => (q.type === 'escrita' ? d.written?.[i] || '' : null)));
  const set = (i, val) => setAnswers((a) => a.map((x, k) => (k === i ? val : x)));
  const writtenOk = written.every((q) => (answers[q.i] || '').trim().length >= (q.min || 20));
  const [qi, setQi] = useState(0);
  const [result, setResult] = useState(null);
  const [busy, run] = useAsync();
  const send = () => run(async () => { setResult(await api.post(`/bom-lider/aula/${d.n}`, { answers })); window.scrollTo({ top: 0 }); });
  const retry = () => { setResult(null); setQi(0); setAnswers((a) => a.map((x, k) => (d.questions[k].type === 'escrita' ? x : null))); };
  const goStep = (s) => { v.stop(); setStep(s); window.scrollTo({ top: 0 }); };

  const touch = useRef(null);
  const last = page === pages.length - 1;
  const stepIdx = STEPS.findIndex(([k]) => k === step);

  return (
    <div className="bl-lesson">
      <div className="bl-top">
        <BackButton to={`${base}/aprendizagem/bom-lider`} />
        <div className="grow"><small>Bom Líder · Aula {d.n} de {d.total}</small><b>{d.title}</b></div>
        {d.done && <CheckCircle2 size={20} className="bl-done" />}
      </div>
      <ol className="bl-steps">
        {STEPS.map(([k, label, Icon], i) => (
          <li key={k} className={(k === step ? 'on' : '') + (i < stepIdx ? ' past' : '')}><span><Icon size={14} /></span>{label}</li>
        ))}
      </ol>

      {step === 'estudo' && (
        <>
          <div
            className="bl-book"
            onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
              if (touch.current == null || v.playing) return;
              const dx = e.changedTouches[0].clientX - touch.current;
              touch.current = null;
              if (Math.abs(dx) > 50) go(page + (dx < 0 ? 1 : -1));
            }}
          >
            <div key={page} className={'bl-page ' + turn} onAnimationEnd={() => setTurn('')}>
              {pages[page].map((x) => (x.kind === 'capa' ? (
                <div key="capa" className="bl-cover">
                  <img src="/marca/logo.svg" alt="" className="bl-emblem" />
                  {d.theme && <span className="bl-theme">{d.theme}</span>}
                  <h1 className={hl('capa')}>Aula {d.n}<br /><span>{d.title}</span></h1>
                  {d.objective && <p className={'bl-objective' + hl('capa')}><b>Objetivo:</b> {d.objective}</p>}
                  {d.verse && <blockquote className={'bl-verse' + hl('verso')}>{d.verse}</blockquote>}
                  {d.reading && <p className="bl-reading">Leitura: {d.reading}</p>}
                </div>
              ) : x.kind === 'atividade' ? (
                <div key="atividade" className={'bl-activity' + hl('atividade')}>
                  <h2>Atividade da semana</h2>
                  <p>{d.activity}</p>
                  <p className="bl-hint">Terminou o estudo? Agora vêm as perguntas para escrever e depois o quiz.</p>
                </div>
              ) : (
                <p key={x.i} className={'bl-par' + hl(`p${x.i}`)} onClick={() => v.available && v.startAt(seq.findIndex((s2) => s2.at === `p${x.i}`))}>{x.text}</p>
              )))}
              <span className="bl-pg">{page + 1} / {pages.length}</span>
            </div>
          </div>
          <div className="bible-controls">
            <button type="button" className="icon-btn" disabled={page === 0 || v.playing} onClick={() => go(page - 1)} aria-label="Página anterior"><ChevronLeft size={22} /></button>
            <PlayButton v={v} onToggle={toggle} locked={d.audio_locked} />
            <button type="button" className="icon-btn" disabled={last || v.playing} onClick={() => go(page + 1)} aria-label="Próxima página"><ChevronRight size={22} /></button>
          </div>
          <VoiceAudio v={v} />
          {last ? <Button block onClick={() => goStep('perguntas')}>Ir para as perguntas <ChevronRight size={16} /></Button>
            : <p className="small muted center">Leia até a última página para seguir. Toque num parágrafo para ouvir dali; ouvindo, a página vira sozinha.</p>}
        </>
      )}

      {step === 'perguntas' && (
        <>
          <p className="bl-intro">Responda com as suas palavras. Não existe resposta pronta: pense no seu clube e na sua unidade.</p>
          {written.map((q, k) => (
            <div key={q.i} className="bl-note">
              <span className="bl-note-n">{k + 1}</span>
              <p>{q.q}</p>
              <textarea rows={5} value={answers[q.i]} onChange={(e) => set(q.i, e.target.value)} placeholder="Escreva aqui..." />
              <small className={(answers[q.i] || '').trim().length >= (q.min || 20) ? 'ok' : ''}><PenLine size={12} /> {(answers[q.i] || '').trim().length} de pelo menos {q.min || 20} letras</small>
            </div>
          ))}
          <div className="bl-nav">
            <Button variant="secondary" onClick={() => goStep('estudo')}><ChevronLeft size={16} /> Estudo</Button>
            <Button disabled={!writtenOk} onClick={() => goStep('quiz')}>Ir para o quiz <ChevronRight size={16} /></Button>
          </div>
        </>
      )}

      {step === 'quiz' && !result && (
        <>
          <div className="bl-dots">{choice.map((q, k) => <i key={q.i} className={(k === qi ? 'on' : '') + (answers[q.i] != null ? ' ok' : '')} onClick={() => setQi(k)} />)}</div>
          <div key={qi} className="bl-quiz turn-next">
            <small>Pergunta {qi + 1} de {choice.length}</small>
            <p>{choice[qi].q}</p>
            <div className="quiz-opts">
              {choice[qi].options.map((o, k) => (
                <button key={k} type="button" className={'quiz-opt' + (answers[choice[qi].i] === k ? ' picked' : '')} onClick={() => set(choice[qi].i, k)}>
                  <span className="quiz-letter">{'ABCD'[k]}</span>{o}
                </button>
              ))}
            </div>
          </div>
          <div className="bl-nav">
            <Button variant="secondary" onClick={() => (qi ? setQi(qi - 1) : goStep('perguntas'))}><ChevronLeft size={16} /> {qi ? 'Anterior' : 'Perguntas'}</Button>
            {qi < choice.length - 1
              ? <Button disabled={answers[choice[qi].i] == null} onClick={() => setQi(qi + 1)}>Próxima <ChevronRight size={16} /></Button>
              : <Button busy={busy} disabled={choice.some((q) => answers[q.i] == null)} onClick={send}><CheckCircle2 size={16} /> Enviar</Button>}
          </div>
        </>
      )}

      {step === 'quiz' && result && (
        <>
          <div className={'quiz-result ' + (result.passed ? 'ok' : 'no')}>
            <b className="quiz-score">{result.score}/{result.total}</b>
            <p><b>{result.passed ? 'Aula concluída!' : 'Quase lá!'}</b> {result.passed ? 'As suas respostas escritas ficaram salvas.' : `Precisa acertar pelo menos ${Math.ceil(result.total * 0.6)}. Releia o estudo e tente de novo.`}</p>
            <div className="quiz-actions">
              {!result.passed && <Button variant="secondary" onClick={retry}><RotateCcw size={16} /> Tentar de novo</Button>}
              {result.next ? <Button onClick={() => nav(`${base}/aprendizagem/bom-lider/${result.next}`)}>Próxima aula <ChevronRight size={16} /></Button>
                : result.passed && <Button onClick={() => nav(`${base}/aprendizagem/bom-lider`)}><ArrowLeft size={16} /> Voltar às aulas</Button>}
            </div>
          </div>
          {choice.map((q, k) => {
            const right = result.correct[q.i] === answers[q.i];
            return (
              <Card key={q.i} className="lesson-q">
                <p>{right ? <CheckCircle2 size={16} className="bl-ok" /> : <X size={16} className="bl-no" />} <b>{k + 1}.</b> {q.q}</p>
                <small className="muted">Certa: {q.options[result.correct[q.i]]}</small>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}
