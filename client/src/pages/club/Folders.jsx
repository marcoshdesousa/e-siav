// Pastas do Sistema do Clube: Secretaria (agenda, matrículas), Tesouraria (minhas finanças),
// Patrimônio, Biblioteca (especialidades e classes), Unidades (membros por unidade), Ferramentas e Suporte.
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Cake, CalendarDays, Trash2, ChevronLeft, ChevronRight, Clock, Copy, Link2, MapPin, MessageCircle, Printer, Search, TrendingDown, TrendingUp, Wallet,
} from 'lucide-react';
import { api, toForm } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { fmtDate, fmtMoney } from '../../format.js';
import {
  Avatar, Badge, Button, Card, Confirm, ContentIcon, Empty, Field, ImagePicker, Loading, Modal, PageHeader, Section, Tabs, notify, useAsync, useLoad,
} from '../../ui.jsx';
import CatalogPicker from '../Catalog.jsx';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const today = () => new Date().toISOString().slice(0, 10);
const pad = (n) => String(n).padStart(2, '0');

/** Link do WhatsApp a partir do número (coloca o 55 do Brasil quando falta). */
export function waLink(phone, text = '') {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length <= 11) d = '55' + d;
  return `https://wa.me/${d}${text ? '?text=' + encodeURIComponent(text) : ''}`;
}

// ---------- Agenda ----------
const ORIGEM = { clube: ['green', 'Do clube'], geral: ['yellow', 'Para todos os clubes'], distrito: ['blue', 'Do distrito'] };
const origemDe = (a) => (a.creator_type === 'club' ? ORIGEM.clube
  : a.scope === 'distrito' ? ['blue', a.district_name || 'Do distrito']
    : a.scope === 'clube' ? ['yellow', a.club_name ? `App · ${a.club_name}` : 'Do App para o clube'] : ORIGEM.geral);
