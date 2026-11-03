// Formulário público (fora do app, sem login): site/formulario/<link>. Primeiro o nome e o clube;
// depois uma pergunta por tela, com a barra de progresso; no fim, o agradecimento.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Send, Star, ThumbsDown, ThumbsUp } from 'lucide-react';
import { api } from '../api.js';
import { Loading, Spinner, useLoad } from '../ui.jsx';
import './forms.css';

const STAR_LABEL = ['', 'Ruim', 'Regular', 'Bom', 'Muito bom', 'Excelente!'];

function Stars({ value, onChange }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value || 0;
  return (
    <div className="pf-stars-wrap">
      <div className="pf-stars" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-label={`${n} estrela${n > 1 ? 's' : ''}`} className={n <= shown ? 'on' : ''}
            onMouseEnter={() => setHover(n)} onClick={() => onChange(n)}>
            <Star size={40} strokeWidth={1.6} />
          </button>
        ))}
      </div>
      <span className="pf-star-label">{shown ? STAR_LABEL[shown] : 'Toque nas estrelas'}</span>
    </div>
  );
}

function Question({ q, value, onChange, onNext }) {
  if (q.type === 'estrelas') return <Stars value={value} onChange={(v) => { onChange(v); setTimeout(onNext, 450); }} />;
  if (q.type === 'simnao') {
    return (
      <div className="pf-yesno">
        <button type="button" className={'yes' + (value === 'sim' ? ' on' : '')} onClick={() => { onChange('sim'); setTimeout(onNext, 350); }}><ThumbsUp size={30} /> Sim</button>
        <button type="button" className={'no' + (value === 'nao' ? ' on' : '')} onClick={() => { onChange('nao'); setTimeout(onNext, 350); }}><ThumbsDown size={30} /> Não</button>
      </div>
    );
  }
  if (q.type === 'escolha') {
    return (
      <div className="pf-options">
        {q.options.map((o) => (
          <button key={o} type="button" className={value === o ? 'on' : ''} onClick={() => { onChange(o); setTimeout(onNext, 350); }}>
            <span className="pf-radio">{value === o && <Check size={14} />}</span>{o}
          </button>
        ))}
      </div>
    );
  }
  return <textarea className="pf-text" rows={5} maxLength={2000} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="Escreva aqui a sua resposta..." autoFocus />;
}

const filled = (q, v) => (q.type === 'texto' ? !!String(v || '').trim() : v != null && v !== '');

function FormBody({ f, slug }) {
  const [step, setStep] = useState(-1); // -1: nome e clube; depois as perguntas
  const [name, setName] = useState('');
  const [club, setClub] = useState('');
  const [other, setOther] = useState('');
  const [answers, setAnswers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const total = f.questions.length;
  // Cada tela começa do topo (no celular, a lista de clubes empurra a página para baixo).
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [step, done]);
  const clubOk = club && (club !== 'Outro' || other.trim().length >= 2);
  const who = name.trim().length >= 3 && clubOk;

  if (!f.active) return <div className="pf-card pf-end"><CheckCircle2 size={48} /><h2>Formulário encerrado</h2><p>Este formulário não está mais recebendo respostas. Obrigado!</p></div>;
  if (done) {
    return (
      <div className="pf-card pf-end">
        <span className="pf-done-ico"><Check size={42} strokeWidth={3} /></span>
        <h2>Obrigado, {name.trim().split(' ')[0]}!</h2>
        <p>A sua resposta foi enviada. Ela vai ajudar o Distrito a planejar um ano ainda melhor.</p>
      </div>
    );
  }

  const send = async () => {
    setBusy(true); setErr('');
    try {
      await api.post(`/public/formularios/${slug}`, { name, club, club_other: other, answers });
      setDone(true);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const next = () => setStep((s) => Math.min(s + 1, total - 1));

  if (step < 0) {
    return (
      <div className="pf-card">
        <h2 className="pf-h">Antes de começar</h2>
        <label className="pf-field">
          <span>Seu nome</span>
          <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Nome e sobrenome" autoComplete="name" />
        </label>
        <div className="pf-field">
          <span>Seu clube</span>
          <div className="pf-clubs">
            {[...f.clubs, 'Outro'].map((c) => (
              <button key={c} type="button" className={club === c ? 'on' : ''} onClick={() => setClub(c)}>
                <span className="pf-radio">{club === c && <Check size={14} />}</span>{c === 'Outro' ? 'Outro clube' : c}
              </button>
            ))}
          </div>
          {club === 'Outro' && <input className="pf-other" value={other} maxLength={80} onChange={(e) => setOther(e.target.value)} placeholder="Nome do seu clube" autoFocus />}
        </div>
        <button type="button" className="pf-btn primary" disabled={!who} onClick={() => setStep(0)}>Começar <ArrowRight size={18} /></button>
      </div>
    );
  }

  const q = f.questions[step];
  const last = step === total - 1;
  const set = (v) => setAnswers((a) => { const c = [...a]; c[step] = v; return c; });
  return (
    <div className="pf-card">
      <div className="pf-progress"><i style={{ width: `${((step + 1) / total) * 100}%` }} /></div>
      <span className="pf-count">Pergunta {step + 1} de {total}</span>
      <h2 className="pf-q">{q.q}</h2>
      <Question key={step} q={q} value={answers[step]} onChange={set} onNext={() => !last && next()} />
      {err && <p className="pf-err">{err}</p>}
      <div className="pf-nav">
        <button type="button" className="pf-btn" onClick={() => setStep(step - 1)}><ArrowLeft size={18} /> Voltar</button>
        {last
          ? <button type="button" className="pf-btn primary" disabled={busy || !f.questions.every((x, i) => filled(x, answers[i]))} onClick={send}>{busy ? <Spinner /> : <><Send size={17} /> Enviar</>}</button>
          : <button type="button" className="pf-btn primary" disabled={!filled(q, answers[step])} onClick={next}>Próxima <ArrowRight size={18} /></button>}
      </div>
    </div>
  );
}

export default function PublicForm() {
  const { slug } = useParams();
  const state = useLoad(() => api.get(`/public/formularios/${slug}`), [slug]);
  return (
    <div className="pf-page">
      <header className="pf-top">
        <img src="/marca/logo.svg" alt="" />
        <span>App do DBV</span>
      </header>
      <Loading {...state}>
        {(f) => (
          <main className="pf-main">
            <div className="pf-hero">
              <small>Formulário</small>
              <h1>{f.title}</h1>
              {f.description && <p>{f.description}</p>}
            </div>
            <FormBody f={f} slug={slug} />
          </main>
        )}
      </Loading>
    </div>
  );
}
