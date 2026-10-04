import { useEffect, useState } from 'react';
import { Eye, EyeOff, ImageUp, Link2, Megaphone, Pencil, Trash2 } from 'lucide-react';
import { api, toForm } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { fmtDate } from '../../format.js';
import { Badge, Button, Card, Confirm, Field, Loading, Modal, PageHeader, useAsync, useLoad } from '../../ui.jsx';
import { AnnouncementView } from '../Announcement.jsx';

/** Formato do anúncio: retrato 4:5 (o mesmo dos posts do Instagram). */
const IDEAL = { w: 1080, h: 1350 };

function ImageField({ value, onChange }) {
  const [info, setInfo] = useState(null);
  const url = value instanceof File ? URL.createObjectURL(value) : value;
  useEffect(() => {
    if (!url) return setInfo(null);
    const img = new Image();
    img.onload = () => setInfo({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
  }, [url]);
  const ratio = info ? info.w / info.h : null;
  const ok = ratio && Math.abs(ratio - IDEAL.w / IDEAL.h) < 0.06;
  return (
    <div className="field">
      <span className="field-label">Imagem do anúncio</span>
      <div className="ann-img-field">
        <div className="ann-frame">{url ? <img src={url} alt="" /> : <span><Megaphone size={36} /></span>}</div>
        <div className="stack" style={{ gap: '.45rem' }}>
          <label className="btn btn-secondary btn-sm"><ImageUp size={15} /> {url ? 'Trocar imagem' : 'Escolher imagem'}
            <input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && onChange(e.target.files[0])} />
          </label>
          <span className="field-hint">Tamanho ideal: <b>{IDEAL.w} × {IDEAL.h} px</b> (retrato 4:5, como post do Instagram). Em outro formato, a imagem é cortada pelo centro — o quadro ao lado mostra como fica.</span>
          {info && <Badge kind={ok ? 'green' : 'yellow'}>{info.w} × {info.h} px {ok ? '· formato ideal' : '· vai ser cortada'}</Badge>}
        </div>
      </div>
    </div>
  );
}

function AnnouncementForm({ initial, isClub, onClose, onDone }) {
  const { meta } = useAuth();
  const clubs = useLoad(() => (isClub ? Promise.resolve([]) : api.get('/admin/clubs')));
  const [f, setF] = useState(initial);
  const [busy, run] = useAsync();
  const [preview, setPreview] = useState(false);
  const save = async () => {
    const body = toForm({
      title: f.title, body: f.body, link: f.link || '', active: f.active ? 1 : 0, image: f.image instanceof File ? f.image : undefined,
      ...(isClub ? {} : { target_type: f.target_type, target_id: f.target_type === 'all' ? '' : f.target_id }),
    });
    await run(() => (f.id ? api.put('/announcements/manage/' + f.id, body) : api.post('/announcements/manage', body)), 'Anúncio salvo!');
    onDone();
  };
  const imgUrl = f.image instanceof File ? URL.createObjectURL(f.image) : f.image;
  return (
    <Modal title={f.id ? 'Editar anúncio' : 'Novo anúncio'} onClose={onClose}
      footer={<><Button variant="secondary" onClick={() => setPreview(true)}><Eye size={16} /> Ver como fica</Button><Button busy={busy} onClick={save}>Salvar</Button></>}>
      <div className="form">
        <ImageField value={f.image} onChange={(image) => setF({ ...f, image })} />
        <Field label="Título"><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Texto" hint="Aparece quando a pessoa toca no anúncio."><textarea value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
        <Field label="Link (opcional)" hint="Ex.: formulário de inscrição. Pode colar só “www.site.com”: o app completa.">
          <input value={f.link || ''} onChange={(e) => setF({ ...f, link: e.target.value })} placeholder="www.site.com.br/inscricao" inputMode="url" autoCapitalize="none" />
        </Field>
        {isClub ? (
          <p className="muted small">Este anúncio aparece só para os desbravadores, a liderança e as unidades do seu clube.</p>
        ) : (
          <Field group label="Quem vai ver">
            <div className="seg">
              {[['all', 'Todo o App'], ['district', 'Um distrito'], ['club', 'Um clube']].map(([k, l]) => (
                <button key={k} type="button" className={f.target_type === k ? 'active' : ''} onClick={() => setF({ ...f, target_type: k, target_id: '' })}>{l}</button>
              ))}
            </div>
            {f.target_type === 'district' && (
              <select value={f.target_id || ''} onChange={(e) => setF({ ...f, target_id: e.target.value })} style={{ marginTop: '.5rem' }}>
                <option value="">Escolha o distrito</option>
                {meta.districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )}
            {f.target_type === 'club' && (
              <select value={f.target_id || ''} onChange={(e) => setF({ ...f, target_id: e.target.value })} style={{ marginTop: '.5rem' }}>
                <option value="">Escolha o clube</option>
                {(clubs.data || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </Field>
        )}
        <label className="check"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> No ar (aparece ao abrir o app)</label>
      </div>
      {preview && <AnnouncementView a={{ ...f, image: imgUrl, link: f.link ? (/^https?:\/\//i.test(f.link) ? f.link : 'https://' + f.link) : null }} onClose={() => setPreview(false)} />}
    </Modal>
  );
}

const TARGET = (a) => (a.club_id ? null : a.target_type === 'district' ? `Distrito: ${a.target_name}` : a.target_type === 'club' ? `Clube: ${a.target_name}` : 'Todo o App');

/** Anúncios. Admin: para todos, um distrito ou um clube. Clube: só para os próprios membros. */
export default function AnnouncementsAdmin() {
  const { actor } = useAuth();
  const isClub = actor.type === 'club';
  const state = useLoad(() => api.get('/announcements/manage'));
  const [editing, setEditing] = useState(null);
  const [, run] = useAsync();
  return (
    <>
      <PageHeader title="Anúncios" subtitle={isClub ? 'Aparecem para os membros do seu clube ao abrir o app' : 'Aparecem no meio da tela quando a pessoa entra no app'}
        action={<Button small onClick={() => setEditing({ title: '', body: '', link: '', image: null, active: true, target_type: 'all', target_id: '' })}>+ Novo</Button>} />
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
                <p className="small muted">{fmtDate(a.created_at)}{TARGET(a) ? ' · ' + TARGET(a) : ''}</p>
                {a.link && <p className="small ico"><Link2 size={13} /> <a href={a.link} target="_blank" rel="noreferrer" className="ellipsis" style={{ maxWidth: 220, display: 'inline-block' }}>{a.link}</a></p>}
              </div>
            </div>
            <div className="row wrap mt">
              <Button small variant="secondary" onClick={() => setEditing({ ...a, active: !!a.active, target_id: a.target_id || '' })}><Pencil size={14} /> Editar</Button>
              <Button small variant="secondary" onClick={() => run(() => api.put('/announcements/manage/' + a.id, { active: a.active ? 0 : 1 }), a.active ? 'Anúncio pausado' : 'Anúncio no ar').then(state.reload)}>
                {a.active ? <><EyeOff size={14} /> Pausar</> : <><Eye size={14} /> Colocar no ar</>}
              </Button>
              <Confirm text="Excluir este anúncio?" onYes={() => run(() => api.del('/announcements/manage/' + a.id), 'Anúncio excluído').then(state.reload)}><Trash2 size={14} /> Excluir</Confirm>
            </div>
          </Card>
        ))}
      </Loading>
      {editing && <AnnouncementForm initial={editing} isClub={isClub} onClose={() => setEditing(null)} onDone={() => { setEditing(null); state.reload(); }} />}
    </>
  );
}