/** As 6 cores para identificar cada coisa no calendário. */
export const CORES = [['verde', 'Verde', '#18875A'], ['azul', 'Azul', '#2563EB'], ['laranja', 'Laranja', '#EA7A12'], ['vermelho', 'Vermelho', '#DC2626'], ['roxo', 'Roxo', '#7C3AED'], ['preto', 'Preto', '#1F2937']];
const corDe = (a) => (CORES.find((c) => c[0] === a.color) || CORES[0])[2];
const inDay = (a, d) => (a.dates ? a.dates.includes(d) : a.date <= d && (a.end_date || a.date) >= d);
/** Todos os dias de um item (lista escolhida ou do dia tal ao dia tal). */
const daysOf = (a) => {
  if (a.dates?.length) return a.dates;
  const out = [];
  for (let d = new Date(a.date + 'T12:00:00Z'); out.length < 92; d = new Date(d.getTime() + 864e5)) {
    const iso = d.toISOString().slice(0, 10);
    if (iso > (a.end_date || a.date)) break;
    out.push(iso);
  }
  return out;
};
const isoAdd = (iso, n) => new Date(new Date(iso + 'T12:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);
/** "24, 25 e 26 de outubro" ou "30 de outubro a 2 de novembro". */
function diasTexto(days) {
  if (!days.length) return '';
  const seguidos = days.every((d, i) => i === 0 || isoAdd(days[i - 1], 1) === d);
  const dm = (d) => `${Number(d.slice(8, 10))} de ${MESES[Number(d.slice(5, 7)) - 1].toLowerCase()}`;
  if (days.length === 1) return dm(days[0]);
  if (seguidos && days.length > 3) return `${dm(days[0])} a ${dm(days[days.length - 1])}`;
  const sameMonth = days.every((d) => d.slice(0, 7) === days[0].slice(0, 7));
  if (sameMonth) return `${days.slice(0, -1).map((d) => Number(d.slice(8, 10))).join(', ')} e ${dm(days[days.length - 1])}`;
  return `${days.slice(0, -1).map(dm).join(', ')} e ${dm(days[days.length - 1])}`;
}

/** Calendário do mês com as datas marcadas. */
function MonthCalendar({ year, month, items, selected, onSelect }) {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  return (
    <div className="cal">
      {SEMANA.map((s, i) => <span key={'h' + i} className="cal-h">{s}</span>)}
      {cells.map((d, i) => {
        if (!d) return <span key={'e' + i} />;
        const iso = `${year}-${pad(month + 1)}-${pad(d)}`;
        const has = items.filter((a) => inDay(a, iso));
        return (
          <button type="button" key={iso} onClick={() => onSelect(selected === iso ? null : iso)}
            className={'cal-d' + (iso === today() ? ' today' : '') + (selected === iso ? ' sel' : '') + (has.length ? ' has' : '')}>
            {d}
            {has.length > 0 && <span className="cal-dots">{has.slice(0, 3).map((a) => <i key={a.id} style={{ background: corDe(a) }} />)}</span>}
          </button>
        );
      })}
    </div>
  );
}

function AgendaItem({ a, onEdit, onDelete }) {
  const [kind, label] = origemDe(a);
  return (
    <Card className="agenda-item" style={{ borderLeft: `6px solid ${corDe(a)}` }}>
      <div className="agenda-date"><b>{a.date.slice(8, 10)}</b><small>{MESES[Number(a.date.slice(5, 7)) - 1].slice(0, 3)}</small></div>
      <div className="grow">
        <div className="row between" style={{ alignItems: 'flex-start' }}><b className="ico"><i className="cor-dot" style={{ background: corDe(a) }} />{a.title}</b><Badge kind={kind}>{label}</Badge></div>
        <div className="small muted">
          {daysOf(a).length > 1 ? <span className="ico"><CalendarDays size={12} /> {daysOf(a).length} dias: {diasTexto(daysOf(a))}</span> : null}
          {a.time ? <span className="ico"><Clock size={12} /> {a.time}</span> : null}
          {a.location ? <span className="ico"><MapPin size={12} /> {a.location}</span> : null}
        </div>
        {a.description && <p className="small" style={{ margin: '.3rem 0 0', whiteSpace: 'pre-line' }}>{a.description}</p>}
        {(onEdit || onDelete) && (
          <div className="row wrap" style={{ gap: '.35rem', marginTop: '.4rem' }}>
            {onEdit && <Button small variant="secondary" onClick={() => onEdit(a)}>Editar</Button>}
            {onDelete && <Confirm text={`Apagar "${a.title}" da agenda?`} onYes={() => onDelete(a)}>Apagar</Confirm>}
          </div>
        )}
      </div>
    </Card>
  );
}

/** Formulário de um item da agenda (clube ou admin). */
/** Escolher os dias tocando no calendário: um, vários seguidos (acampamento, semana) ou soltos. */
function DayPicker({ value, onChange }) {
  const start = value[0] || today();
  const [ym, setYm] = useState([Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1]);
  const [y, m] = ym;
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const toggle = (iso) => onChange(value.includes(iso) ? value.filter((d) => d !== iso) : [...value, iso].sort());
  const move = (d) => setYm(([yy, mm]) => (mm + d < 0 ? [yy - 1, 11] : mm + d > 11 ? [yy + 1, 0] : [yy, mm + d]));
  const fill = () => {
    const out = [];
    for (let d = value[0]; d <= value[value.length - 1]; d = isoAdd(d, 1)) out.push(d);
    onChange(out);
  };
  const seguidos = value.every((d, i) => i === 0 || isoAdd(value[i - 1], 1) === d);
  return (
    <div className="day-picker">
      <div className="row between" style={{ marginBottom: '.3rem' }}>
        <button type="button" className="icon-btn light" onClick={() => move(-1)} aria-label="Mês anterior"><ChevronLeft size={18} /></button>
        <b>{MESES[m]} de {y}</b>
        <button type="button" className="icon-btn light" onClick={() => move(1)} aria-label="Próximo mês"><ChevronRight size={18} /></button>
      </div>
      <div className="cal">
        {SEMANA.map((s, i) => <span key={'h' + i} className="cal-h">{s}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={'e' + i} />;
          const iso = `${y}-${pad(m + 1)}-${pad(d)}`;
          return <button type="button" key={iso} onClick={() => toggle(iso)} className={'cal-d' + (iso === today() ? ' today' : '') + (value.includes(iso) ? ' sel' : '')}>{d}</button>;
        })}
      </div>
      <p className="small" style={{ margin: '.5rem 0 0' }}>
        {value.length ? <><b>{value.length} {value.length === 1 ? 'dia' : 'dias'}:</b> {diasTexto(value)}</> : <span className="muted">Toque nos dias. Pode escolher um dia, vários seguidos (acampamento, semana) ou dias soltos.</span>}
      </p>
      {value.length > 0 && (
        <div className="row wrap" style={{ gap: '.35rem', marginTop: '.4rem' }}>
          {value.length > 1 && !seguidos && <Button small variant="secondary" onClick={fill}>Preencher do {Number(value[0].slice(8, 10))} ao {Number(value[value.length - 1].slice(8, 10))}</Button>}
          <Button small variant="ghost" onClick={() => onChange([])}>Limpar</Button>
        </div>
      )}
    </div>
  );
}

/** Formulário de um item da agenda (clube ou admin). */
export function AgendaForm({ item, onClose, onSave, extra = null }) {
  const [f, setF] = useState({
    title: item?.title || '', dates: item?.date ? daysOf(item) : [today()], color: item?.color || 'verde', time: item?.time || '', location: item?.location || '', description: item?.description || '', ...(item?._extra || {}),
  });
  const [busy, run] = useAsync();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title={item?.id ? 'Editar na agenda' : 'Marcar na agenda'} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button busy={busy} disabled={!f.title.trim() || !f.dates.length} onClick={() => run(() => onSave(f), 'Agenda salva!').then(onClose)}>Salvar</Button></>}>
      <div className="form">
        <Field label="O que vai acontecer"><input value={f.title} onChange={set('title')} placeholder="Ex.: Reunião, acampamento, ordem unida" /></Field>
        <Field group label="Cor no calendário">
          <div className="cor-picker">
            {CORES.map(([k, nome, hex]) => (
              <button type="button" key={k} title={nome} aria-label={nome} className={f.color === k ? 'on' : ''} style={{ background: hex }} onClick={() => setF({ ...f, color: k })} />
            ))}
            <span className="small muted">{CORES.find((c) => c[0] === f.color)?.[1]}</span>
          </div>
        </Field>
        <Field group label="Dias"><DayPicker value={f.dates} onChange={(dates) => setF({ ...f, dates })} /></Field>
        <div className="grid2">
          <Field label="Horário (opcional)"><input type="time" value={f.time} onChange={set('time')} /></Field>
          <Field label="Local (opcional)"><input value={f.location} onChange={set('location')} /></Field>
        </div>
        <Field label="Observações (opcional)"><textarea value={f.description} onChange={set('description')} /></Field>
        {extra && extra(f, setF)}
      </div>
    </Modal>
  );
}

