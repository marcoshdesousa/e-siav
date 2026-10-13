// Tela do Pix, usada em qualquer compra do site (figurinhas hoje, cursos depois).
// Pix automático (SyncPay): confere a cada 4 s e avisa quando caiu. Pix manual: "Já paguei".
import { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import { api } from '../api.js';
import { Button, notify, useAsync } from '../ui.jsx';

export const money = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function PixCheckout({ payment, onPaid, onNotified, children }) {
  const [p, setP] = useState(payment);
  const [busy, run] = useAsync();
  useEffect(() => {
    if (!p.auto || p.status === 'pago') return undefined;
    const t = setInterval(async () => {
      try {
        const o = await api.get('/pagamentos/' + p.id);
        if (o.status !== p.status) { setP(o); if (o.status === 'pago') onPaid?.(o); }
      } catch { /* tenta de novo */ }
    }, 4000);
    return () => clearInterval(t);
  }, [p.id, p.status, p.auto, onPaid]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(p.pix); notify('Código Pix copiado! Cole no app do seu banco.'); } catch { notify('Não deu para copiar. Selecione o código e copie.', 'error'); }
  };
  const paid = async () => {
    await run(() => api.post(`/pagamentos/${p.id}/paguei`), 'Recebemos o seu aviso! Assim que o pagamento for confirmado, liberamos para você.');
    onNotified?.();
  };
  return (
    <div className="pix-box">
      <p className="center" style={{ margin: 0 }}><b>{p.title}</b> · <b>{money(p.amount_cents)}</b></p>
      {children}
      {p.qr && <img src={p.qr} alt="QR Code do Pix" className="pix-qr" />}
      <p className="small muted center" style={{ margin: 0 }}>Copie o código abaixo e cole no app do banco, em <b>Pix copia e cola</b>.{p.receiver ? <> Recebedor: <b>{p.receiver}</b>.</> : null}</p>
      <div className="pix-code">{p.pix}</div>
      <Button block onClick={copy}><Copy size={16} /> Copiar código Pix</Button>
      {p.auto
        ? <p className="small center pix-wait"><span className="spinner-inline" /> Esperando o pagamento... assim que cair, libera sozinho.</p>
        : (
          <>
            <Button block variant="green" busy={busy} onClick={paid}>Já paguei</Button>
            <p className="small muted center" style={{ margin: 0 }}>Depois que o pagamento for confirmado pela equipe, libera para você.</p>
          </>
        )}
    </div>
  );
}
