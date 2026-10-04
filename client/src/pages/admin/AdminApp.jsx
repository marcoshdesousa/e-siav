import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  CalendarDays, ClipboardCheck, Flag, House, Inbox, Library, Map, Medal, Menu, Plus, ShieldAlert, ShoppingCart, Tent, Trash2, Trophy, UserRound, Users,
} from 'lucide-react';
import { api, toForm } from '../../api.js';
import { AppIcon, CONTENT_ICON_KEYS, IconPicker, MEDAL_ICON_KEYS } from '../../icons.jsx';
import { useAuth } from '../../auth.jsx';
import { fmtDate, fmtDateTime, fmtMoney, plural } from '../../format.js';
import {
  Avatar, Badge, Button, Card, Confirm, Empty, Field, Loading, MedalIcon, Modal, PageHeader, Section, Stat, Tabs, useAsync, useLoad,
} from '../../ui.jsx';
import Shell, { MoreMenu } from '../Shell.jsx';
import { InAppProfile } from '../Profiles.jsx';
import { CreatedRequirements, ReviewsPanel } from '../Requirements.jsx';
import RankingHub from '../Ranking.jsx';
import ClubsBrowser from '../Clubs.jsx';
import { ReportsPanel } from '../Chat.jsx';

const base = '/admin';

function AdminHome() {
  const { actor } = useAuth();
  const state = useLoad(() => api.get('/admin/overview'));
  return (
    <>
      <div className="hero">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p className="muted small">Painel do</p>
          <h1>Administrador Geral</h1>
          <p className="muted">Olá, {actor.name}! Você cuida de toda a plataforma.</p>
        </div>
      </div>
      <Loading {...state}>
        {(o) => (
          <Section title="Visão geral">
            <div className="stats">
              <Stat icon={Map} value={o.districts} label="Distritos" to={`${base}/clubes`} />
              <Stat icon={Tent} value={o.clubs} label="Clubes" to={`${base}/clubes`} />
              <Stat icon={Flag} value={o.units} label="Unidades" />
              <Stat icon={Users} value={o.members} label="Membros" />
              <Stat icon={ClipboardCheck} value={o.requirements} label="Requisitos gerais" to={`${base}/requisitos`} />
              <Stat icon={Inbox} value={o.pending_reviews} label="Envios p/ avaliar" to={`${base}/requisitos?aba=avaliar`} accent={o.pending_reviews > 0} />
              <Stat icon={ShoppingCart} value={o.pending_purchases} label="Compras pendentes" to={`${base}/conteudo?aba=compras`} accent={o.pending_purchases > 0} />
              <Stat icon={ShieldAlert} value={o.open_reports} label="Denúncias abertas" to={`${base}/denuncias`} accent={o.open_reports > 0} />
            </div>
          </Section>
        )}
      </Loading>
      <Section title="Atalhos">
        <MoreMenu items={[
          { to: `${base}/medalhas`, icon: Medal, label: 'Medalhas e troféus' },
          { to: `${base}/eventos`, icon: CalendarDays, label: 'Eventos' },
          { to: `${base}/ranking`, icon: Trophy, label: 'Rankings' },
          { to: `${base}/explorar`, icon: Map, label: 'Explorar clubes' },
        ]} />
      </Section>
      <p className="muted small mt center">Os dados pessoais dos membros são editados somente pelo clube de cada um.</p>
    </>
  );
}

// ---------- Distritos, clubes e administradores ----------
function NameLoginForm({ title, item, withDistrict, districts, onClose, onSave }) {
  const [f, setF] = useState({ name: item?.name || '', district_id: item?.district_id || districts?.[0]?.id || '', username: item?.username || '', password: '' });
  const [busy, run] = useAsync();
  return (
    <Modal title={title} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button busy={busy} onClick={() => run(() => onSave(f), 'Salvo!').then(onClose)}>Salvar</Button></>}>
      <div className="form">
        <Field label="Nome"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        {withDistrict && (
          <Field label="Distrito">
            <select value={f.district_id} onChange={(e) => setF({ ...f, district_id: e.target.value })}>
              {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        )}
        <div className="grid2">
          <Field label="Usuário"><input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoCapitalize="none" /></Field>
          <Field label={item ? 'Nova senha' : 'Senha'} hint={item ? 'Em branco mantém' : 'Mínimo 6 caracteres'}><input value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        </div>
      </div>
    </Modal>
  );
}

