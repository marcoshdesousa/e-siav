// Aprendizagem Diária (só membros): Ano Bíblico, Livro do Ano (em breve), Bom de Bíblia e
// Bom Líder (em breve, só 16+). O card "Sequência" aparece no perfil.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, BookOpenText, Check, CheckCircle2, ChevronLeft, ChevronRight, Flame, Headphones, Lock, Medal, Pause, Play, RotateCcw, Sparkles, Timer, Trophy, Users, Video, X } from 'lucide-react';
import { api } from '../../api.js';
import { Button, Card, Loading, PageHeader, Section, useLoad } from '../../ui.jsx';
import { useOnline } from '../../offline.js';
import { useNarration } from './voice.js';
import { PackReward } from './PackReward.jsx';
import './learning.css';
import './devotional.css';

/** Na leitura e no jogo, a barra de baixo e o "Voltar" do topo somem (tela inteira para o livro). */
export function useFocusMode() {
  useEffect(() => {
    document.body.classList.add('learn-focus');
    return () => document.body.classList.remove('learn-focus');
  }, []);
}

/**
 * Voltar de uma leitura/quiz: volta no histórico (para a lista de onde veio) em vez de empilhar
 * a lista de novo — assim o "voltar" do celular não reabre o estudo.
 */
export function useBack(fallback) {
  const nav = useNavigate();
  return () => (window.history.state?.idx > 0 ? nav(-1) : nav(fallback, { replace: true }));
}
export function BackButton({ to }) {
  const back = useBack(to);
  return <button type="button" className="icon-btn" aria-label="Voltar" onClick={back}><ArrowLeft size={20} /></button>;
}

const br = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const LEVEL = { facil: 'Fácil', intermediario: 'Intermediário', dificil: 'Difícil', 'muito-dificil': 'Muito difícil', muito_dificil: 'Muito difícil' };
const levelKey = (l) => String(l || '').replace('_', '-');
const dias = (n) => `${n} dia${n === 1 ? '' : 's'}`;

// ───────────── Card "Sequência" (perfil) ─────────────

/** As 3 sequências (Ano Bíblico, Meditação e Escola Sabatina), cada uma com o seu foguinho. */
export function StreakTrio({ d }) {
  const items = [['Ano Bíblico', d.bible], ['Meditação', d.meditation], ['Escola Sabatina', d.sabbath]];
  return (
    <div className="streak-trio">
      {items.map(([label, s]) => {
        const n = s?.streak || 0;
        return (
          <div key={label} className={'st-item' + (s?.today_done ? ' on' : '') + (n ? ' lit' : '')}>
            <span className="st-flame"><Flame size={30} strokeWidth={2.2} /></span>
            <b className="st-num">{n}</b>
            <small className="st-days">{n === 1 ? 'dia' : 'dias'}</small>
            <span className="st-label">{label}</span>
            {s?.today_done && <span className="st-check">feito hoje</span>}
          </div>
        );
      })}
    </div>
  );
}

export function StreakCard({ base }) {
  const online = useOnline();
  const state = useLoad(() => (online ? api.get('/aprendizagem') : Promise.resolve(null)), [online]);
  if (!state.data) return null;
  return (
    <Link to={`${base}/aprendizagem`} className="streak-box">
      <div className="streak-box-head"><span><Flame size={18} /> Suas sequências</span><em>Ver <ChevronRight size={16} /></em></div>
      <StreakTrio d={state.data} />
    </Link>
  );
}

// ───────────── Página da Aprendizagem Diária ─────────────