/** Lista de um mês com calendário; usada pelo clube (e pelo admin). */
export function AgendaView({ items, onEdit, onDelete, canEdit = () => true }) {
  const now = new Date();
  const [ym, setYm] = useState([now.getFullYear(), now.getMonth()]);
  const [sel, setSel] = useState(null);
  const [y, m] = ym;
  const prefix = `${y}-${pad(m + 1)}`;
  const monthEnd = `${prefix}-31`;
  const ofMonth = items.filter((a) => a.date <= monthEnd && (a.end_date || a.date) >= `${prefix}-01`);
  const shown = sel ? items.filter((a) => inDay(a, sel)) : ofMonth;
  const move = (d) => { setSel(null); setYm(([yy, mm]) => (mm + d < 0 ? [yy - 1, 11] : mm + d > 11 ? [yy + 1, 0] : [yy, mm + d])); };
  return (
    <>
      <Card>
        <div className="row between" style={{ marginBottom: '.4rem' }}>
          <button type="button" className="icon-btn light" onClick={() => move(-1)} aria-label="Mês anterior"><ChevronLeft size={18} /></button>
          <b>{MESES[m]} de {y}</b>
          <button type="button" className="icon-btn light" onClick={() => move(1)} aria-label="Próximo mês"><ChevronRight size={18} /></button>
        </div>
        <MonthCalendar year={y} month={m} items={items} selected={sel} onSelect={setSel} />
      </Card>
      <Section title={sel ? `Dia ${fmtDate(sel)}` : `Em ${MESES[m].toLowerCase()}`}>
        {shown.length ? shown.map((a) => (
          <AgendaItem key={a.id} a={a} onEdit={canEdit(a) ? onEdit : null} onDelete={canEdit(a) ? onDelete : null} />
        )) : <Empty icon={CalendarDays}>Nada marcado {sel ? 'neste dia' : 'neste mês'}.</Empty>}
      </Section>
    </>
  );
}

export function AgendaPage() {
  const state = useLoad(() => api.get('/agenda'));
  const [editing, setEditing] = useState(null);
  const [, run] = useAsync();
  const save = (f) => (editing?.id ? api.put('/club/agenda/' + editing.id, f) : api.post('/club/agenda', f)).then(state.reload);
  return (
    <>
      <PageHeader title="Agenda" subtitle="Reuniões, acampamentos e o que vem do App para o seu clube" action={<Button small onClick={() => setEditing({})}>+ Marcar</Button>} />
      <Loading {...state}>
        {(items) => (
          <AgendaView items={items} onEdit={setEditing} canEdit={(a) => a.creator_type === 'club'}
            onDelete={(a) => run(() => api.del('/club/agenda/' + a.id), 'Apagado da agenda').then(state.reload)} />
        )}
      </Loading>
      {editing && <AgendaForm item={editing} onClose={() => setEditing(null)} onSave={save} />}
    </>
  );
}

