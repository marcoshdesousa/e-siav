// Classes e Agrupadas: aulas em vídeo para cumprir o caderno de cada classe.
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BadgeCheck, CheckCircle2, ChevronLeft, ChevronRight, Lock, NotebookPen, PlayCircle, Video } from 'lucide-react';
import { api } from '../../api.js';
import { Button, Card, Loading, PageHeader, Tabs, useLoad } from '../../ui.jsx';
import { useBack } from './Learning.jsx';
import { Quiz } from './Devotional.jsx';
import './classes.css';

const mins = (s) => (s ? `${Math.max(1, Math.round(s / 60))} min` : '');

export function ClassesHub({ base }) {
  const state = useLoad(() => api.get('/classes'));
  const [tab, setTab] = useState('regular');
  return (
    <>
      <PageHeader title="Classes e Agrupadas" subtitle="Aulas em vídeo para você cumprir o seu caderno" />
      <Tabs tabs={[['regular', 'Classes regulares'], ['agrupada', 'Agrupadas']]} value={tab} onChange={setTab} />
      <Loading {...state}>
        {(list) => (
          <div className="cls-grid">
            {list.filter((c) => c.kind === tab).map((c) => (c.available ? (
              <Link key={c.id} to={`${base}/aprendizagem/classes/${c.id}`} className={`cls-card cls-${c.id}`}>
                <span className="cls-ico"><Video size={26} /></span>
                <b>{c.name}</b>
                <small>{c.total} aulas em vídeo{c.age ? ` · ${c.age} anos` : ''}</small>
                <span className="cls-bar"><i style={{ width: `${(c.done / c.total) * 100}%` }} /></span>
                <small>{c.done} de {c.total} concluídas</small>
              </Link>
            ) : (
              <div key={c.id} className={`cls-card soon cls-${c.id}`}>
                <span className="cls-ico"><Lock size={24} /></span>
                <b>{c.name}</b>
                <small>{c.age ? `${c.age} anos` : 'Classe agrupada'}</small>
                <span className="chip">Em breve</span>
              </div>
            )))}
          </div>
        )}
      </Loading>
    </>
  );
}