export function LearningHub({ base }) {
  const state = useLoad(() => api.get('/aprendizagem'));
  return (
    <>
      <PageHeader title="Estudo Diário" subtitle="Um pouquinho por dia: Bíblia, meditação, lição e muito mais" />
      <Loading {...state}>
        {(d) => (
          <>
            <div className="streak-box"><StreakTrio d={d} /></div>
            <div className="learn-grid mt">
              <Link to={`${base}/aprendizagem/ano-biblico`} className="learn-card c1">
                <span className="learn-ico"><BookOpenText size={30} /></span>
                <b>Ano Bíblico</b>
                <small>A Bíblia de {br(d.bible.start).slice(0, 5)} a {br(d.bible.end).slice(0, 5)}: leitura com áudio e quiz</small>
                <span className="learn-bar"><i style={{ width: `${(d.bible.done / d.bible.total) * 100}%` }} /></span>
                <small>{d.bible.done} de {d.bible.total} dias</small>
              </Link>
              <Link to={`${base}/aprendizagem/meditacao`} className="learn-card c5">
                <span className="learn-ico"><Sparkles size={30} /></span>
                <b>Meditação Diária</b>
                <small>{d.meditation.today_title ? `Hoje: ${d.meditation.today_title}` : 'Uma mensagem por dia, com áudio e 3 perguntas'}</small>
                <small>{d.meditation.done} feitas</small>
              </Link>
              <Link to={`${base}/aprendizagem/escola-sabatina`} className="learn-card c6">
                <span className="learn-ico"><BookOpen size={30} /></span>
                <b>Lição da Escola Sabatina</b>
                <small>Juvenis, adolescentes, jovens e adultos: a lição do dia, vídeo e perguntas</small>
                <small>{d.sabbath.done} lições feitas</small>
              </Link>
              <Link to={`${base}/aprendizagem/bom-de-biblia`} className="learn-card c3">
                <span className="learn-ico"><Trophy size={30} /></span>
                <b>Bom de Bíblia</b>
                <small>{d.bdb.total} fases de perguntas, do fácil ao muito difícil</small>
                <span className="learn-bar"><i style={{ width: `${d.bdb.total ? (d.bdb.passed / d.bdb.total) * 100 : 0}%` }} /></span>
                <small>{d.bdb.passed} de {d.bdb.total} fases</small>
              </Link>
              {d.leader && (
                <Link to={d.plus ? `${base}/aprendizagem/bom-lider` : `${base}/dbv-mais`} className="learn-card c4">
                  {!d.plus && <span className="plus">DBV+</span>}
                  <span className="learn-ico"><Users size={30} /></span>
                  <b>Bom Líder</b>
                  <small>Manual Administrativo (50 aulas) e Nisto Cremos (16 anos ou mais)</small>
                </Link>
              )}
              <div className="learn-card c2 soon lock">
                <span className="plus">DBV+</span>
                <span className="learn-ico"><BookOpen size={30} /></span>
                <b>Livro do Ano</b>
                <small>Um capítulo por semana</small>
                <span className="chip">Em breve</span>
              </div>
              <Link to={`${base}/aprendizagem/classes`} className="learn-card c7">
                <span className="learn-ico"><Video size={30} /></span>
                <b>Classes e Agrupadas</b>
                <small>Aulas em vídeo para cumprir o caderno da sua classe</small>
                <span className="chip">Novo · Classe Guia</span>
              </Link>
            </div>
            {d.test && <p className="small center"><b>Modo de teste:</b> todos os dias e lições estão liberados para testar.</p>}
            <p className="small muted center">Cada sequência conta o que você faz no próprio dia. Cada dia concluído dá pontos no ranking (você, sua unidade e seu clube) e 1 pacotinho de figurinhas.</p>
          </>
        )}
      </Loading>
    </>
  );
}

function StreakBanner({ b }) {
  return (
    <div className="streak-banner">
      <span className="streak-flame big"><Flame size={44} /><b>{b.streak}</b></span>
      <div className="grow">
        <b>{b.streak ? `${dias(b.streak)} seguidos!` : 'Comece a sua sequência'}</b>
        <small>Recorde: {dias(b.best_streak)} · {b.done} de {b.total} dias lidos</small>
      </div>
    </div>
  );
}

// ───────────── Ano Bíblico: calendário ─────────────

export function BibleYear({ base }) {
  const state = useLoad(() => api.get('/ano-biblico'));
  return (
    <>
      <PageHeader title="Ano Bíblico" subtitle="A Bíblia inteira, um pedaço por dia" />
      <Loading {...state}>{(d) => <BibleYearBody d={d} base={base} />}</Loading>
    </>
  );
}