function ClubsAdmin() {
  const { refreshMeta } = useAuth();
  const [tab, setTab] = useState('clubes');
  const districts = useLoad(() => api.get('/admin/districts'));
  const clubs = useLoad(() => api.get('/admin/clubs'));
  const admins = useLoad(() => api.get('/admin/admins'));
  const [modal, setModal] = useState(null);
  const [newDistrict, setNewDistrict] = useState('');
  const [busy, run] = useAsync();

  const addDistrict = async () => {
    await run(() => api.post('/admin/districts', { name: newDistrict }), 'Distrito cadastrado!');
    setNewDistrict('');
    districts.reload();
    refreshMeta();
  };
  const renameDistrict = async (d) => {
    const name = prompt('Novo nome do distrito', d.name);
    if (!name) return;
    await run(() => api.put('/admin/districts/' + d.id, { name }), 'Distrito atualizado');
    districts.reload();
    refreshMeta();
  };

  return (
    <>
      <PageHeader title="Clubes e acessos" />
      <Tabs tabs={[['clubes', 'Clubes'], ['distritos', 'Distritos'], ['admins', 'Administradores']]} value={tab} onChange={setTab} />
      {tab === 'distritos' && (
        <>
          <Card>
            <div className="row">
              <input placeholder="Nome do novo distrito" value={newDistrict} onChange={(e) => setNewDistrict(e.target.value)} />
              <Button busy={busy} onClick={addDistrict}>Adicionar</Button>
            </div>
          </Card>
          <div className="list mt">
            <Loading {...districts}>
              {(list) => list.map((d) => (
                <div key={d.id} className="list-item">
                  <span className="trophy-bg"><Map size={22} /></span>
                  <div className="grow"><div className="title">{d.name}</div><div className="sub">{plural(d.club_count, 'clube', 'clubes')}</div></div>
                  <Button small variant="secondary" onClick={() => renameDistrict(d)}>Renomear</Button>
                </div>
              ))}
            </Loading>
          </div>
        </>
      )}
      {tab === 'clubes' && (
        <>
          <Button block onClick={() => setModal({ kind: 'club' })}>+ Novo clube</Button>
          <div className="list mt">
            <Loading {...clubs} empty="Nenhum clube cadastrado.">
              {(list) => list.map((c) => (
                <div key={c.id} className="list-item">
                  <Avatar src={c.logo} name={c.name} size={48} square />
                  <div className="grow">
                    <div className="title">{c.name}</div>
                    <div className="sub">{c.district_name} · {plural(c.unit_count, 'unidade', 'unidades')} · {plural(c.member_count, 'membro', 'membros')}</div>
                    <div className="sub">Login do Sistema do Clube: <b>@{c.username}</b></div>
                  </div>
                  <Button small variant="secondary" onClick={() => setModal({ kind: 'club', item: c })}>Editar</Button>
                </div>
              ))}
            </Loading>
          </div>
        </>
      )}
      {tab === 'admins' && (
        <>
          <Button block onClick={() => setModal({ kind: 'admin' })}>+ Novo administrador</Button>
          <div className="list mt">
            <Loading {...admins}>
              {(list) => list.map((a) => (
                <div key={a.id} className="list-item">
                  <Avatar name={a.name} size={42} />
                  <div className="grow"><div className="title">{a.name}</div><div className="sub">@{a.username}</div></div>
                  <Button small variant="secondary" onClick={() => setModal({ kind: 'admin', item: a })}>Editar</Button>
                </div>
              ))}
            </Loading>
          </div>
        </>
      )}
      {modal?.kind === 'club' && (
        <NameLoginForm
          title={modal.item ? 'Editar clube' : 'Novo clube'} item={modal.item} withDistrict districts={districts.data || []}
          onClose={() => setModal(null)}
          onSave={(f) => (modal.item ? api.put('/admin/clubs/' + modal.item.id, f) : api.post('/admin/clubs', f)).then(() => { clubs.reload(); districts.reload(); })}
        />
      )}
      {modal?.kind === 'admin' && (
        <NameLoginForm
          title={modal.item ? 'Editar administrador' : 'Novo administrador'} item={modal.item}
          onClose={() => setModal(null)}
          onSave={(f) => (modal.item ? api.put('/admin/admins/' + modal.item.id, f) : api.post('/admin/admins', f)).then(admins.reload)}
        />
      )}
    </>
  );
}