export function ClassPage({ base }) {
  const { id } = useParams();
  const state = useLoad(() => api.get('/classes/' + id), [id]);
  return (
    <Loading {...state}>
      {(c) => {
        const groups = [];
        for (const l of c.lessons) { const g = groups.at(-1); if (g && g.secao === l.secao) g.items.push(l); else groups.push({ secao: l.secao, items: [l] }); }
        return (
          <>
            <PageHeader title={`Classe ${c.name}`} subtitle={`${c.total} aulas em vídeo · ${c.done} concluídas`} />
            <Card className="cls-intro small">
              <NotebookPen size={20} />
              <span>Assista à aula, faça no seu caderno o que ela pede e responda o quiz. Os livros e as especialidades da classe você faz com o seu clube.{!c.plus && ` As ${c.free} primeiras aulas são grátis; as outras são do DBV+.`}</span>
            </Card>
            {groups.map((g) => (
              <div key={g.secao + g.items[0].n}>
                <h3 className="cls-sec">{g.secao}</h3>
                <div className="cls-list">
                  {g.items.map((l) => (
                    <Link key={l.n} to={l.locked ? `${base}/dbv-mais` : `${base}/aprendizagem/classes/${id}/${l.n}`} className={'cls-row' + (l.done ? ' done' : '') + (l.locked ? ' locked' : '')}>
                      <span className="cls-n">{l.done ? <CheckCircle2 size={18} /> : l.n}</span>
                      <span className="cls-txt"><b>{l.titulo}</b><small>Aula {l.n}{l.duration ? ` · ${mins(l.duration)}` : ''}{l.free && !c.plus ? ' · grátis' : ''}</small></span>
                      {l.locked ? <span className="cls-plus"><BadgeCheck size={14} /> DBV+</span> : <PlayCircle size={22} className="cls-play" />}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </>
        );
      }}
    </Loading>
  );
}

export function ClassLesson({ base }) {
  const { id, n } = useParams();
  const nav = useNavigate();
  const back = useBack(`${base}/aprendizagem/classes/${id}`);
  const state = useLoad(() => api.get(`/classes/${id}/aula/${n}`), [id, n]);
  const video = useRef(null);
  const [slide, setSlide] = useState(0);
  const [tab, setTab] = useState('aula');
  return (
    <Loading {...state}>
      {(a) => {
        const go = (k) => nav(`${base}/aprendizagem/classes/${id}/${k}`);
        const onTime = () => {
          const t = video.current?.currentTime || 0; const s = a.video?.starts || [];
          let i = 0; for (let k = 0; k < s.length; k++) if (s[k] <= t + 0.1) i = k;
          if (i !== slide) setSlide(i);
        };
        const seek = (i) => { if (video.current && a.video) { video.current.currentTime = a.video.starts[i] || 0; video.current.play().catch(() => {}); } };
        return (
          <div className="cls-lesson">
            <div className="bible-top">
              <button type="button" className="icon-btn" onClick={back} aria-label="Voltar"><ChevronLeft size={20} /></button>
              <div className="grow"><b>Aula {a.n} · {a.titulo}</b><small>Classe {a.classe.name} · {a.secao}</small></div>
            </div>
            {a.locked ? (
              <Card className="center">
                <Lock size={30} />
                <p><b>Esta aula é do DBV+.</b></p>
                <p className="small muted">As primeiras aulas de cada classe são grátis. Com o DBV+ você assiste a todas.</p>
                <Link to={`${base}/dbv-mais`} className="plus-lock"><BadgeCheck size={18} /> Ver o DBV+</Link>
              </Card>
            ) : (
              <>
                {a.video ? (
                  <div className="cls-video">
                    <video ref={video} key={a.video.url} src={a.video.url} poster={a.video.poster || undefined} controls playsInline preload="metadata" onTimeUpdate={onTime} />
                  </div>
                ) : <Card className="center small muted">O vídeo desta aula está sendo preparado. Enquanto isso, veja o que fazer no caderno.</Card>}
                <Tabs tabs={[['aula', 'Tópicos'], ['caderno', 'No caderno'], ['quiz', a.completed ? 'Quiz ✓' : 'Quiz']]} value={tab} onChange={setTab} />
                {tab === 'aula' && (
                  <>
                    <Card className="small"><b>Requisito:</b> {a.requisito}</Card>
                    <div className="cls-topics">
                      {a.slides.map((t, i) => t && (
                        <button key={i} type="button" className={'cls-topic' + (i === slide ? ' on' : '')} onClick={() => seek(i)} disabled={!a.video}>
                          <span>{i + 1}</span>{t}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {tab === 'caderno' && (
                  <Card className="cls-todo">
                    <p className="cls-todo-h"><NotebookPen size={20} /> Para cumprir no seu caderno</p>
                    <ol>{a.caderno.map((t, i) => <li key={i}>{t}</li>)}</ol>
                  </Card>
                )}
                {tab === 'quiz' && (
                  <Quiz questions={a.quiz} pass={a.pass} send={(answers) => api.post(`/classes/${id}/aula/${a.n}/quiz`, { answers })} onAgain={() => {}} done={() => (a.next ? go(a.next) : back())} />
                )}
              </>
            )}
            <div className="bl-nav mt">
              <Button variant="secondary" disabled={!a.prev} onClick={() => go(a.prev)}><ChevronLeft size={16} /> Aula anterior</Button>
              <Button variant="secondary" disabled={!a.next} onClick={() => go(a.next)}>Próxima aula <ChevronRight size={16} /></Button>
            </div>
          </div>
        );
      }}
    </Loading>
  );
}
