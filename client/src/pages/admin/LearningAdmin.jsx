// Equipe: Aprendizagem Diária. Quem concluiu o Ano Bíblico (ganha o arganel), quem passou todas as
// fases do Bom de Bíblia (ganha a medalha), situação do áudio e data de início do plano.
import { useState } from 'react';
import { Medal, Trophy } from 'lucide-react';
import { api } from '../../api.js';
import { fmtDate } from '../../format.js';
import { Button, Card, Field, Loading, PageHeader, Section, Tabs, useAsync, useLoad } from '../../ui.jsx';

function People({ rows, icon: Icon, empty }) {
  return (
    <div className="list">
      {rows.length === 0 && <p className="muted center">{empty}</p>}
      {rows.map((x) => (
        <div key={x.id} className="list-item">
          <Icon size={22} style={{ color: 'var(--yellow)' }} />
          <div className="grow">
            <div className="title">{x.name} <span className="muted small">#{x.code}</span></div>
            <div className="sub">{x.club_name}{x.unit_name ? ` · Unidade ${x.unit_name}` : ''} · concluiu em {fmtDate(x.finished_at)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LearningAdmin() {
  const state = useLoad(() => api.get('/admin/ano-biblico'));
  const [tab, setTab] = useState('arganel');
  const [date, setDate] = useState('');
  const [busy, run] = useAsync();
  const save = async (value) => { await run(() => api.put('/admin/ano-biblico/inicio', { date: value }), 'Data salva!'); state.reload(); };
  const gen = async () => { await run(() => api.post('/admin/ano-biblico/audio'), 'Preparo do áudio iniciado'); state.reload(); };
  return (
    <>
      <PageHeader title="Aprendizagem Diária" subtitle="Ano Bíblico e Bom de Bíblia" />
      <Loading {...state}>
        {(d) => (
          <>
            <Tabs tabs={[['arganel', `Arganel (${d.completers.length})`], ['medalha', `Medalha (${d.bdb.medals.length})`], ['config', 'Ajustes']]} value={tab} onChange={setTab} />
            {tab === 'arganel' && (
              <>
                <p className="small muted">Quem leu todos os {d.total} dias ganha o arganel personalizado, entregue no evento de encerramento. {d.readers} membro(s) já concluíram pelo menos um dia.</p>
                <People rows={d.completers} icon={Medal} empty="Ninguém concluiu ainda." />
              </>
            )}
            {tab === 'medalha' && (
              <>
                <p className="small muted">Quem passou as {d.bdb.phases} fases do Bom de Bíblia ganha a medalha personalizada.</p>
                <People rows={d.bdb.medals} icon={Trophy} empty="Ninguém passou todas as fases ainda." />
              </>
            )}
            {tab === 'config' && (
              <>
                <Section title="Plano">
                  <Card className="small">
                    <p>Início: <b>{fmtDate(d.start)}</b> · fim: <b>{fmtDate(d.end)}</b> · {d.total} dias · quizzes prontos: {d.quizzes}/{d.total}</p>
                    <Field label="Mudar o início (para testar antes)" hint={`O normal é ${fmtDate(d.default_start)}.`}>
                      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </Field>
                    <div className="row">
                      <Button small busy={busy} disabled={!date} onClick={() => save(date)}>Salvar</Button>
                      <Button small variant="secondary" busy={busy} onClick={() => save('')}>Voltar ao normal</Button>
                    </div>
                  </Card>
                </Section>
                <Section title="Áudio (voz Piper)">
                  <Card className="small">
                    <p>Capítulos com áudio: <b>{d.audio.done}</b>{d.audio.total ? ` de ${d.audio.total}` : ''}.{d.audio.running ? ` Preparando agora: ${d.audio.current || '...'}` : ' Parado.'}</p>
                    {d.audio.error && <p className="muted">Último erro: {d.audio.error}</p>}
                    <p className="muted">O áudio é preparado sozinho em segundo plano, começando pela leitura de hoje. Fica salvo no disco do servidor (cerca de 1 GB para a Bíblia inteira).</p>
                    <Button small busy={busy} disabled={d.audio.running} onClick={gen}>Preparar agora</Button>
                  </Card>
                </Section>
              </>
            )}
          </>
        )}
      </Loading>
    </>
  );
}