function BibleYearBody({ d, base }) {
  const today = d.days.find((x) => x.day === d.today_day);
  const missed = d.days.filter((x) => x.status === 'perdido');
  const months = useMemo(() => {
    const m = new Map();
    for (const x of d.days) {
      const k = x.date.slice(0, 7);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(x);
    }
    return [...m.entries()];
  }, [d.days]);
  const to = (x) => `${base}/aprendizagem/ano-biblico/${x.day}`;
  return (
    <>
      <StreakBanner b={d} />
      {d.all_done && (
        <div className="arganel-msg">
          <Medal size={34} />
          <div>
            <b>Parabéns! Você leu a Bíblia inteira!</b>
            <p>Você ganhou um <b>arganel personalizado</b>. Ele será entregue pela equipe do distrito no evento de encerramento.</p>
          </div>
        </div>
      )}
      {d.today_day < 1 && <Card className="center">O Ano Bíblico começa em <b>{br(d.start)}</b>. {d.test ? 'Modo de teste: todos os dias estão liberados para testar.' : 'Até lá, os dias ficam trancados.'}</Card>}
      {today && (
        <Link to={to(today)} className={'today-card' + (today.status === 'feito' ? ' done' : '')}>
          <span className="today-tag">Hoje · {br(today.date)}</span>
          <b>{today.label}</b>
          <span className="today-go">
            {today.status === 'feito' ? <><CheckCircle2 size={18} /> Feito! Nota {today.best}/5</> : <><BookOpenText size={18} /> Ler agora</>}
          </span>
        </Link>
      )}
      {missed.length > 0 && (
        <Section title={`Dias perdidos (${missed.length})`}>
          <p className="small muted">Ainda dá para fazer e ganhar o pacotinho, mas não contam para a sequência.</p>
          <div className="day-list">
            {missed.map((x) => <DayRow key={x.day} x={x} to={to(x)} />)}
          </div>
        </Section>
      )}
      <Section title="Plano completo">
        {months.map(([k, list]) => (
          <details key={k} className="month" open={k === (today?.date || d.today).slice(0, 7)}>
            <summary>{MONTHS[Number(k.slice(5)) - 1]} de {k.slice(0, 4)} <small>{list.filter((x) => x.status.startsWith('feito')).length}/{list.length}</small></summary>
            <div className="day-list">{list.map((x) => <DayRow key={x.day} x={x} to={to(x)} />)}</div>
          </details>
        ))}
      </Section>
    </>
  );
}

function DayRow({ x, to }) {
  const icon = {
    feito: <CheckCircle2 size={18} />, 'feito-depois': <Check size={18} />, perdido: <X size={18} />, hoje: <Flame size={18} />, futuro: <Lock size={16} />, teste: <ChevronRight size={18} />,
  }[x.status];
  const body = (
    <>
      <span className="day-n">{x.day}</span>
      <span className="grow"><b>{x.label}</b><small>{br(x.date)}{x.best ? ` · nota ${x.best}/5` : ''}</small></span>
      <span className={'day-st ' + x.status}>{icon}</span>
    </>
  );
  return x.status === 'futuro'
    ? <div className="day-row locked">{body}</div>
    : <Link to={to} className={'day-row ' + x.status}>{body}</Link>;
}

// ───────────── Voz: barra de carregamento, botão Ouvir e velocidade ─────────────

export function PlayButton({ v, onToggle, locked }) {
  // Áudio é benefício do DBV+: sem assinatura, o botão leva para os planos.
  if (!v.available) return locked ? <Link to="/membro/dbv-mais" className="plus-lock"><Headphones size={20} /> Ouvir com DBV+</Link> : null;
  return (
    <>
      <button type="button" className="play-btn" onClick={onToggle} aria-label={v.playing ? 'Pausar' : 'Ouvir'}>
        {v.playing ? <Pause size={22} /> : <Headphones size={22} />}
        <span>{v.playing ? 'Pausar' : 'Ouvir'}</span>
      </button>
      <button type="button" className="rate-btn" onClick={v.changeRate} aria-label="Velocidade da voz">{String(v.rate).replace('.', ',')}x</button>
    </>
  );
}
export function VoiceAudio({ v }) {
  return v.audioProps ? <audio {...v.audioProps} /> : null;
}