/** Agenda só para ver (desbravadores, liderança e unidades). */
export function AgendaLeitura() {
  const state = useLoad(() => api.get('/agenda'));
  return (
    <>
      <PageHeader title="Agenda" subtitle="Datas do seu clube e do App" />
      <Loading {...state}>{(items) => <AgendaView items={items} canEdit={() => false} />}</Loading>
    </>
  );
}

/** Próximas datas da agenda, para o painel do desbravador e da unidade. */
export function ProximasDatas({ to }) {
  const state = useLoad(() => api.get('/agenda'));
  const hoje = today();
  const prox = (state.data || []).filter((a) => (a.end_date || a.date) >= hoje).slice(0, 3);
  if (!prox.length) return null;
  return (
    <Section title="Próximas datas" action={<Link to={to} className="small ico">Ver agenda <ChevronRight size={14} /></Link>}>
      {prox.map((a) => <AgendaItem key={a.id} a={a} />)}
    </Section>
  );
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

// ---------- Biblioteca: especialidades e classes ----------
/** Escolher várias pessoas de uma vez (com "todos" e filtro por unidade). */
function PeopleSelect({ people, units, selected, onChange }) {
  const [q, setQ] = useState('');
  const [unit, setUnit] = useState('');
  const shown = people.filter((p) => (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase())) && (!unit || String(p.unit_id) === unit));
  const all = shown.length > 0 && shown.every((p) => selected.has(p.id));
  const toggle = (id) => { const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); onChange(n); };
  return (
    <>
      <div className="grid2">
        <input placeholder="Buscar pessoa" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={unit} onChange={(e) => setUnit(e.target.value)}>
          <option value="">Todos as unidades</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>
      <label className="row check-all"><input type="checkbox" checked={all} onChange={() => { const n = new Set(selected); shown.forEach((p) => (all ? n.delete(p.id) : n.add(p.id))); onChange(n); }} /> Selecionar todos ({shown.length})</label>
      <div className="list people-pick">
        {shown.map((p) => (
          <label key={p.id} className="list-item pick">
            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
            <Avatar src={p.photo} name={p.name} size={34} />
            <div className="grow"><div className="title">{p.name}</div><div className="sub">{p.age} anos</div></div>
          </label>
        ))}
      </div>
    </>
  );
}

/** Entregar especialidades ou classes para várias pessoas de uma vez. */
function Entregar({ type, people, units, onDone }) {
  const catalog = useLoad(() => api.get('/catalog?type=' + type), [type]);
  const [who, setWho] = useState(new Set());
  const [what, setWhat] = useState(new Set());
  const [step, setStep] = useState(1);
  const [busy, run] = useAsync();
  const label = type === 'classe' ? 'classe' : 'especialidade';
  const send = async () => {
    const r = await run(() => api.post('/club/biblioteca/entregar', { member_ids: [...who], content_ids: [...what] }), null);
    notify(`Pronto! ${r.added} entrega${r.added === 1 ? '' : 's'} registrada${r.added === 1 ? '' : 's'}. Já aparece no perfil.`);
    setWho(new Set()); setWhat(new Set()); setStep(1); onDone();
  };
  return (
    <Card>
      <div className="steps-head"><span className={step === 1 ? 'on' : ''}>1. Quem recebe</span><span className={step === 2 ? 'on' : ''}>2. {type === 'classe' ? 'Quais classes' : 'Quais especialidades'}</span></div>
      {step === 1 ? (
        <>
          <PeopleSelect people={people} units={units} selected={who} onChange={setWho} />
          <div className="mt"><Button block disabled={!who.size} onClick={() => setStep(2)}>Continuar ({who.size} {who.size === 1 ? 'pessoa' : 'pessoas'})</Button></div>
        </>
      ) : (
        <>
          <Loading {...catalog}>{(items) => <CatalogPicker type={type} items={items} selected={what} onChange={setWhat} />}</Loading>
          <div className="row between mt">
            <Button variant="secondary" onClick={() => setStep(1)}><ChevronLeft size={16} /> Voltar</Button>
            <Button busy={busy} disabled={!what.size} onClick={send}>Entregar {what.size} {label}{what.size === 1 ? '' : 's'} para {who.size}</Button>
          </div>
        </>
      )}
    </Card>
  );
}