function RequirementsAdmin() {
  const [tab, setTab] = useState(new URLSearchParams(location.search).get('aba') || 'criados');
  return (
    <>
      <PageHeader title="Requisitos gerais" subtitle="Para clubes, unidades e desbravadores" />
      <Tabs tabs={[['criados', 'Criados'], ['avaliar', 'Avaliar envios']]} value={tab} onChange={setTab} />
      {tab === 'criados' ? <CreatedRequirements /> : <ReviewsPanel />}
    </>
  );
}

// ---------- Conteúdo ----------
const TYPE_LABEL = { especialidade: 'Especialidade', classe: 'Classe', curso: 'Curso' };

function ContentForm({ id, type, onClose, onDone }) {
  const existing = useLoad(() => (id ? api.get('/admin/content/' + id) : Promise.resolve(null)), [id]);
  const [f, setF] = useState(null);
  const [busy, run] = useAsync();
  useEffect(() => {
    if (existing.loading) return;
    const c = existing.data;
    setF(c
      ? { ...c, is_free: !!c.is_free, leader: !!c.leader, price: c.price_cents ? (c.price_cents / 100).toFixed(2).replace('.', ',') : '', age: c.age ?? '', items: c.items }
      : { type, name: '', description: '', icon: type === 'curso' ? 'graduation' : type === 'classe' ? 'compass' : 'knot', category: '', age: '', leader: false, is_free: true, price: '', items: [{ title: '', body: '' }] });
  }, [existing.loading, existing.data, type]);
  if (!f) return null;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const updItem = (i, patch) => setF({ ...f, items: f.items.map((it, k) => (k === i ? { ...it, ...patch } : it)) });
  const itemLabel = f.type === 'curso' ? 'Aula' : f.type === 'classe' ? 'Requisito' : 'Atividade';
  const save = async () => {
    await run(() => (id ? api.put('/admin/content/' + id, f) : api.post('/admin/content', f)), 'Salvo!');
    onDone();
  };
  return (
    <Modal title={(id ? 'Editar ' : 'Nova ') + TYPE_LABEL[f.type].toLowerCase()} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button busy={busy} onClick={save}>Salvar</Button></>}>
      <div className="form">
        <Field label="Nome"><input value={f.name} onChange={set('name')} /></Field>
        <Field label="Ícone"><IconPicker keys={CONTENT_ICON_KEYS} value={f.icon} onChange={(icon) => setF({ ...f, icon })} /></Field>
        <Field label="Descrição"><textarea value={f.description} onChange={set('description')} /></Field>
        {f.type === 'especialidade' && <Field label="Categoria"><input value={f.category} onChange={set('category')} /></Field>}
        {f.type === 'classe' && (
          <div className="grid2">
            <label className="check"><input type="checkbox" checked={f.leader} onChange={set('leader')} /> Classe de líder</label>
            {!f.leader && <Field label="Idade"><input type="number" min="10" max="15" value={f.age} onChange={set('age')} /></Field>}
          </div>
        )}
        <div className="grid2">
          <label className="check"><input type="checkbox" checked={f.is_free} onChange={set('is_free')} /> Grátis</label>
          {!f.is_free && <Field label="Preço (R$)"><input inputMode="decimal" value={f.price} onChange={set('price')} placeholder="19,90" /></Field>}
        </div>
        <Section title={itemLabel + 's'}>
          <div className="stack">
            {f.items.map((it, i) => (
              <div key={i} className="quiz-q stack">
                <div className="row between"><b>{itemLabel} {i + 1}</b><button type="button" className="icon-btn" onClick={() => setF({ ...f, items: f.items.filter((_, k) => k !== i) })}><Trash2 size={18} /></button></div>
                <input placeholder="Título" value={it.title} onChange={(e) => updItem(i, { title: e.target.value })} />
                <textarea placeholder="Conteúdo / instruções" value={it.body} onChange={(e) => updItem(i, { body: e.target.value })} />
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={() => setF({ ...f, items: [...f.items, { title: '', body: '' }] })}>+ {itemLabel}</Button>
          </div>
        </Section>
      </div>
    </Modal>
  );
}

function PurchasesAdmin() {
  const purchases = useLoad(() => api.get('/admin/purchases'));
  const access = useLoad(() => api.get('/admin/access'));
  const content = useLoad(() => api.get('/admin/content'));
  const [grant, setGrant] = useState({ member_code: '', content_id: '' });
  const [busy, run] = useAsync();
  const reload = () => { purchases.reload(); access.reload(); };
  const paid = (content.data || []).filter((c) => !c.is_free);
  return (
    <>
      <Card>
        <h3>Liberar item manualmente</h3>
        <p className="muted small">Libera um item pago para um membro sem compra (ex.: bolsa, pagamento por fora).</p>
        <div className="form mt">
          <Field label="Código do membro"><input placeholder="DBV-XXXXX" value={grant.member_code} onChange={(e) => setGrant({ ...grant, member_code: e.target.value })} /></Field>
          <Field label="Item">
            <select value={grant.content_id} onChange={(e) => setGrant({ ...grant, content_id: e.target.value })}>
              <option value="">Escolha...</option>
              {paid.map((c) => <option key={c.id} value={c.id}>{c.name} · {fmtMoney(c.price_cents)}</option>)}
            </select>
          </Field>
          <Button busy={busy} onClick={() => run(() => api.post('/admin/access', grant), 'Acesso liberado!').then(() => { setGrant({ member_code: '', content_id: '' }); reload(); })}>Liberar acesso</Button>
        </div>
      </Card>
      <Section title="Pedidos de compra">
        <p className="muted small">O meio de pagamento será definido depois. Por enquanto, confirme o pagamento aqui para liberar o acesso.</p>
        <Loading {...purchases} empty="Nenhum pedido.">
          {(list) => list.map((p) => (
            <div key={p.id} className="list-item" style={{ marginBottom: '.5rem' }}>
              <span className="content-icon"><AppIcon name={p.icon} size={24} /></span>
              <div className="grow">
                <div className="title">{p.content_name}</div>
                <div className="sub">{p.member_name} ({p.member_code}) · {p.club_name}</div>
                <div className="sub">{fmtMoney(p.price_cents)} · {fmtDateTime(p.created_at)}</div>
              </div>
              {p.status === 'pendente' ? (
                <div className="stack" style={{ gap: '.3rem' }}>
                  <Button small variant="green" onClick={() => run(() => api.post(`/admin/purchases/${p.id}/confirm`), 'Pagamento confirmado').then(reload)}>Confirmar</Button>
                  <Button small variant="danger" onClick={() => run(() => api.post(`/admin/purchases/${p.id}/cancel`), 'Pedido cancelado').then(reload)}>Cancelar</Button>
                </div>
              ) : <Badge kind={p.status === 'pago' ? 'green' : 'neutral'}>{p.status}</Badge>}
            </div>
          ))}
        </Loading>
      </Section>
      <Section title="Acessos liberados">
        <Loading {...access} empty="Nenhum acesso liberado.">
          {(list) => list.map((a) => (
            <div key={a.member_id + '-' + a.content_id} className="list-item" style={{ marginBottom: '.5rem' }}>
              <span className="content-icon"><AppIcon name={a.icon} size={24} /></span>
              <div className="grow"><div className="title">{a.content_name}</div><div className="sub">{a.member_name} ({a.member_code}) · {a.source === 'admin' ? 'liberado pelo admin' : 'compra'}</div></div>
              <Confirm text="Remover este acesso?" onYes={() => run(() => api.del(`/admin/access/${a.member_id}/${a.content_id}`), 'Acesso removido').then(reload)}>Remover</Confirm>
            </div>
          ))}
        </Loading>
      </Section>
    </>
  );
}

function ContentAdmin() {
  const [tab, setTab] = useState(new URLSearchParams(location.search).get('aba') || 'especialidade');
  const list = useLoad(() => (tab === 'compras' ? Promise.resolve([]) : api.get('/admin/content?type=' + tab)), [tab]);
  const [editing, setEditing] = useState(null);
  const [, run] = useAsync();
  return (
    <>
      <PageHeader title="Conteúdo" subtitle="Especialidades, classes e cursos (grátis ou pagos)" />
      <Tabs tabs={[['especialidade', 'Especialidades'], ['classe', 'Classes'], ['curso', 'Cursos'], ['compras', 'Compras']]} value={tab} onChange={setTab} />
      {tab === 'compras' ? <PurchasesAdmin /> : (
        <>
          <Button block onClick={() => setEditing({ id: null })}>+ Nova {TYPE_LABEL[tab].toLowerCase()}</Button>
          <div className="list mt">
            <Loading {...list} empty="Nada cadastrado ainda.">
              {(items) => items.map((c) => (
                <div key={c.id} className="list-item">
                  <span className="content-icon"><AppIcon name={c.icon} size={24} /></span>
                  <div className="grow">
                    <div className="title">{c.name}</div>
                    <div className="sub">
                      {c.type === 'classe' ? (c.leader ? 'Líder · ' : `${c.age} anos · `) : ''}{c.items_count} itens · {c.is_free ? 'Grátis' : fmtMoney(c.price_cents)}
                    </div>
                  </div>
                  <div className="stack" style={{ gap: '.3rem' }}>
                    <Button small variant="secondary" onClick={() => setEditing({ id: c.id })}>Editar</Button>
                    <Confirm text={`Excluir "${c.name}"?`} onYes={() => run(() => api.del('/admin/content/' + c.id), 'Excluído').then(list.reload)}>Excluir</Confirm>
                  </div>
                </div>
              ))}
            </Loading>
          </div>
        </>
      )}
      {editing && <ContentForm id={editing.id} type={tab} onClose={() => setEditing(null)} onDone={() => { setEditing(null); list.reload(); }} />}
    </>
  );
}

// ---------- Destinatários (medalhas e eventos) ----------
function TargetPicker({ types, onPick }) {
  const [type, setType] = useState(types[0][0]);
  const [q, setQ] = useState('');
  const results = useLoad(() => api.get(`/admin/targets?type=${type}&q=${encodeURIComponent(q)}`), [type, q]);
  return (
    <div className="stack">
      <div className="grid2">
        <select value={type} onChange={(e) => setType(e.target.value)}>{types.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <input placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="list" style={{ maxHeight: 280, overflowY: 'auto' }}>
        <Loading {...results} empty="Nada encontrado.">
          {(list) => list.map((t) => (
            <button key={t.id} className="list-item" style={{ border: '1px solid var(--line)', font: 'inherit', textAlign: 'left', cursor: 'pointer' }} onClick={() => onPick(type, t)}>
              <Avatar src={t.photo || t.logo} name={t.name} size={36} square={type !== 'member'} />
              <div className="grow"><div className="title">{t.name}</div><div className="sub">{t.sub}</div></div>
              <Plus className="chev" size={20} />
            </button>
          ))}
        </Loading>
      </div>
    </div>
  );
}


function MedalsAdmin() {
  const state = useLoad(() => api.get('/admin/medals'));
  const [creating, setCreating] = useState(false);
  const [awarding, setAwarding] = useState(null);
  const [f, setF] = useState({ kind: 'medalha', name: '', description: '', icon: 'medal', icon_file: null });
  const [busy, run] = useAsync();
  const awards = useLoad(() => (awarding ? api.get(`/admin/medals/${awarding.id}/awards`) : Promise.resolve([])), [awarding?.id]);
  const [note, setNote] = useState('');
  const create = async () => {
    await run(() => api.post('/admin/medals', toForm(f)), 'Criado!');
    setCreating(false);
    setF({ kind: 'medalha', name: '', description: '', icon: 'medal', icon_file: null });
    state.reload();
  };
  const award = async (type, t) => {
    if (!confirm(`Entregar "${awarding.name}" para ${t.name}?`)) return;
    await run(() => api.post(`/admin/medals/${awarding.id}/award`, { target_type: type, target_id: t.id, note }), 'Entregue!');
    awards.reload();
    state.reload();
  };
  return (
    <>
      <PageHeader title="Medalhas e troféus" subtitle="A entrega é sempre manual" action={<Button small onClick={() => setCreating(true)}>+ Criar</Button>} />
      <Loading {...state} empty="Nenhuma medalha criada.">
        {(list) => (
          <div className="list">
            {list.map((m) => (
              <div key={m.id} className="list-item">
                <span className="medal-icon" style={{ width: 52, height: 52 }}><MedalIcon icon={m.icon} size={34} /></span>
                <div className="grow">
                  <div className="title">{m.name}</div>
                  <div className="sub">{m.kind === 'trofeu' ? 'Troféu' : 'Medalha'} · entregue {plural(m.award_count, 'vez', 'vezes')}</div>
                  {m.description && <div className="sub">{m.description}</div>}
                </div>
                <div className="stack" style={{ gap: '.3rem' }}>
                  <Button small variant="yellow" onClick={() => { setNote(''); setAwarding(m); }}>Entregar</Button>
                  <Confirm text="Excluir? Também remove das pessoas e clubes que receberam." onYes={() => run(() => api.del('/admin/medals/' + m.id), 'Excluída').then(state.reload)}>Excluir</Confirm>
                </div>
              </div>
            ))}
          </div>
        )}
      </Loading>
      {creating && (
        <Modal title="Nova medalha ou troféu" onClose={() => setCreating(false)} footer={<Button busy={busy} onClick={create}>Criar</Button>}>
          <div className="form">
            <Tabs tabs={[['medalha', 'Medalha'], ['trofeu', 'Troféu']]} value={f.kind} onChange={(kind) => setF({ ...f, kind, icon: kind === 'trofeu' ? 'trophy' : 'medal' })} />
            <Field label="Nome" hint="Ex.: Melhor clube do mês"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Descrição"><textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
            <Field label="Ícone">
              <IconPicker keys={MEDAL_ICON_KEYS} value={f.icon_file ? null : f.icon} onChange={(icon) => setF({ ...f, icon, icon_file: null })} />
            </Field>
            <Field label="ou envie uma imagem"><input type="file" accept="image/*" onChange={(e) => setF({ ...f, icon_file: e.target.files[0] || null })} /></Field>
          </div>
        </Modal>
      )}
      {awarding && (
        <Modal title={`Entregar: ${awarding.name}`} onClose={() => setAwarding(null)}>
          <div className="form">
            <Field label="Observação (opcional)" hint="Ex.: Setembro de 2026"><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            <TargetPicker types={[['club', 'Clube'], ['unit', 'Unidade'], ['member', 'Membro']]} onPick={award} />
            <Section title="Já receberam">
              <Loading {...awards} empty="Ninguém ainda.">
                {(list) => list.map((a) => (
                  <div key={a.id} className="row between small" style={{ padding: '.3rem 0' }}>
                    <span>{a.target_name}{a.note ? ` — ${a.note}` : ''}</span>
                    <Confirm text="Retirar esta entrega?" onYes={() => run(() => api.del('/admin/awards/' + a.id), 'Retirada').then(awards.reload)}>Retirar</Confirm>
                  </div>
                ))}
              </Loading>
            </Section>
          </div>
        </Modal>
      )}
    </>
  );
}

function EventsAdmin() {
  const { meta } = useAuth();
  const state = useLoad(() => api.get('/admin/events'));
  const [editing, setEditing] = useState(null);
  const [participants, setParticipants] = useState(null);
  const [busy, run] = useAsync();
  const save = async () => {
    await run(() => (editing.id ? api.put('/admin/events/' + editing.id, editing) : api.post('/admin/events', editing)), 'Evento salvo!');
    setEditing(null);
    state.reload();
  };
  const current = participants && state.data?.find((e) => e.id === participants);
  return (
    <>
      <PageHeader title="Eventos" subtitle="Cadastre e marque quem participou" action={<Button small onClick={() => setEditing({ name: '', date: new Date().toISOString().slice(0, 10), location: '', description: '', district_id: meta.districts[0]?.id || '' })}>+ Novo</Button>} />
      <Loading {...state} empty="Nenhum evento.">
        {(list) => list.map((e) => (
          <Card key={e.id}>
            <div className="row between"><h3 className="ico"><CalendarDays size={18} /> {e.name}</h3><span className="small muted">{fmtDate(e.date)}</span></div>
            <p className="small muted">{e.location}{e.district_name ? ' · ' + e.district_name : ''}</p>
            {e.description && <p className="small">{e.description}</p>}
            <p className="small"><b>{e.participants.filter((p) => p.target_type === 'club').length}</b> clubes · <b>{e.participants.filter((p) => p.target_type === 'member').length}</b> membros</p>
            <div className="row wrap">
              <Button small variant="yellow" onClick={() => setParticipants(e.id)}>Participantes</Button>
              <Button small variant="secondary" onClick={() => setEditing(e)}>Editar</Button>
              <Confirm text="Excluir evento?" onYes={() => run(() => api.del('/admin/events/' + e.id), 'Excluído').then(state.reload)}>Excluir</Confirm>
            </div>
          </Card>
        ))}
      </Loading>
      {editing && (
        <Modal title={editing.id ? 'Editar evento' : 'Novo evento'} onClose={() => setEditing(null)} footer={<Button busy={busy} onClick={save}>Salvar</Button>}>
          <div className="form">
            <Field label="Nome" hint="Ex.: Acampamento do distrito"><input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <div className="grid2">
              <Field label="Data"><input type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} /></Field>
              <Field label="Distrito">
                <select value={editing.district_id || ''} onChange={(e) => setEditing({ ...editing, district_id: e.target.value })}>
                  <option value="">Todos</option>
                  {meta.districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Local"><input value={editing.location} onChange={(e) => setEditing({ ...editing, location: e.target.value })} /></Field>
            <Field label="Descrição"><textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
      {current && (
        <Modal title={`Participantes · ${current.name}`} onClose={() => setParticipants(null)}>
          <div className="form">
            <TargetPicker types={[['club', 'Clube'], ['member', 'Membro']]} onPick={(type, t) => run(() => api.post(`/admin/events/${current.id}/participants`, { target_type: type, target_id: t.id }), 'Participante marcado').then(state.reload)} />
            <Section title="Participaram">
              {current.participants.length ? current.participants.map((p) => (
                <div key={p.target_type + p.target_id} className="row between small" style={{ padding: '.3rem 0' }}>
                  <span className="ico">{p.target_type === 'club' ? <Tent size={15} /> : <UserRound size={15} />} {p.name}</span>
                  <Confirm text="Remover participante?" onYes={() => run(() => api.del(`/admin/events/${current.id}/participants/${p.target_type}/${p.target_id}`), 'Removido').then(state.reload)}>Remover</Confirm>
                </div>
              )) : <Empty>Ninguém marcado ainda.</Empty>}
            </Section>
          </div>
        </Modal>
      )}
    </>
  );
}

/** Painel do Administrador Geral. */
export default function AdminApp() {
  const tabs = [
    { to: base, icon: House, label: 'Início', end: true },
    { to: `${base}/clubes`, icon: Tent, label: 'Clubes' },
    { to: `${base}/requisitos`, icon: ClipboardCheck, label: 'Requisitos' },
    { to: `${base}/conteudo`, icon: Library, label: 'Conteúdo' },
    { to: `${base}/mais`, icon: Menu, label: 'Mais' },
  ];
  const more = [
    { to: `${base}/medalhas`, icon: Medal, label: 'Medalhas e troféus', hint: 'Criar e entregar' },
    { to: `${base}/eventos`, icon: CalendarDays, label: 'Eventos', hint: 'Participantes' },
    { to: `${base}/ranking`, icon: Trophy, label: 'Rankings', hint: 'Todas as tabelas' },
    { to: `${base}/denuncias`, icon: ShieldAlert, label: 'Denúncias', hint: 'Do chat' },
    { to: `${base}/explorar`, icon: Map, label: 'Explorar clubes', hint: 'Perfis públicos' },
  ];
  return (
    <Shell tabs={tabs}>
      <Routes>
        <Route index element={<AdminHome />} />
        <Route path="clubes" element={<ClubsAdmin />} />
        <Route path="requisitos" element={<RequirementsAdmin />} />
        <Route path="conteudo" element={<ContentAdmin />} />
        <Route path="medalhas" element={<MedalsAdmin />} />
        <Route path="eventos" element={<EventsAdmin />} />
        <Route path="ranking" element={<RankingHub base={base} />} />
        <Route path="denuncias" element={<ReportsPanel />} />
        <Route path="explorar" element={<ClubsBrowser base={base} />} />
        <Route path="ver/:kind/:id" element={<InAppProfile base={base} />} />
        <Route path="mais" element={<><PageHeader title="Mais" /><MoreMenu items={more} /></>} />
        <Route path="*" element={<Navigate to={base} replace />} />
      </Routes>
    </Shell>
  );
}