// ───────────── Ano Bíblico: leitura do dia ─────────────

/** Divide os versículos em páginas (como um livro), sem cortar versículo no meio. */
function paginate(chapters, budget) {
  const pages = [];
  let cur = [];
  let size = 0;
  chapters.forEach((ch, ci) => {
    ch.verses.forEach((text, vi) => {
      const cost = text.length + (vi === 0 ? 120 : 0);
      if (cur.length && size + cost > budget) { pages.push(cur); cur = []; size = 0; }
      cur.push({ ci, vi, text });
      size += cost;
    });
  });
  if (cur.length) pages.push(cur);
  return pages;
}

export function BibleDay({ base }) {
  const { day } = useParams();
  const state = useLoad(() => api.get(`/ano-biblico/dia/${day}`), [day]);
  const back = `${base}/aprendizagem/ano-biblico`;
  if (!/^\d+$/.test(day || '')) return <Navigate to={back} replace />;
  return (
    <Loading {...state}>
      {(d) => <BibleDayBody key={day} d={d} back={back} base={base} reload={state.reload} />}
    </Loading>
  );
}

function BibleDayBody({ d, back, base, reload }) {
  useFocusMode();
  const [mode, setMode] = useState('ler');
  const budget = typeof window !== 'undefined' && window.innerWidth > 700 ? 1500 : 850;
  const pages = useMemo(() => paginate(d.chapters, budget), [d.chapters, budget]);
  const [page, setPage] = useState(0);
  const [turn, setTurn] = useState('');
  const go = (p) => {
    if (p < 0 || p >= pages.length || p === page) return;
    setTurn(p > page ? 'turn-next' : 'turn-prev');
    setPage(p);
  };
  // Voz: um áudio só para o dia; cada trecho (título do capítulo e cada versículo) tem o seu início,
  // então a marcação segue a voz e a página vira sozinha.
  const seq = useMemo(() => d.chapters.flatMap((c, ci) => [{ ci, vi: -1 }, ...c.verses.map((_t, vi) => ({ ci, vi }))]), [d.chapters]);
  const v = useNarration(d.audio);
  const { pos, playing } = v;
  const verse = pos >= 0 && seq[pos]?.vi >= 0 ? seq[pos] : null;
  useEffect(() => {
    if (!verse) return;
    const p = pages.findIndex((pg) => pg.some((x) => x.ci === verse.ci && x.vi === verse.vi));
    if (p >= 0 && p !== page) { setTurn(p > page ? 'turn-next' : 'turn-prev'); setPage(p); }
  }, [verse?.ci, verse?.vi]);
  const stopAll = v.stop;
  const toggle = () => {
    if (playing) { v.stop(); return; }
    if (verse && pages[page].some((x) => x.ci === verse.ci && x.vi === verse.vi)) { v.startAt(-1); return; }
    const first = pages[page][0];
    v.startAt(seq.findIndex((x) => x.ci === first.ci && x.vi === (first.vi === 0 ? -1 : first.vi)));
  };
  const tapVerse = (ci, vi) => v.available && v.startAt(seq.findIndex((x) => x.ci === ci && x.vi === vi));

  // Arrastar para o lado vira a página (com a voz tocando, a página vira sozinha).
  const touch = useRef(null);
  const onTouchStart = (e) => { touch.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touch.current == null || playing) return;
    const dx = e.changedTouches[0].clientX - touch.current;
    touch.current = null;
    if (Math.abs(dx) > 50) go(page + (dx < 0 ? 1 : -1));
  };

  if (mode === 'quiz') return <BibleQuiz d={d} back={back} base={base} onRead={() => setMode('ler')} reload={reload} />;

  const last = page === pages.length - 1;
  return (
    <div className="bible-day">
      <div className="bible-top">
        <BackButton to={back} />
        <div className="grow">
          <b>Dia {d.day} · {d.label}</b>
          <small>{br(d.date)}{d.completed ? ` · concluído (nota ${d.best}/5)` : d.status === 'perdido' ? ' · dia perdido' : ''}</small>
        </div>
      </div>

      <div className="bible-book" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div key={page} className={'bible-page ' + turn} onAnimationEnd={() => setTurn('')}>
          {pages[page].map((x) => {
            const c = d.chapters[x.ci];
            return (
              <span key={`${x.ci}-${x.vi}`}>
                {x.vi === 0 && <h2 className={'bible-chapter' + (pos >= 0 && seq[pos]?.ci === x.ci && seq[pos]?.vi === -1 ? ' reading' : '')}>{c.title}{c.part && <small>{c.part}</small>}</h2>}
                <span className={'verse' + (verse && verse.ci === x.ci && verse.vi === x.vi ? ' reading' : '')} onClick={() => tapVerse(x.ci, x.vi)}>
                  <sup>{c.nums ? c.nums[x.vi] : x.vi + 1}</sup>{x.text}{' '}
                </span>
              </span>
            );
          })}
          <span className="bible-pg">{page + 1} / {pages.length}</span>
        </div>
      </div>

      <div className="bible-controls">
        <button type="button" className="icon-btn" disabled={page === 0 || playing} onClick={() => go(page - 1)} aria-label="Página anterior"><ChevronLeft size={22} /></button>
        <PlayButton v={v} onToggle={toggle} locked={d.audio_locked} />
        <button type="button" className="icon-btn" disabled={last || playing} onClick={() => go(page + 1)} aria-label="Próxima página"><ChevronRight size={22} /></button>
      </div>
      <VoiceAudio v={v} />

      {last ? (
        <Button block onClick={() => { stopAll(); setMode('quiz'); window.scrollTo({ top: 0 }); }}>
          <Sparkles size={18} /> {d.completed ? 'Refazer o quiz' : 'Fazer o quiz'}
        </Button>
      ) : (
        <p className="small muted center">Leia até a última página para fazer o quiz. Toque num versículo para ouvir dali; ouvindo, a página vira sozinha.</p>
      )}
    </div>
  );
}

