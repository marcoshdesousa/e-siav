import { useState } from 'react';
import { CalendarDays, FileText, MapPin, Megaphone, Paperclip, Pencil, Tent, Trash2, UserRound, Users, X } from 'lucide-react';
import { api, toForm } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { fmtDate } from '../../format.js';
import { Badge, Button, Card, Confirm, Empty, Field, Loading, Modal, PageHeader, Section, Tabs, notify, useAsync, useLoad } from '../../ui.jsx';
import PeoplePicker, { emptySelection } from './PeoplePicker.jsx';

const blank = (districtId) => ({ name: '', date: new Date().toISOString().slice(0, 10), location: '', description: '', district_id: districtId || '', attachments: [], promote: true });

/** Anexos (fotos e PDF) para ilustrar o evento. */
export function Attachments({ list }) {
  if (!list?.length) return null;
  return (
    <div className="attachments">
      {list.map((a) => (a.type === 'pdf' ? (
        <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="attach-pdf"><FileText size={20} /> <span className="ellipsis">{a.name}</span></a>
      ) : (
        <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="attach-img"><img src={a.url} alt={a.name} /></a>
      )))}
    </div>
  );
}

function EventForm({ initial, onDone, onCancel }) {
  const { meta } = useAuth();
  const [f, setF] = useState(initial);
  const [files, setFiles] = useState([]);
  const [busy, run] = useAsync();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    const body = toForm({
      name: f.name, date: f.date, location: f.location, description: f.description, district_id: f.district_id, promote: f.promote ? 1 : 0,
      keep: f.attachments.map((a) => a.url), files,
    });
    await run(() => (f.id ? api.put('/admin/events/' + f.id, body) : api.post('/admin/events', body)), f.id ? 'Evento atualizado!' : 'Evento criado!');
    setFiles([]);
    onDone();
  };
  return (
    <div className="form">
      <Field label="Nome do evento" hint="Ex.: Acampamento do distrito"><input value={f.name} onChange={set('name')} /></Field>
      <div className="grid2">
        <Field label="Data"><input type="date" value={f.date} onChange={set('date')} /></Field>
        <Field label="Distrito">
          <select value={f.district_id || ''} onChange={set('district_id')}>
            <option value="">Todos</option>
            {meta.districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Local"><input value={f.location} onChange={set('location')} /></Field>
      <Field label="Descrição"><textarea value={f.description} onChange={set('description')} /></Field>
      <Field group label="Anexos" hint="Fotos ou PDF (programação, autorização, mapa...)">
        <div className="attach-edit">
          {f.attachments.map((a) => (
            <span key={a.url} className="attach-chip">{a.type === 'pdf' ? <FileText size={14} /> : <Paperclip size={14} />} <span className="ellipsis">{a.name}</span>
              <button type="button" aria-label="Remover" onClick={() => setF({ ...f, attachments: f.attachments.filter((x) => x.url !== a.url) })}><X size={13} /></button></span>
          ))}
          {files.map((file, i) => (
            <span key={i} className="attach-chip new">{file.type === 'application/pdf' ? <FileText size={14} /> : <Paperclip size={14} />} <span className="ellipsis">{file.name}</span>
              <button type="button" aria-label="Remover" onClick={() => setFiles(files.filter((x) => x !== file))}><X size={13} /></button></span>
          ))}
          <label className="btn btn-secondary btn-sm"><Paperclip size={14} /> Adicionar anexo
            <input type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { setFiles([...files, ...e.target.files]); e.target.value = ''; }} />
          </label>
        </div>
      </Field>
      <label className="check"><input type="checkbox" checked={!!f.promote} onChange={(e) => setF({ ...f, promote: e.target.checked })} /> Mostrar na tela de todos ao abrir o app, até a data do evento</label>
      <p className="muted small" style={{ marginTop: '-.4rem' }}>Todo evento é grátis. A primeira foto dos anexos vira a capa do aviso.</p>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        {onCancel && <Button variant="secondary" onClick={onCancel}>Cancelar</Button>}
        <Button busy={busy} onClick={save}>{f.id ? 'Salvar alterações' : 'Criar evento'}</Button>
      </div>
    </div>
  );
}

