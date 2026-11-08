// Pastas do Sistema do Clube: Secretaria (matrículas), Tesouraria (minhas finanças),
// Patrimônio, Unidades (membros por unidade), Ferramentas e Suporte.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Cake, Trash2, Copy, Link2, MessageCircle, Search, TrendingDown, TrendingUp, Wallet,
} from 'lucide-react';
import { api, toForm } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { fmtDate, fmtMoney } from '../../format.js';
import {
  Avatar, Badge, Button, Card, Confirm, Empty, Field, ImagePicker, Loading, Modal, PageHeader, Section, Tabs, notify, useAsync, useLoad,
} from '../../ui.jsx';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const today = () => new Date().toISOString().slice(0, 10);

/** Link do WhatsApp a partir do número (coloca o 55 do Brasil quando falta). */
export function waLink(phone, text = '') {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length <= 11) d = '55' + d;
  return `https://wa.me/${d}${text ? '?text=' + encodeURIComponent(text) : ''}`;
}

// ---------- Matrículas (links de divulgação) ----------
function LinkCard({ title, text, url }) {
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); notify('Link copiado!'); } catch { notify('Não deu para copiar. Selecione o link e copie.', 'error'); }
  };
  return (
    <Card>
      <b>{title}</b>
      <p className="small muted" style={{ margin: '.2rem 0 .5rem' }}>{text}</p>
      <div className="signup-link"><Link2 size={16} /> <span className="ellipsis">{url}</span></div>
      <div className="row wrap mt">
        <Button small onClick={copy}><Copy size={14} /> Copiar link</Button>
        <a href={`https://wa.me/?text=${encodeURIComponent(`${title}: ${url}`)}`} target="_blank" rel="noreferrer"><Button small variant="green"><MessageCircle size={14} /> Enviar pelo WhatsApp</Button></a>
      </div>
    </Card>
  );
}

export function MatriculasPage() {
  const { actor } = useAuth();
  return (
    <>
      <PageHeader title="Matrículas" subtitle="Links para divulgar o clube" />
      <LinkCard title="Link de inscrição" text="Para quem quer entrar no clube: ficha de cadastro, ficha de saúde e termos. Você aprova em Membros → Pendentes." url={`${location.origin}/inscricao/${actor.code}`} />
      <LinkCard title="Link do clube" text="Perfil público do clube: história, unidades, medalhas e ranking. Cada unidade tem o seu: o link do clube + / + o número da unidade." url={`${location.origin}/clube/${actor.code}`} />
    </>
  );
}