function BibleQuiz({ d, back, onRead, reload }) {
  const goBack = useBack(back);
  const [answers, setAnswers] = useState(() => Array(d.quiz?.length || 5).fill(null));
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!d.quiz) return <Card className="center">O quiz deste dia ainda está sendo preparado. Volte mais tarde! <div className="mt"><Button variant="secondary" onClick={onRead}>Voltar à leitura</Button></div></Card>;
  const send = async () => {
    setBusy(true); setErr('');
    try {
      const r = await api.post(`/ano-biblico/dia/${d.day}/quiz`, { answers });
      setResult(r);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setErr(e.offline ? 'Sem internet. Conecte para enviar o quiz.' : e.message);
    } finally { setBusy(false); }
  };
  const retry = () => { setResult(null); setAnswers(Array(d.quiz.length).fill(null)); reload(); };
  return (
    <div className="bible-quiz">
      <div className="bible-top">
        <button type="button" className="icon-btn" onClick={onRead} aria-label="Voltar à leitura"><ArrowLeft size={20} /></button>
        <div className="grow"><b>Quiz · Dia {d.day}</b><small>{d.label} · acerte {d.pass} de {d.quiz.length}</small></div>
      </div>
      {result && (
        <div className={'quiz-result ' + (result.passed ? 'ok' : 'no')}>
          <b className="quiz-score">{result.score}/{result.total}</b>
          {result.passed ? (
            <>
              <p><b>Dia concluído!</b>{result.on_time ? ' A sua sequência subiu!' : ''}</p>
              {result.pack && <PackReward />}
              {result.points?.member > 0 && (
                <p className="quiz-gift">
                  <Trophy size={18} /> +{result.points.member} pontos no ranking
                  {result.points.unit > 0 ? `, +${result.points.unit} para a sua unidade` : ''} e +{result.points.club} para o seu clube!
                </p>
              )}
              {result.all_done && <p><Medal size={18} /> Você completou o Ano Bíblico! Veja o seu prêmio na página do Ano Bíblico.</p>}
              {result.best > result.score && <p className="small">A sua melhor nota neste dia continua {result.best}/5.</p>}
            </>
          ) : <p>Faltou pouco! Precisa acertar {result.pass}. Releia e tente de novo.</p>}
          <div className="quiz-actions">
            <Button variant="secondary" onClick={retry}><RotateCcw size={16} /> Tentar de novo</Button>
            <Button onClick={goBack}>Continuar</Button>
          </div>
        </div>
      )}
      {d.quiz.map((q, i) => (
        <Card key={i} className="quiz-q">
          <p><b>{i + 1}.</b> {q.q}</p>
          <div className="quiz-opts">
            {q.options.map((o, j) => {
              let cls = answers[i] === j ? ' picked' : '';
              if (result) cls = j === result.correct[i] ? ' right' : answers[i] === j ? ' wrong' : '';
              return (
                <button key={j} type="button" className={'quiz-opt' + cls} disabled={!!result} onClick={() => setAnswers(answers.map((a, k) => (k === i ? j : a)))}>
                  <span className="quiz-letter">{'ABCD'[j]}</span>{o}
                </button>
              );
            })}
          </div>
          {result?.refs?.[i] && <small className="muted">{result.refs[i]}</small>}
        </Card>
      ))}
      {!result && (
        <>
          {err && <p className="small" style={{ color: 'var(--danger)' }}>{err}</p>}
          <Button block busy={busy} disabled={answers.some((a) => a == null)} onClick={send}><Check size={18} /> Enviar respostas</Button>
        </>
      )}
    </div>
  );
}