function ParticipantsModal({ event, onClose, onChanged }) {
  const directory = useLoad(() => api.get('/admin/directory'));
  const [adding, setAdding] = useState(false);
  const [sel, setSel] = useState(emptySelection);
  const [busy, run] = useAsync();
  const add = async () => {
    const r = await run(() => api.post(`/admin/events/${event.id}/participants`, { clubs: [...sel.clubs], members: [...sel.members] }));
    notify(`${r.added} participante${r.added === 1 ? '' : 's'} adicionado${r.added === 1 ? '' : 's'}`);
    setSel(emptySelection());
    setAdding(false);
    onChanged();
  };
  const clubs = event.participants.filter((p) => p.target_type === 'club');
  const members = event.participants.filter((p) => p.target_type === 'member');
  return (
    <Modal title={`Participantes · ${event.name}`} onClose={onClose}
      footer={adding ? <><Button variant="secondary" onClick={() => setAdding(false)}>Voltar</Button><Button busy={busy} onClick={add}>Adicionar selecionados</Button></> : <Button onClick={() => setAdding(true)}>+ Adicionar participantes</Button>}>
      {adding ? (
        <PeoplePicker directory={directory.data} value={sel} onChange={setSel} allowClubs />
      ) : (
        <>
          <Section title={`Clubes (${clubs.length})`}>
            {clubs.length ? clubs.map((p) => <ParticipantRow key={'c' + p.target_id} p={p} event={event} onChanged={onChanged} />) : <Empty icon={Tent}>Nenhum clube marcado.</Empty>}
          </Section>
          <Section title={`Membros (${members.length})`}>
            {members.length ? members.map((p) => <ParticipantRow key={'m' + p.target_id} p={p} event={event} onChanged={onChanged} />) : <Empty icon={Users}>Nenhum membro marcado.</Empty>}
          </Section>
        </>
      )}
    </Modal>
  );
}

function ParticipantRow({ p, event, onChanged }) {
  const [, run] = useAsync();
  return (
    <div className="row between" style={{ padding: '.4rem 0', borderBottom: '1px solid var(--line)' }}>
      <span className="ico">{p.target_type === 'club' ? <Tent size={15} /> : <UserRound size={15} />} {p.name}</span>
      <Confirm text="Remover participante?" onYes={() => run(() => api.del(`/admin/events/${event.id}/participants/${p.target_type}/${p.target_id}`), 'Removido').then(onChanged)}>Remover</Confirm>
    </div>
  );
}

/** Eventos: página própria com "Criar evento" e "Eventos criados". */
export default function EventsAdmin() {
  const { meta } = useAuth();
  const [tab, setTab] = useState('criados');
  const state = useLoad(() => api.get('/admin/events'));
  const [editing, setEditing] = useState(null);
  const [partsOf, setPartsOf] = useState(null);
  const [, run] = useAsync();
  const current = partsOf && state.data?.find((e) => e.id === partsOf);
  return (
    <>
      <PageHeader title="Eventos" subtitle="Crie eventos e marque quem participou" />
      <Tabs tabs={[['criar', 'Criar evento'], ['criados', 'Eventos criados']]} value={tab} onChange={setTab} />
      {tab === 'criar' && (
        <Card><EventForm key={state.data?.length} initial={blank(meta.districts[0]?.id)} onDone={() => { state.reload(); setTab('criados'); }} /></Card>
      )}
      {tab === 'criados' && (
        <Loading {...state} empty="Nenhum evento criado ainda.">
          {(list) => list.map((e) => {
            const nClubs = e.participants.filter((p) => p.target_type === 'club').length;
            const nMembers = e.participants.length - nClubs;
            return (
              <Card key={e.id}>
                <div className="row between" style={{ alignItems: 'flex-start' }}>
                  <h3 className="grow">{e.name}</h3>
                  <Badge kind="blue"><CalendarDays size={12} /> {fmtDate(e.date)}</Badge>
                </div>
                {e.promote && e.date >= new Date().toISOString().slice(0, 10) ? <Badge kind="yellow"><Megaphone size={12} /> Aparece na abertura do app</Badge> : null}
                <p className="small muted ico"><MapPin size={14} /> {e.location || 'Local a definir'}{e.district_name ? ' · ' + e.district_name : ''}</p>
                {e.description && <p className="small">{e.description}</p>}
                <Attachments list={e.attachments} />
                <p className="small"><b>{nClubs}</b> clubes · <b>{nMembers}</b> membros</p>
                <div className="row wrap">
                  <Button small variant="yellow" onClick={() => setPartsOf(e.id)}><Users size={14} /> Participantes</Button>
                  <Button small variant="secondary" onClick={() => setEditing(e)}><Pencil size={14} /> Editar</Button>
                  <Confirm text="Excluir este evento? Ele sai do perfil de todos os participantes." onYes={() => run(() => api.del('/admin/events/' + e.id), 'Evento excluído').then(state.reload)}><Trash2 size={14} /> Excluir</Confirm>
                </div>
              </Card>
            );
          })}
        </Loading>
      )}
      {editing && (
        <Modal title="Editar evento" onClose={() => setEditing(null)}>
          <EventForm initial={{ ...editing, district_id: editing.district_id || '', promote: !!editing.promote }} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); state.reload(); }} />
        </Modal>
      )}
      {current && <ParticipantsModal event={current} onClose={() => setPartsOf(null)} onChanged={state.reload} />}
    </>
  );
}
