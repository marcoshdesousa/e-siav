// Equipe: Aprendizagem Diária. Quem concluiu o Ano Bíblico (ganha o arganel), quem passou todas as
// fases do Bom de Bíblia (ganha a medalha), situação do áudio e data de início do plano.
import { useState } from 'react';
import { Copy, FileText, Medal, Trash2, Trophy, Upload } from 'lucide-react';
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

/** Bom Líder: o admin envia as páginas do livro; com elas são montadas as 50 aulas. */
function BomLiderAdmin() {
  const state = useLoad(() => api.get('/admin/bom-lider'));
  const [busy, run] = useAsync();
  const [progress, setProgress] = useState('');
  const send = async (files) => {
    const list = [...files];
    // em lotes (cabem muitas páginas sem estourar o limite de cada envio)
    for (let i = 0; i < list.length; i += 10) {
      setProgress(`Enviando ${Math.min(i + 10, list.length)} de ${list.length}...`);
      const form = new FormData();
      list.slice(i, i + 10).forEach((f) => form.append('files', f));
      await run(() => api.post('/admin/bom-lider/paginas', form));
    }
    setProgress('');
    state.reload();
  };
  const del = async (id) => { await run(() => api.del(`/admin/bom-lider/paginas/${id}`)); state.reload(); };
  const link = async () => { await run(() => api.post('/admin/bom-lider/link'), 'Link criado!'); state.reload(); };
  return (
    <Loading {...state}>
      {(d) => {
        const url = d.token ? `${window.location.origin}/api/bom-lider/paginas/${d.token}` : null;
        return (
          <>
            <Card className="small">
              <p><b>Aulas prontas:</b> {d.lessons} de 50.</p>
              <p className="muted">Envie aqui as páginas do livro (fotos ou PDF, quantas quiser). Depois é só pedir para montar o plano de aulas a partir delas: 50 aulas com leitura, perguntas de marcar e perguntas para escrever.</p>
              <label className="btn btn-primary btn-sm">
                <Upload size={16} /> Enviar páginas
                <input type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { if (e.target.files.length) send(e.target.files); e.target.value = ''; }} />
              </label>
              {progress && <p>{progress}</p>}
            </Card>
            <Section title={`Páginas enviadas (${d.pages.length})`}>
              <div className="list">
                {d.pages.length === 0 && <p className="muted center">Nenhuma página ainda.</p>}
                {d.pages.map((p, i) => (
                  <div key={p.id} className="list-item">
                    <FileText size={20} />
                    <div className="grow">
                      <div className="title">{i + 1}. {p.name}</div>
                      <div className="sub">{Math.round(p.size / 1024)} KB · {fmtDate(p.created_at)}</div>
                    </div>
                    <a className="btn btn-secondary btn-sm" href={`/api/admin/bom-lider/paginas/${p.id}`} target="_blank" rel="noreferrer">Ver</a>
                    <Button small variant="secondary" busy={busy} onClick={() => del(p.id)} aria-label="Apagar"><Trash2 size={16} /></Button>
                  </div>
                ))}
              </div>
            </Section>
            <Section title="Link para montar as aulas">
              <Card className="small">
                <p className="muted">Este link deixa ler as páginas enviadas sem a senha do admin. Mande só para quem vai montar as aulas. Gerar de novo desativa o link antigo.</p>
                {url && <p className="mono" style={{ wordBreak: 'break-all' }}>{url}</p>}
                <div className="row">
                  {url && <Button small variant="secondary" onClick={() => navigator.clipboard?.writeText(url)}><Copy size={16} /> Copiar</Button>}
                  <Button small busy={busy} onClick={link}>{url ? 'Gerar outro link' : 'Gerar link'}</Button>
                </div>
              </Card>
            </Section>
          </>
        );
      }}
    </Loading>
  );
}

export default function LearningAdmin() {
  const state = useLoad(() => api.get('/admin/ano-biblico'));
  const [tab, setTab] = useState('arganel');
  const [date, setDate] = useState('');
  const [busy, run] = useAsync();
  const save = async (value) => { await run(() => api.put('/admin/ano-biblico/inicio', { date: value }), 'Data salva!'); state.reload(); };
  const gen = async () => { await run(() => api.post('/admin/ano-biblico/audio'), 'Preparo do áudio iniciado'); state.reload(); };
  const [voiceTest, setVoiceTest] = useState(null);
  const testVoice = async () => { setVoiceTest({ busy: true }); try { setVoiceTest(await api.post('/admin/ano-biblico/voz-teste')); } catch (e) { setVoiceTest({ ok: false, error: e.message }); } };
  const setTest = async (on) => { await run(() => api.put('/admin/biblia-teste', { on }), on ? 'Modo de teste ligado' : 'Modo de teste desligado'); state.reload(); };
  return (
    <>
      <PageHeader title="Aprendizagem Diária" subtitle="Ano Bíblico, Bom de Bíblia e Bom Líder" />
      <Loading {...state}>
        {(d) => (
          <>
            <Tabs tabs={[['arganel', `Arganel (${d.completers.length})`], ['medalha', `Medalha (${d.bdb.medals.length})`], ['lider', 'Bom Líder'], ['config', 'Ajustes']]} value={tab} onChange={setTab} />
            {tab === 'lider' && <BomLiderAdmin />}
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
                <Section title="Modo de teste">
                  <Card className="small">
                    <p>{d.test ? <><b>Ligado:</b> todos os dias do Ano Bíblico e o Bom Líder estão liberados para todos testarem.</> : <><b>Desligado:</b> cada dia libera na sua data e o Bom Líder é só para a liderança.</>}</p>
                    <Button small busy={busy} variant={d.test ? 'secondary' : undefined} onClick={() => setTest(!d.test)}>{d.test ? 'Desligar (lançamento)' : 'Ligar modo de teste'}</Button>
                  </Card>
                </Section>
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
                    <p>Versículos com voz: <b>{d.audio.done}</b>{d.audio.total ? ` de ${d.audio.total}` : ''}.{d.audio.running ? ` Preparando agora: ${d.audio.current || '...'}` : ' Parado.'}</p>
                    {d.audio.error && <p className="muted">Último erro: {d.audio.error}</p>}
                    {d.audio.piperError && <p className="muted">Erro do Piper: {d.audio.piperError}</p>}
                    <p className="muted">A voz é preparada versículo por versículo: primeiro o dia (ou a aula do Bom Líder) que alguém abriu, depois os próximos dias, em segundo plano. Fica salva no disco do servidor. Se a voz do servidor falhar, o app usa a voz do próprio celular.</p>
                    <div className="row">
                      <Button small busy={busy} disabled={d.audio.running} onClick={gen}>Preparar agora</Button>
                      <Button small variant="secondary" busy={voiceTest?.busy} onClick={testVoice}>Testar voz</Button>
                    </div>
                    {voiceTest && !voiceTest.busy && (voiceTest.ok
                      ? <p><b>A voz funcionou</b> ({voiceTest.seconds} s de fala em {(voiceTest.ms / 1000).toFixed(1)} s).</p>
                      : <p style={{ color: 'var(--danger)' }}><b>A voz falhou:</b> {voiceTest.error}{voiceTest.piperError ? ` · ${voiceTest.piperError}` : ''}</p>)}
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