// ───────────── Bom de Bíblia ─────────────

export function BomDeBiblia({ base }) {
  const state = useLoad(() => api.get('/bom-de-biblia'));
  return (
    <>
      <PageHeader title="Bom de Bíblia" subtitle="Responda rápido: 15 segundos por pergunta" />
      <Loading {...state}>
        {(d) => {
          const groups = [];
          for (const p of d.phases) {
            const k = levelKey(p.level);
            if (!groups.length || groups.at(-1).k !== k) groups.push({ k, list: [] });
            groups.at(-1).list.push(p);
          }
          return (
            <>
              {d.medal ? (
                <div className="arganel-msg">
                  <Medal size={34} />
                  <div><b>Você é Bom de Bíblia!</b><p>Passou todas as {d.total} fases e ganhou a <b>medalha personalizada</b>. A equipe do distrito vai entregar.</p></div>
                </div>
              ) : (
                <Card className="small">Passe de fase acertando <b>{d.pass} de 10</b>. Passando as {d.total} fases, você ganha uma <b>medalha personalizada</b>. ({d.passed}/{d.total})</Card>
              )}
              {groups.map((g) => (
                <Section key={g.k} title={LEVEL[g.k] || g.k}>
                  <div className={'phase-grid lv-' + g.k}>
                    {g.list.map((p) => (p.locked
                      ? <span key={p.phase} className="phase locked"><Lock size={14} />{p.phase}</span>
                      : (
                        <Link key={p.phase} to={`${base}/aprendizagem/bom-de-biblia/${p.phase}`} className={'phase' + (p.passed ? ' passed' : '')}>
                          <b>{p.phase}</b>
                          <small>{p.passed ? `${p.best}/10` : 'Jogar'}</small>
                        </Link>
                      )))}
                  </div>
                </Section>
              ))}
            </>
          );
        }}
      </Loading>
    </>
  );
}

export function BomDeBibliaPhase({ base }) {
  const { phase } = useParams();
  const state = useLoad(() => api.get(`/bom-de-biblia/fase/${phase}`), [phase]);
  const back = `${base}/aprendizagem/bom-de-biblia`;
  return <Loading {...state}>{(d) => <PhasePlay key={phase} d={d} back={back} base={base} />}</Loading>;
}