/** Quem tem especialidades (ou classes), a quantidade, e o certificado de cada uma. */
function QuemTem({ list, kind }) {
  const [open, setOpen] = useState(null);
  const [q, setQ] = useState('');
  const rows = list.filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => b[kind].length - a[kind].length || a.name.localeCompare(b.name, 'pt-BR'));
  const word = kind === 'guias' ? ['classe', 'classes'] : ['especialidade', 'especialidades'];
  return (
    <>
      <div className="search-box"><Search size={16} /><input placeholder="Buscar pessoa" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="list mt">
        {rows.map((p) => (
          <button type="button" key={p.id} className="list-item" onClick={() => setOpen(p)} disabled={!p[kind].length}>
            <Avatar src={p.photo} name={p.name} size={42} />
            <div className="grow"><div className="title">{p.name}</div><div className="sub">{p.age} anos</div></div>
            <Badge kind={p[kind].length ? 'green' : ''}>{p[kind].length} {p[kind].length === 1 ? word[0] : word[1]}</Badge>
          </button>
        ))}
      </div>
      {open && (
        <Modal title={`${word[1][0].toUpperCase() + word[1].slice(1)} · ${open.name}`} onClose={() => setOpen(null)}>
          <div className="list">
            {open[kind].map((c) => (
              <div key={c.id} className="list-item">
                <span className="ach-img"><ContentIcon c={c} size={20} /></span>
                <div className="grow"><div className="title">{c.name}</div><div className="sub">Desde {fmtDate(c.date)}</div></div>
                <Link to={`/clube/certificado/${open.id}/${c.id}`}><Button small variant="secondary"><Printer size={14} /> Certificado</Button></Link>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}

export function BibliotecaPage({ approvals }) {
  const state = useLoad(() => api.get('/club/biblioteca'));
  const units = useLoad(() => api.get('/club/units'));
  const [tab, setTab] = useState('insignias');
  return (
    <>
      <PageHeader title="Biblioteca" subtitle="Especialidades e classes do clube" />
      <Tabs tabs={[['insignias', 'Especialidades'], ['guias', 'Classes'], ['entregar', 'Entregar'], ['pedidos', 'Pedidos']]} value={tab} onChange={setTab} />
      {tab === 'pedidos' ? approvals : (
        <Loading {...state}>
          {(list) => (
            tab === 'entregar' ? (
              <EntregarTabs people={list} units={(units.data || []).filter((u) => !u.is_leadership)} onDone={state.reload} />
            ) : <QuemTem list={list} kind={tab} />
          )}
        </Loading>
      )}
    </>
  );
}

function EntregarTabs({ people, units, onDone }) {
  const [type, setType] = useState('especialidade');
  return (
    <>
      <div className="seg" role="tablist" style={{ marginBottom: '.7rem' }}>
        <button type="button" className={type === 'especialidade' ? 'active' : ''} onClick={() => setType('especialidade')}>Especialidades</button>
        <button type="button" className={type === 'classe' ? 'active' : ''} onClick={() => setType('classe')}>Classes</button>
      </div>
      <Entregar key={type} type={type} people={people} units={units} onDone={onDone} />
    </>
  );
}

/** Certificado gerado automaticamente (para imprimir ou salvar em PDF). */
export function CertificadoPage() {
  const { mid, cid } = useParams();
  const state = useLoad(() => api.get(`/club/certificado/${mid}/${cid}`), [mid, cid]);
  return (
    <div className="cert-page">
      <div className="cert-tools no-print">
        <Link to="/clube/biblioteca"><Button variant="secondary" small><ChevronLeft size={14} /> Voltar</Button></Link>
        <Button small onClick={() => window.print()}><Printer size={14} /> Imprimir / salvar PDF</Button>
      </div>
      <Loading {...state}>
        {(c) => (
          <div className="cert">
            <div className="cert-logos">
              <img src="/marca/logo.png" alt="App do DBV" />
              {c.club_logo && <img src={c.club_logo} alt={c.club_name} />}
            </div>
            <p className="cert-kicker">App do DBV · {c.club_name}</p>
            <h1>Certificado</h1>
            <p className="cert-text">Certificamos que</p>
            <p className="cert-name">{c.member_name}</p>
            <p className="cert-text">concluiu {c.type === 'classe' ? 'a classe' : 'a especialidade'}</p>
            <p className="cert-item"><span className="ach-img"><ContentIcon c={c} size={22} /></span> {c.content_name}</p>
            <p className="cert-text">em {fmtDate(c.date)}.</p>
            <div className="cert-sign">
              <div><span />{c.director_name || 'Diretor(a) do clube'}<small>Diretor(a)</small></div>
            </div>
          </div>
        )}
      </Loading>
    </div>
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
                  <Link key={m.id} to={`${base}/ver/membro/${m.code}`} className="list-item">
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