// ---------- Tesouraria: minhas finanças ----------
export function FinancasPage() {
  const state = useLoad(() => api.get('/club/financas'));
  const [f, setF] = useState(null);
  const [busy, run] = useAsync();
  const add = async () => {
    await run(() => api.post('/club/financas', f), 'Lançamento salvo!');
    setF(null);
    state.reload();
  };
  return (
    <>
      <PageHeader title="Tesouraria" subtitle="Balancete do clube. É só anotação: não cobra nem paga nada." action={<Button small onClick={() => setF({ kind: 'entrada', description: '', amount: '', date: today() })}>+ Lançar</Button>} />
      <Loading {...state}>
        {(d) => (
          <>
            <div className="stats">
              <div className="stat"><span className="stat-icon"><TrendingUp size={20} /></span><b>{fmtMoney(d.entradas)}</b><span>Entradas</span></div>
              <div className="stat"><span className="stat-icon"><TrendingDown size={20} /></span><b>{fmtMoney(d.saidas)}</b><span>Saídas</span></div>
              <div className="stat"><span className="stat-icon"><Wallet size={20} /></span><b style={{ color: d.saldo < 0 ? 'var(--red-ink)' : undefined }}>{fmtMoney(d.saldo)}</b><span>Saldo</span></div>
            </div>
            <Section title="Lançamentos">
              <div className="list">
                {d.rows.map((x) => (
                  <div key={x.id} className="list-item">
                    <span className={'fin-ico ' + x.kind}>{x.kind === 'entrada' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}</span>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="title">{x.description}</div>
                      <div className="sub">{fmtDate(x.date)} · <b className={x.kind === 'entrada' ? 'fin-in' : 'fin-out'}>{x.kind === 'entrada' ? '+' : '−'} {fmtMoney(x.amount_cents)}</b></div>
                    </div>
                    <Confirm text="Apagar este lançamento?" onYes={() => run(() => api.del('/club/financas/' + x.id), 'Apagado').then(state.reload)}><Trash2 size={14} /></Confirm>
                  </div>
                ))}
                {!d.rows.length && <Empty icon={Wallet}>Nenhum lançamento ainda. Ex.: “Acampamento de inverno: entrou R$ 500”.</Empty>}
              </div>
            </Section>
          </>
        )}
      </Loading>
      {f && (
        <Modal title="Novo lançamento" onClose={() => setF(null)}
          footer={<><Button variant="secondary" onClick={() => setF(null)}>Cancelar</Button><Button busy={busy} disabled={!f.description.trim() || !f.amount} onClick={add}>Salvar</Button></>}>
          <div className="form">
            <div className="seg" role="tablist">
              <button type="button" className={f.kind === 'entrada' ? 'active' : ''} onClick={() => setF({ ...f, kind: 'entrada' })}>Entrada</button>
              <button type="button" className={f.kind === 'saida' ? 'active' : ''} onClick={() => setF({ ...f, kind: 'saida' })}>Saída</button>
            </div>
            <Field label="Descrição"><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Ex.: Acampamento de inverno" /></Field>
            <div className="grid2">
              <Field label="Valor (R$)"><input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0,00" /></Field>
              <Field label="Data"><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ---------- Patrimônio ----------
export function PatrimonioPage() {
  const state = useLoad(() => api.get('/club/patrimonio'));
  const [f, setF] = useState(null);
  const [busy, run] = useAsync();
  const cents = (c) => (c == null ? '' : (c / 100).toFixed(2).replace('.', ','));
  const save = async () => {
    const body = { ...f, photo: f.photo instanceof File ? f.photo : undefined };
    await run(() => (f.id ? api.put('/club/patrimonio/' + f.id, toForm(body)) : api.post('/club/patrimonio', toForm(body))), 'Patrimônio salvo!');
    setF(null);
    state.reload();
  };
  return (
    <>
      <PageHeader title="Meus patrimônios" subtitle="O que o clube tem: barracas, bandeiras, materiais..." action={<Button small onClick={() => setF({ name: '', price: '', acquired_at: '', notes: '', photo: null })}>+ Novo</Button>} />
      <Loading {...state}>
        {(d) => (
          <>
            <Card className="small">{d.rows.length} {d.rows.length === 1 ? 'item' : 'itens'} · valor total <b>{fmtMoney(d.total_cents)}</b></Card>
            <div className="asset-grid mt">
              {d.rows.map((a) => (
                <button type="button" key={a.id} className="asset-card" onClick={() => setF({ ...a, price: cents(a.price_cents), acquired_at: a.acquired_at || '', notes: a.notes || '' })}>
                  <Avatar src={a.photo} name={a.name} size={72} square />
                  <b>{a.name}</b>
                  <small>{a.price_cents != null ? fmtMoney(a.price_cents) : 'Sem valor'}</small>
                </button>
              ))}
            </div>
            {!d.rows.length && <Empty>Nenhum patrimônio cadastrado.</Empty>}
          </>
        )}
      </Loading>
      {f && (
        <Modal title={f.id ? 'Editar patrimônio' : 'Novo patrimônio'} onClose={() => setF(null)}
          footer={<>
            {f.id && <Confirm text={`Apagar ${f.name}?`} onYes={() => run(() => api.del('/club/patrimonio/' + f.id), 'Apagado').then(() => { setF(null); state.reload(); })}>Apagar</Confirm>}
            <Button busy={busy} disabled={!f.name.trim()} onClick={save}>Salvar</Button>
          </>}>
          <div className="form">
            <ImagePicker label="Foto do patrimônio" value={f.photo} onChange={(photo) => setF({ ...f, photo })} round={false} name={f.name} />
            <Field label="Nome"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex.: Barraca 6 pessoas" /></Field>
            <div className="grid2">
              <Field label="Quanto custou (R$)"><input inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="0,00" /></Field>
              <Field label="Comprado em"><input type="date" value={f.acquired_at} onChange={(e) => setF({ ...f, acquired_at: e.target.value })} /></Field>
            </div>
            <Field label="Observações (opcional)"><textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </>
  );
}

// ---------- Unidades: membros por unidade ----------
export function MembrosPorGrupo({ base }) {
  const members = useLoad(() => api.get('/club/members'));
  const units = useLoad(() => api.get('/club/units'));
  return (
    <Loading data={members.data && units.data} loading={members.loading || units.loading} error={members.error || units.error}>
      {() => {
        const list = members.data.filter((m) => m.status !== 'inativo');
        const groups = [...units.data.map((u) => ({ id: u.id, name: u.name, logo: u.logo })), { id: null, name: 'Sem unidade' }];
        return groups.map((g) => {
          const ms = list.filter((m) => (m.unit_id || null) === g.id);
          if (!ms.length && g.id === null) return null;
          return (
            <Section key={g.id ?? 'none'} title={`${g.name} (${ms.length})`}>
              <div className="list">
                {ms.map((m) => (
                  <Link key={m.id} to={`${base}/ver/membro/${m.link}`} className="list-item">
                    <Avatar src={m.photo} name={m.name} size={38} />
                    <div className="grow"><div className="title">{m.name}</div><div className="sub">{m.age} anos · {m.cargo}</div></div>
                    {m.status === 'pendente' && <Badge kind="yellow">Pendente</Badge>}
                  </Link>
                ))}
                {!ms.length && <Empty>Ninguém nesta unidade.</Empty>}
              </div>
            </Section>
          );
        });
      }}
    </Loading>
  );
}

// ---------- Ferramentas ----------
export function Aniversariantes() {
  const state = useLoad(() => api.get('/club/members'));
  const [month, setMonth] = useState(new Date().getMonth());
  return (
    <>
      <Field label="Mês">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>
      </Field>
      <Loading {...state}>
        {(list) => {
          const now = new Date();
          const rows = list.filter((m) => m.status !== 'inativo' && m.birth_date && Number(m.birth_date.slice(5, 7)) === month + 1)
            .sort((a, b) => a.birth_date.slice(8, 10).localeCompare(b.birth_date.slice(8, 10)));
          const year = month < now.getMonth() ? now.getFullYear() + 1 : now.getFullYear();
          return rows.length ? (
            <div className="list mt">
              {rows.map((m) => {
                const isToday = month === now.getMonth() && Number(m.birth_date.slice(8, 10)) === now.getDate();
                return (
                  <div key={m.id} className={'list-item' + (isToday ? ' bday-today' : '')}>
                    <span className="agenda-date"><b>{m.birth_date.slice(8, 10)}</b><small>{MESES[month].slice(0, 3)}</small></span>
                    <Avatar src={m.photo} name={m.name} size={38} />
                    <div className="grow"><div className="title">{m.name}{isToday ? ' 🎉' : ''}</div><div className="sub">Faz {year - Number(m.birth_date.slice(0, 4))} anos · {m.unit_name || 'Sem unidade'}</div></div>
                  </div>
                );
              })}
            </div>
          ) : <Empty icon={Cake}>Ninguém faz aniversário em {MESES[month].toLowerCase()}.</Empty>;
        }}
      </Loading>
    </>
  );
}

export function Contatos() {
  const state = useLoad(() => api.get('/club/contatos'));
  const [q, setQ] = useState('');
  return (
    <>
      <div className="search-box"><Search size={16} /><input placeholder="Buscar por nome ou código" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <Loading {...state}>
        {(list) => {
          const nq = q.trim().toLowerCase();
          const rows = list.filter((m) => !nq || m.name.toLowerCase().includes(nq) || m.code.includes(nq));
          return (
            <div className="list mt">
              {rows.map((m) => (
                <div key={m.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                  <Avatar src={m.photo} name={m.name} size={42} />
                  <div className="grow">
                    <div className="title">{m.name}</div>
                    <div className="sub">{m.age} anos · {m.unit_name || 'Sem unidade'}</div>
                    <div className="contact-lines">
                      {m.whatsapp
                        ? <a className="contact-line" href={waLink(m.whatsapp)} target="_blank" rel="noreferrer"><MessageCircle size={16} /><span><small>Membro</small>{m.whatsapp}</span></a>
                        : <span className="contact-line off"><MessageCircle size={16} /><span><small>Membro</small>sem WhatsApp</span></span>}
                      {m.responsavel_whatsapp && (
                        <a className="contact-line resp" href={waLink(m.responsavel_whatsapp)} target="_blank" rel="noreferrer"><MessageCircle size={16} /><span><small>Responsável{m.responsavel_nome ? ` · ${m.responsavel_nome}` : ''}</small>{m.responsavel_whatsapp}</span></a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {!rows.length && <Empty>Ninguém encontrado.</Empty>}
            </div>
          );
        }}
      </Loading>
    </>
  );
}

export function FerramentasPage() {
  const [tab, setTab] = useState('aniversariantes');
  return (
    <>
      <PageHeader title="Ferramentas" />
      <Tabs tabs={[['aniversariantes', 'Aniversariantes'], ['contatos', 'Contatos']]} value={tab} onChange={setTab} />
      {tab === 'aniversariantes' ? <Aniversariantes /> : <Contatos />}
    </>
  );
}

// ---------- Suporte ----------
export function SuportePage() {
  const state = useLoad(() => api.get('/club/suporte'));
  const { actor } = useAuth();
  return (
    <>
      <PageHeader title="Suporte" subtitle="Fale com a equipe do App do DBV" />
      <Loading {...state}>
        {(s) => (
          <Card className="center">
            <MessageCircle size={40} color="var(--green)" />
            <p>Dúvidas, problemas no app ou sugestões? Chame a gente.</p>
            {s.whatsapp
              ? <a href={waLink(s.whatsapp, `Olá! Sou do ${actor.name} (código ${actor.code}) e preciso de ajuda.`)} target="_blank" rel="noreferrer"><Button variant="green"><MessageCircle size={16} /> Falar no WhatsApp</Button></a>
              : <p className="small muted">O contato do suporte ainda vai ser cadastrado.</p>}
          </Card>
        )}
      </Loading>
    </>
  );
}
