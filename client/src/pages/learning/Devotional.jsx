// Meditação Diária e Lição da Escola Sabatina: cada uma com a sua sequência.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, ChevronLeft, ChevronRight, Flame, Lock, PlayCircle, RotateCcw, Sparkles, Trophy, X } from 'lucide-react';
import { api } from '../../api.js';
import { Button, Card, Loading, PageHeader, Tabs, useAsync, useLoad } from '../../ui.jsx';
import { BackButton, PlayButton, VoiceAudio, useBack, useFocusMode } from './Learning.jsx';
import { useNarration } from './voice.js';
import { PackReward } from './PackReward.jsx';
import './devotional.css';

const br = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dias = (n) => `${n} dia${n === 1 ? '' : 's'}`;
const longDate = (iso) => `${Number(iso.slice(8))} de ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

export function StreakMini({ s, label }) {
  return (
    <div className="dv-streak">
      <span className="streak-flame"><Flame size={26} /><b>{s.streak}</b></span>
      <div><b>{s.streak ? `${dias(s.streak)} seguidos` : 'Comece hoje'}</b><small>{label} · recorde {dias(s.best_streak)}</small></div>
    </div>
  );
}

/** Perguntas uma por vez + resultado (meditação e lição). */
export function Quiz({ questions, send, pass, onAgain, done }) {
  const [answers, setAnswers] = useState(() => questions.map(() => null));
  const [qi, setQi] = useState(0);
  const [result, setResult] = useState(null);
  const [busy, run] = useAsync();
  const submit = () => run(async () => setResult(await send(answers)));
  if (result) {
    return (
      <>
        <div className={'quiz-result ' + (result.passed ? 'ok' : 'no')}>
          <b className="quiz-score">{result.score}/{result.total}</b>
          {result.passed ? (
            <>
              <p><b>Concluído!</b>{result.on_time ? ' A sua sequência subiu!' : ''}</p>
              {result.pack && <PackReward />}
              {result.points?.member > 0 && <p className="quiz-gift"><Trophy size={18} /> +{result.points.member} pontos no ranking{result.points.unit ? `, +${result.points.unit} para a sua unidade` : ''} e +{result.points.club} para o seu clube!</p>}
            </>
          ) : <p>Faltou pouco! Precisa acertar {result.pass}. Releia e tente de novo.</p>}
          <div className="quiz-actions">
            {!result.passed && <Button variant="secondary" onClick={() => { setResult(null); setQi(0); setAnswers(questions.map(() => null)); onAgain?.(); }}><RotateCcw size={16} /> Tentar de novo</Button>}
            <Button onClick={done}>Continuar</Button>
          </div>
        </div>
        {questions.map((q, k) => (
          <Card key={k} className="lesson-q">
            <p>{result.correct[k] === answers[k] ? <CheckCircle2 size={16} className="bl-ok" /> : <X size={16} className="bl-no" />} <b>{k + 1}.</b> {q.q}</p>
            <small className="muted">Certa: {q.options[result.correct[k]]}</small>
          </Card>
        ))}
      </>
    );
  }
  const q = questions[qi];
  return (
    <>
      <div className="bl-dots">{questions.map((_x, k) => <i key={k} className={(k === qi ? 'on' : '') + (answers[k] != null ? ' ok' : '')} onClick={() => setQi(k)} />)}</div>
      <div key={qi} className="dv-quiz">
        <small>Pergunta {qi + 1} de {questions.length} · acerte {pass}</small>
        <p>{q.q}</p>
        <div className="quiz-opts">
          {q.options.map((o, k) => (
            <button key={k} type="button" className={'quiz-opt' + (answers[qi] === k ? ' picked' : '')} onClick={() => setAnswers(answers.map((a, j) => (j === qi ? k : a)))}>
              <span className="quiz-letter">{'ABCD'[k]}</span>{o}
            </button>
          ))}
        </div>
      </div>
      <div className="bl-nav">
        <Button variant="secondary" disabled={qi === 0} onClick={() => setQi(qi - 1)}><ChevronLeft size={16} /> Anterior</Button>
        {qi < questions.length - 1
          ? <Button disabled={answers[qi] == null} onClick={() => setQi(qi + 1)}>Próxima <ChevronRight size={16} /></Button>
          : <Button busy={busy} disabled={answers.some((a) => a == null)} onClick={submit}><CheckCircle2 size={16} /> Enviar</Button>}
      </div>
    </>
  );
}

// ───────────── Meditação Diária ─────────────

export function MeditationList({ base }) {
  const state = useLoad(() => api.get('/meditacao'));
  return (
    <>
      <PageHeader title="Meditação Diária" subtitle="Uma história por dia para começar com Deus" />
      <Loading {...state}>
        {(d) => {
          const today = d.days.find((x) => x.date === d.today);
          const before = d.days.filter((x) => x.date < d.today).reverse();
          const after = d.days.filter((x) => x.date > d.today);
          const row = (x) => {
            const body = (
              <>
                <span className="dv-date"><b>{Number(x.date.slice(8))}</b><small>{MONTHS[Number(x.date.slice(5, 7)) - 1].slice(0, 3)}</small></span>
                <span className="grow"><b>{x.title}</b><small>{x.personagem ? `${x.personagem.replace(/\s*\(.*\)$/, '')} · ` : ''}{x.status === 'feito' ? 'Feita no dia' : x.status === 'feito-depois' ? 'Feita depois' : x.status === 'perdido' ? 'Ainda dá para ler' : x.status === 'futuro' ? `Libera em ${br(x.date)}` : x.status === 'hoje' ? 'Hoje' : 'Liberada para teste'}</small></span>
                <span className={'day-st ' + x.status}>{x.status === 'futuro' ? <Lock size={16} /> : x.status.startsWith('feito') ? <CheckCircle2 size={18} /> : <ChevronRight size={18} />}</span>
              </>
            );
            return x.status === 'futuro' ? <div key={x.date} className="day-row locked">{body}</div> : <Link key={x.date} to={`${base}/aprendizagem/meditacao/${x.date}`} className={'day-row ' + x.status}>{body}</Link>;
          };
          return (
            <>
              {d.theme && (
                <div className="dv-theme">
                  <small>Tema do ano</small>
                  <b>{d.theme}</b>
                  <span>Todo dia, a história de alguém que Deus escolheu, da Bíblia até hoje.</span>
                </div>
              )}
              <StreakMini s={d} label="Meditação" />
              {d.today < d.start && <Card className="small center">A Meditação Diária começa em <b>{br(d.start)}</b>.{d.test ? ' No modo de teste você já pode ler todas.' : ''}</Card>}
              {today && (
                <Link to={`${base}/aprendizagem/meditacao/${today.date}`} className={'dv-today' + (today.status.startsWith('feito') ? ' done' : '')}>
                  <small>Meditação de hoje · {longDate(today.date)}</small>
                  <b>{today.title}</b>
                  {today.personagem && <em className="dv-today-char">{today.personagem}</em>}
                  <span>{today.status.startsWith('feito') ? <><CheckCircle2 size={16} /> Feita</> : <><PlayCircle size={16} /> Ler agora</>}</span>
                </Link>
              )}
              {before.length > 0 && <h3 className="dv-h">Dias anteriores</h3>}
              <div className="day-list">{before.map(row)}</div>
              {after.length > 0 && <h3 className="dv-h">Próximos dias</h3>}
              <div className="day-list">{after.slice(0, d.test ? after.length : 7).map(row)}</div>
            </>
          );
        }}
      </Loading>
    </>
  );
}

/** Divide parágrafos em páginas, sem cortar no meio. */
function paginate(paras, budget) {
  const pages = [];
  let cur = [];
  let size = 0;
  paras.forEach((p) => {
    if (cur.length && size + p.text.length > budget) { pages.push(cur); cur = []; size = 0; }
    cur.push(p);
    size += p.text.length;
  });
  if (cur.length) pages.push(cur);
  return pages;
}

export function MeditationDay({ base }) {
  const { date } = useParams();
  const state = useLoad(() => api.get(`/meditacao/${date}`), [date]);
  return <Loading {...state}>{(d) => <MeditationBody key={date} d={d} base={base} />}</Loading>;
}

function MeditationBody({ d, base }) {
  useFocusMode();
  const back = `${base}/aprendizagem/meditacao`;
  const goBack = useBack(back);
  const [mode, setMode] = useState('ler');
  // Trechos na ordem do áudio: título, versículo, parágrafos e a oração.
  const paras = useMemo(() => [
    { k: 0, kind: 'titulo', text: d.title },
    { k: 1, kind: 'verso', text: d.verse },
    ...d.text.map((t, i) => ({ k: i + 2, kind: 'p', text: t })),
    ...(d.prayer ? [{ k: d.text.length + 2, kind: 'oracao', text: d.prayer }] : []),
  ], [d]);
  const budget = typeof window !== 'undefined' && window.innerWidth > 700 ? 1500 : 820;
  const pages = useMemo(() => paginate(paras, budget), [paras, budget]);
  const [page, setPage] = useState(0);
  const [turn, setTurn] = useState('');
  const go = (p) => { if (p >= 0 && p < pages.length && p !== page) { setTurn(p > page ? 'turn-next' : 'turn-prev'); setPage(p); } };
  const v = useNarration(d.audio);
  useEffect(() => {
    if (v.pos < 0) return;
    const p = pages.findIndex((pg) => pg.some((x) => x.k === v.pos));
    if (p >= 0 && p !== page) { setTurn(p > page ? 'turn-next' : 'turn-prev'); setPage(p); }
  }, [v.pos]);
  const toggle = () => (v.playing ? v.stop() : v.startAt(pages[page].some((x) => x.k === v.pos) ? -1 : pages[page][0].k));
  const touch = useRef(null);
  const last = page === pages.length - 1;

  return (
    <div className="dv-day">
      <div className="bible-top">
        <BackButton to={back} />
        <div className="grow"><b>Meditação · {longDate(d.date)}</b><small>{d.completed ? `Concluída (nota ${d.best}/${d.questions.length})` : 'Leia, ouça e responda 3 perguntas'}</small></div>
      </div>
      {mode === 'ler' ? (
        <>
          <div
            className="bible-book"
            onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
              if (touch.current == null || v.playing) return;
              const dx = e.changedTouches[0].clientX - touch.current;
              touch.current = null;
              if (Math.abs(dx) > 50) go(page + (dx < 0 ? 1 : -1));
            }}
          >
            <div key={page} className={'dv-page ' + turn} onAnimationEnd={() => setTurn('')}>
              {pages[page].map((x) => {
                const hl = v.pos === x.k ? ' reading' : '';
                const tap = () => v.available && v.startAt(x.k);
                if (x.kind === 'titulo') return <h1 key="t" className={'dv-title' + hl} onClick={tap}><small>{longDate(d.date)}{d.theme ? ` · ${d.theme}` : ''}</small>{x.text}{d.personagem && <span className="dv-char">{d.personagem}</span>}</h1>;
                if (x.kind === 'verso') return <blockquote key="v" className={'dv-verse' + hl} onClick={tap}>{x.text}</blockquote>;
                if (x.kind === 'oracao') return <p key="o" className={'dv-prayer' + hl} onClick={tap}><b>Oração:</b> {x.text}</p>;
                return <p key={x.k} className={'dv-par' + hl} onClick={tap}>{x.text}</p>;
              })}
              <span className="bible-pg">{page + 1} / {pages.length}</span>
            </div>
          </div>
          <div className="bible-controls">
            <button type="button" className="icon-btn" disabled={page === 0 || v.playing} onClick={() => go(page - 1)} aria-label="Página anterior"><ChevronLeft size={22} /></button>
            <PlayButton v={v} onToggle={toggle} locked={d.audio_locked} />
            <button type="button" className="icon-btn" disabled={last || v.playing} onClick={() => go(page + 1)} aria-label="Próxima página"><ChevronRight size={22} /></button>
          </div>
          <VoiceAudio v={v} />
          {last ? <Button block onClick={() => { v.stop(); setMode('quiz'); window.scrollTo({ top: 0 }); }}><Sparkles size={18} /> {d.completed ? 'Responder de novo' : 'Responder as perguntas'}</Button>
            : <p className="small muted center">Leia até a última página para responder. Ouvindo, a página vira sozinha.</p>}
        </>
      ) : (
        <Quiz questions={d.questions} pass={d.pass} send={(answers) => api.post(`/meditacao/${d.date}/quiz`, { answers })} done={goBack} />
      )}
    </div>
  );
}

// ───────────── Lição da Escola Sabatina ─────────────

export function SabbathHub({ base }) {
  const state = useLoad(() => api.get('/escola-sabatina'));
  const [cat, setCat] = useState(null);
  return (
    <>
      <PageHeader title="Lição da Escola Sabatina" subtitle="Estude a lição do dia, assista ao vídeo e responda" />
      <Loading {...state}>
        {(d) => {
          const c = cat || d.mine;
          const list = d.lessons.filter((l) => l.category === c);
          return (
            <>
              <StreakMini s={d} label="Escola Sabatina" />
              <Tabs tabs={d.categories.map((x) => [x.id, x.name])} value={c} onChange={setCat} />
              <p className="small muted">{d.categories.find((x) => x.id === c)?.ages}{c === d.mine ? ' · a sua idade' : ''}. Todas as lições ficam abertas: a lição do dia, de qualquer categoria, vale para a sequência.</p>
              {!list.length ? <Card className="small center">As lições de {d.categories.find((x) => x.id === c)?.name} ainda vão ser colocadas.</Card> : (
                <div className="day-list">
                  {list.map((l) => {
                    const body = (
                      <>
                        <span className="dv-date"><b>{Number(l.date.slice(8))}</b><small>{MONTHS[Number(l.date.slice(5, 7)) - 1].slice(0, 3)}</small></span>
                        <span className="grow"><b>{l.title}</b><small>{l.today ? 'Hoje · ' : ''}{l.has_video ? 'Com vídeo · ' : ''}{l.done ? 'Concluída' : l.locked ? `Libera em ${br(l.date)}` : 'Estudar'}</small></span>
                        <span className="day-st">{l.locked ? <Lock size={16} /> : l.done ? <CheckCircle2 size={18} /> : <ChevronRight size={18} />}</span>
                      </>
                    );
                    return l.locked ? <div key={l.id} className="day-row locked">{body}</div> : <Link key={l.id} to={`${base}/aprendizagem/escola-sabatina/${l.id}`} className={'day-row' + (l.done ? ' feito' : '')}>{body}</Link>;
                  })}
                </div>
              )}
            </>
          );
        }}
      </Loading>
    </>
  );
}

const ytId = (url) => (url || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)?.[1] || null;

/** Páginas do PDF como um livro (pdf.js, só quando abre a lição). */
function PdfBook({ url, from, to }) {
  const [state, setState] = useState({ loading: true });
  const [page, setPage] = useState(0);
  const [turn, setTurn] = useState('');
  const canvasRef = useRef(null);
  const docRef = useRef(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const worker = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default;
        pdfjs.GlobalWorkerOptions.workerSrc = worker;
        const doc = await pdfjs.getDocument({ url, withCredentials: true }).promise;
        if (!alive) return;
        docRef.current = doc;
        const a = Math.max(1, from || 1);
        const z = Math.min(doc.numPages, to || from || doc.numPages);
        setState({ pages: Array.from({ length: z - a + 1 }, (_x, i) => a + i) });
      } catch (e) {
        if (alive) setState({ error: e.message || 'Não foi possível abrir o PDF' });
      }
    })();
    return () => { alive = false; };
  }, [url, from, to]);
  useEffect(() => {
    if (!state.pages || !docRef.current || !canvasRef.current) return;
    let task;
    (async () => {
      const p = await docRef.current.getPage(state.pages[page]);
      const c = canvasRef.current;
      const width = Math.min(c.parentElement.clientWidth, 900);
      const vp0 = p.getViewport({ scale: 1 });
      const ratio = window.devicePixelRatio || 1;
      const vp = p.getViewport({ scale: (width / vp0.width) * ratio });
      c.width = vp.width;
      c.height = vp.height;
      c.style.width = `${width}px`;
      task = p.render({ canvasContext: c.getContext('2d'), viewport: vp });
      await task.promise.catch(() => {});
    })();
    return () => task?.cancel();
  }, [state.pages, page]);
  if (state.loading) return <Card className="center small">Abrindo a lição…</Card>;
  if (state.error) return <Card className="center small">{state.error}</Card>;
  const go = (p) => { if (p >= 0 && p < state.pages.length) { setTurn(p > page ? 'turn-next' : 'turn-prev'); setPage(p); } };
  return (
    <>
      <div className="bible-book">
        <div key={page} className={'dv-pdf ' + turn} onAnimationEnd={() => setTurn('')}><canvas ref={canvasRef} /></div>
      </div>
      <div className="bible-controls">
        <button type="button" className="icon-btn" disabled={page === 0} onClick={() => go(page - 1)} aria-label="Página anterior"><ChevronLeft size={22} /></button>
        <span className="small"><b>{page + 1}</b> / {state.pages.length}</span>
        <button type="button" className="icon-btn" disabled={page === state.pages.length - 1} onClick={() => go(page + 1)} aria-label="Próxima página"><ChevronRight size={22} /></button>
      </div>
    </>
  );
}

export function SabbathLesson({ base }) {
  const { id } = useParams();
  const state = useLoad(() => api.get(`/escola-sabatina/licao/${id}`), [id]);
  return <Loading {...state}>{(d) => <SabbathBody key={id} d={d} base={base} />}</Loading>;
}

function SabbathBody({ d, base }) {
  useFocusMode();
  const back = `${base}/aprendizagem/escola-sabatina`;
  const goBack = useBack(back);
  const [mode, setMode] = useState('estudo');
  const yt = ytId(d.youtube);
  return (
    <div className="dv-day">
      <div className="bible-top">
        <BackButton to={back} />
        <div className="grow"><b>{d.title}</b><small>{d.category_name} · {br(d.date)}{d.completed ? ' · concluída' : ''}</small></div>
      </div>
      {mode === 'estudo' ? (
        <>
          {yt && (
            <div className="dv-video">
              <iframe src={`https://www.youtube-nocookie.com/embed/${yt}`} title="Vídeo da lição" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          )}
          {d.pdf && <PdfBook url={d.pdf} from={d.page_from} to={d.page_to} />}
          <Button block onClick={() => { setMode('quiz'); window.scrollTo({ top: 0 }); }}><Sparkles size={18} /> {d.completed ? 'Responder de novo' : 'Responder as perguntas'}</Button>
        </>
      ) : (
        <Quiz questions={d.questions} pass={d.pass} send={(answers) => api.post(`/escola-sabatina/licao/${d.id}/quiz`, { answers })} done={goBack} />
      )}
    </div>
  );
}
