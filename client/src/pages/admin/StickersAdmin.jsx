// Equipe: quem completou os álbuns (ganham medalha e troféu sozinhos) e pacotinhos de presente.
// Os pagamentos ficam em Admin → Pagamentos.
import { useState } from 'react';
import { Gift, Trophy } from 'lucide-react';
import { api } from '../../api.js';
import { fmtDate } from '../../format.js';
import { Button, Card, Field, Loading, PageHeader, Section, Tabs, useAsync, useLoad } from '../../ui.jsx';

function Completed() {
  const state = useLoad(() => api.get('/admin/figurinhas/completos'));
  return (
    <Loading {...state}>
      {(rows) => (
        <>
          <p className="small muted">Quem completa o álbum ganha sozinho uma medalha e um troféu no perfil.</p>
          <div className="list">
            {rows.length === 0 && <p className="muted center">Ninguém completou ainda.</p>}
            {rows.map((x) => (
              <div key={x.album + x.member_id} className="list-item">
                <Trophy size={22} style={{ color: 'var(--yellow)' }} />
                <div className="grow">
                  <div className="title">{x.name} <span className="muted small">#{x.code}</span></div>
                  <div className="sub">{x.club_name}{x.unit_name ? ` · Unidade ${x.unit_name}` : ''}</div>
                  <div className="sub">{x.album_name} · completou em {fmtDate(x.completed_at)} · {x.packs_opened} pacotinhos abertos</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Loading>
  );
}

function Gift_() {
  const [f, setF] = useState({ code: '', packs: '5' });
  const [busy, run] = useAsync();
  return (
    <Card>
      <div className="form">
        <p className="small muted" style={{ margin: 0 }}>Dê pacotinhos de presente (promoções, prêmios ou testes) pelo código do membro.</p>
        <Field label="Código do membro (6 números)"><input inputMode="numeric" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.replace(/\D/g, '').slice(0, 6) })} /></Field>
        <Field label="Pacotinhos"><input type="number" min="1" max="100" value={f.packs} onChange={(e) => setF({ ...f, packs: e.target.value })} /></Field>
        <Button busy={busy} disabled={f.code.length !== 6} onClick={() => run(() => api.post('/admin/figurinhas/presente', { code: f.code, packs: Number(f.packs), album: 'biblico' }), null).then((r) => r && window.alert(`Pronto! ${f.packs} pacotinho(s) para ${r.name}.`))}><Gift size={16} /> Dar pacotinhos</Button>
      </div>
    </Card>
  );
}

export default function StickersAdmin() {
  const [tab, setTab] = useState('completos');
  return (
    <>
      <PageHeader title="Figurinhas" subtitle="Quem completou os álbuns e pacotinhos de presente" />
      <Tabs tabs={[['completos', 'Completaram'], ['presente', 'Presentear']]} value={tab} onChange={setTab} />
      <Section>
        {tab === 'completos' && <Completed />}
        {tab === 'presente' && <Gift_ />}
      </Section>
    </>
  );
}
