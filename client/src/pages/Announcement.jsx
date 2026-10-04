import { useEffect, useState } from 'react';
import { CalendarDays, ExternalLink, MapPin, Megaphone, X } from 'lucide-react';
import { fmtDate } from '../format.js';
import { Attachments } from './admin/Events.jsx';
import { api } from '../api.js';

const SEEN_KEY = 'dbv-anuncios-vistos';

function seen() {
  try { return JSON.parse(sessionStorage.getItem(SEEN_KEY) || '[]'); } catch { return []; }
}
function markSeen(id) {
  try { sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen(), id])); } catch { /* sem armazenamento: mostra de novo */ }
}

/** Anúncio grande no meio da tela; tocar abre os detalhes; o X pequeno fecha. */
export function AnnouncementView({ a, onClose }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ann-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'ann' + (open ? ' open' : '')} role="dialog" aria-modal="true" aria-label={a.title}>
        <button type="button" className="ann-x" aria-label="Fechar anúncio" onClick={onClose}><X size={16} /></button>
        <button type="button" className="ann-card" onClick={() => setOpen(true)} disabled={open}>
          {a.image ? <img src={a.image} alt="" /> : <span className="ann-ph"><Megaphone size={56} /></span>}
          {a.event && <span className="ann-kicker">Evento · {fmtDate(a.event.date)}</span>}
          <span className="ann-title">{a.title}</span>
          {!open && <span className="ann-hint">Toque para ver mais</span>}
        </button>
        {open && (
          <div className="ann-body">
            {a.event && <p className="muted ico"><CalendarDays size={15} /> {fmtDate(a.event.date)}{a.event.location ? <> · <MapPin size={15} /> {a.event.location}</> : null}</p>}
            {a.body && <p>{a.body}</p>}
            {a.event && <Attachments list={a.event.attachments} />}
            {a.link && <a className="btn btn-primary btn-block" href={a.link} target="_blank" rel="noreferrer">Abrir link <ExternalLink size={16} /></a>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Mostra os anúncios ativos uma vez por sessão, quando a pessoa abre o app. */
export default function AnnouncementPopup() {
  const [queue, setQueue] = useState([]);
  useEffect(() => {
    Promise.all([
      api.get('/announcements/active').catch(() => []),
      api.get('/events/upcoming').catch(() => []),
    ]).then(([anns, events]) => {
      // Eventos aparecem como anúncio até a data do evento.
      const evs = events.map((e) => ({
        id: 'ev' + e.id, title: e.name, body: e.description, link: null,
        image: e.attachments.find((x) => x.type === 'image')?.url || null, event: e,
      }));
      setQueue([...anns, ...evs].filter((a) => !seen().includes(a.id)));
    });
  }, []);
  const current = queue[0];
  if (!current) return null;
  return <AnnouncementView key={current.id} a={current} onClose={() => { markSeen(current.id); setQueue((q) => q.slice(1)); }} />;
}
