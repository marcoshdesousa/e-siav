import { useState } from 'react';
import { Eye, EyeOff, Megaphone, Pencil, Trash2 } from 'lucide-react';
import { api, toForm } from '../../api.js';
import { fmtDate } from '../../format.js';
import { Badge, Button, Card, Confirm, Field, ImagePicker, Loading, Modal, PageHeader, useAsync, useLoad } from '../../ui.jsx';
import { AnnouncementView } from '../Announcement.jsx';

function AnnouncementForm({ initial, onClose, onDone }) {
  const [f, setF] = useState(initial);
  const [busy, run] = useAsync();
  const [preview, setPreview] = useState(false);
  const save = async () => {
    const body = toForm({ title: f.title, body: f.body, link: f.link || '', active: f.active ? 1 : 0, image: f.image instanceof File ? f.image : undefined });
    await run(() => (f.id ? api.put('/admin/announcements/' + f.id, body) : api.post('/admin/announcements', body)), 'Anúncio salvo!');
    onDone();
  };
  const imgUrl = f.image instanceof File ? URL.createObjectURL(f.image) : f.image;
  return (
    <Modal title={f.id ? 'Editar anúncio' : 'Novo anúncio'} onClose={onClose}
      footer={<><Button variant="secondary" onClick={() => setPreview(true)}><Eye size={16} /> Ver como fica</Button><Button busy={busy} onClick={save}>Salvar</Button></>}>
      <div className="form">
        <ImagePicker label="Imagem do anúncio" value={f.image} onChange={(image) => setF({ ...f, image })} round={false} />
        <Field label="Título"><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Texto" hint="Aparece quando a pessoa toca no anúncio."><textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
        <Field label="Link (opcional)" hint="Ex.: formulário de inscrição. Precisa começar com https://"><input value={f.link || ''} onChange={(e) => setF({ ...f, link: e.target.value })} placeholder="https://" /></Field>
        <label className="check"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Mostrar para todos ao abrir o app</label>
      </div>
      {preview && <AnnouncementView a={{ ...f, image: imgUrl }} onClose={() => setPreview(false)} />}
    </Modal>
  );
}

/** Anúncios que aparecem grandes no meio da tela quando a pessoa abre o app. */
export default function AnnouncementsAdmin() {
  const state = useLoad(() => api.get('/admin/announcements'));
  const [editing, setEditing] = useState(null);
  const [, run] = useAsync();
  return (
    <>
      <PageHeader title="Anúncios" subtitle="Aparecem no meio da tela quando a pessoa entra no app" action={<Button small onClick={() => setEditing({ title: '', body: '', link: '', image: null, active: true })}>+ Novo</Button>} />
      <Loading {...state} empty="Nenhum anúncio criado.">
        {(list) => list.map((a) => (
          <Card key={a.id}>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              {a.image ? <img src={a.image} alt="" className="ann-thumb" /> : <span className="ann-thumb ph"><Megaphone size={26} /></span>}
              <div className="grow">
                <div className="row between" style={{ alignItems: 'flex-start' }}>
                  <h3>{a.title}</h3>
                  {a.active ? <Badge kind="green">No ar</Badge> : <Badge>Pausado</Badge>}
                </div>
                <p className="small muted">{fmtDate(a.created_at)}</p>
                {a.body && <p className="small" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.body}</p>}
              </div>
            </div>
            <div className="row wrap mt">
              <Button small variant="secondary" onClick={() => setEditing({ ...a, active: !!a.active })}><Pencil size={14} /> Editar</Button>
              <Button small variant="secondary" onClick={() => run(() => api.put('/admin/announcements/' + a.id, { active: a.active ? 0 : 1 }), a.active ? 'Anúncio pausado' : 'Anúncio no ar').then(state.reload)}>
                {a.active ? <><EyeOff size={14} /> Pausar</> : <><Eye size={14} /> Colocar no ar</>}
              </Button>
              <Confirm text="Excluir este anúncio?" onYes={() => run(() => api.del('/admin/announcements/' + a.id), 'Anúncio excluído').then(state.reload)}><Trash2 size={14} /> Excluir</Confirm>
            </div>
          </Card>
        ))}
      </Loading>
      {editing && <AnnouncementForm initial={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); state.reload(); }} />}
    </>
  );
}