function PhasePlay({ d, back, base }) {
  useFocusMode();
  const nav = useNavigate();
  const [step, setStep] = useState(-1); // -1 = antes de começar
  const [answers, setAnswers] = useState([]);
  const [left, setLeft] = useState(d.seconds);
  const [shown, setShown] = useState(null); // { choice, answer }
  const [result, setResult] = useState(null);
  const q = d.questions[step];

  const answer = async (choice) => {
    if (shown) return;
    const r = await api.post(`/bom-de-biblia/fase/${d.phase}/confere`, { i: step, choice }).catch(() => null);
    setShown({ choice, answer: r?.answer ?? -1 });
    setAnswers((a) => [...a, choice]);
  };
  // Cronômetro de 15 segundos; acabou o tempo, conta como errada.
  useEffect(() => {
    if (step < 0 || shown || result) return undefined;
    if (left <= 0) { answer(-1); return undefined; }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  });
  const next = async () => {
    if (step + 1 < d.questions.length) {
      setStep(step + 1); setShown(null); setLeft(d.seconds);
      return;
    }
    const r = await api.post(`/bom-de-biblia/fase/${d.phase}`, { answers });
    setResult(r);
  };

  if (step < 0) {
    return (
      <div className="bdb">
        <PageHeader title={`Fase ${d.phase}`} subtitle={LEVEL[levelKey(d.level)]} />
        <Card className="center">
          <Timer size={36} />
          <p>10 perguntas, <b>{d.seconds} segundos</b> para cada uma. Acerte <b>{d.pass}</b> para passar de fase.</p>
          <div className="quiz-actions">
            <Button variant="secondary" onClick={() => nav(back, { replace: true })}><ArrowLeft size={16} /> Voltar</Button>
            <Button onClick={() => { setStep(0); setLeft(d.seconds); }}><Play size={16} /> Iniciar</Button>
          </div>
        </Card>
      </div>
    );
  }
  if (result) {
    return (
      <div className="bdb">
        <div className={'quiz-result ' + (result.passed ? 'ok' : 'no')}>
          <b className="quiz-score">{result.score}/10</b>
          <p>{result.passed ? <b>Fase {d.phase} concluída!</b> : `Precisa acertar ${result.pass}. Tente de novo!`}</p>
          {result.medal && <p><Medal size={18} /> Você passou todas as fases! Ganhou a medalha personalizada.</p>}
          <div className="quiz-actions">
            <Button variant="secondary" onClick={() => nav(back, { replace: true })}>Fases</Button>
            {result.next
              ? <Button onClick={() => nav(`${base}/aprendizagem/bom-de-biblia/${result.next}`)}>Próxima fase <ChevronRight size={16} /></Button>
              : <Button onClick={() => { setStep(-1); setAnswers([]); setShown(null); setResult(null); }}><RotateCcw size={16} /> Jogar de novo</Button>}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="bdb">
      <div className="bdb-top">
        <span>Fase {d.phase} · {step + 1}/10</span>
        <span className={'bdb-timer' + (left <= 5 ? ' hurry' : '')}><Timer size={16} /> {Math.max(0, left)}s</span>
      </div>
      <div className="bdb-bar"><i style={{ width: `${(left / d.seconds) * 100}%` }} /></div>
      <Card className="quiz-q">
        <p className="bdb-q">{q.q}</p>
        <div className="quiz-opts">
          {q.options.map((o, j) => {
            let cls = '';
            if (shown) cls = j === shown.answer ? ' right' : shown.choice === j ? ' wrong' : '';
            return (
              <button key={j} type="button" className={'quiz-opt' + cls} disabled={!!shown} onClick={() => answer(j)}>
                <span className="quiz-letter">{'ABCD'[j]}</span>{o}
              </button>
            );
          })}
        </div>
        {shown && (
          <>
            <p className="small center">{shown.choice === shown.answer ? 'Acertou!' : shown.choice === -1 ? 'Acabou o tempo!' : 'Errou!'}</p>
            <Button block onClick={next}>{step + 1 < d.questions.length ? 'Próxima' : 'Ver resultado'} <ChevronRight size={16} /></Button>
          </>
        )}
      </Card>
    </div>
  );
}

