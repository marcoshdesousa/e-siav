// Lembrete de estudo: em cada estudo o membro escolhe o horário e o app avisa todo dia nessa hora
// (só se ele ainda não tiver estudado). Sem horário escolhido, vale o lembrete automático do app.
import { useState } from 'react';
import { BellRing, BellPlus, Trash2 } from 'lucide-react';
import { api } from '../../api.js';
import { Button, Modal, notify, useAsync, useLoad } from '../../ui.jsx';
import { enablePush, installedApp, pushSupported } from '../../push.js';

const QUICK = ['06:30', '07:00', '12:00', '18:00', '19:30', '21:00'];

/** Situação das notificações neste aparelho: 'on', 'ask' (falta permitir), 'denied' ou 'browser' (não instalado). */
function deviceState() {
  if (!pushSupported() || !installedApp()) return 'browser';
  if (Notification.permission === 'granted') return 'on';
  return Notification.permission === 'denied' ? 'denied' : 'ask';
}

export function StudyReminder({ kind }) {
  const state = useLoad(() => api.get('/me/lembretes'));
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState('');
  const [busy, run] = useAsync();
  const d = state.data;
  if (!d) return null;
  const cur = d.reminders[kind];
  const label = d.kinds[kind];
  const dev = deviceState();
  const save = (t) => run(async () => {
    if (t && dev === 'ask') await enablePush();
    const r = await api.put('/me/lembretes', { kind, time: t });
    state.setData((x) => ({ ...x, reminders: r.reminders }));
    setOpen(false);
    notify(t ? `Pronto! Todo dia às ${t} o app lembra você: ${label}.` : 'Lembrete tirado. Vale o lembrete automático do app.');
  });
  return (
    <>
      <button type="button" className={'remind-btn' + (cur ? ' on' : '')} onClick={() => { setTime(cur || '19:00'); setOpen(true); }}>
        {cur ? <BellRing size={16} /> : <BellPlus size={16} />}
        {cur ? <>Lembrete <b>{cur}</b></> : 'Criar lembrete'}
      </button>
      {open && (
        <Modal title={`Lembrete: ${label}`} onClose={() => setOpen(false)}
          footer={<Button block busy={busy} disabled={!time} onClick={() => save(time)}><BellRing size={16} /> {cur ? 'Salvar horário' : 'Lembrar todo dia'}</Button>}>
          <p className="small muted" style={{ marginTop: 0 }}>Todo dia, nesse horário, o app manda uma notificação lembrando você de estudar. Se você já tiver estudado no dia, não manda.</p>
          <div className="remind-time">
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Horário" />
          </div>
          <div className="remind-quick">
            {QUICK.map((t) => <button key={t} type="button" className={time === t ? 'on' : ''} onClick={() => setTime(t)}>{t}</button>)}
          </div>
          {dev === 'browser' && <p className="remind-warn">As notificações só chegam no app instalado na tela de início do celular. Instale o app para receber.</p>}
          {dev === 'denied' && <p className="remind-warn">As notificações estão bloqueadas neste celular. Libere nas configurações para receber.</p>}
          {dev === 'ask' && <p className="small muted">Ao salvar, o celular vai pedir para permitir as notificações.</p>}
          {cur && <Button block variant="secondary" busy={busy} onClick={() => save('')}><Trash2 size={15} /> Tirar lembrete</Button>}
          <p className="small muted" style={{ marginBottom: 0 }}>Sem lembrete marcado, o app lembra sozinho em algum horário do dia, se você ainda não tiver estudado.</p>
        </Modal>
      )}
    </>
  );
}
