// Álbuns de figurinhas: lista, o Álbum Bíblico App (comprar, abrir, colar, trocar repetidas)
// e o Palmares 27 (em breve).
import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Copy, Gift, Package, Repeat, ShoppingCart, Sparkles, Trophy } from 'lucide-react';
import { api } from '../../api.js';
import { fmtDate } from '../../format.js';
import { Badge, Button, Card, Loading, Modal, PageHeader, Section, Tabs, notify, useAsync, useLoad } from '../../ui.jsx';
import { sfx, unlockAudio } from '../games/audio.js';
import { StickerCard } from './StickerArt.jsx';
import data from './biblico.json';
import './albums.css';

const BY_ID = Object.fromEntries(data.stickers.map((s) => [s.id, s]));
const money = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const RARITY = { comum: 'Comum', rara: 'Rara', lendaria: 'Lendária' };

/** Lista de álbuns. */
export function AlbumsPage({ base }) {
  const state = useLoad(() => api.get('/albuns'));
  return (
    <>
      <PageHeader title="Álbuns de figurinhas" subtitle="Colecione, cole e complete os álbuns" />
      <Loading {...state}>
        {(list) => (
          <div className="album-list">
            {list.map((a) => (a.active ? (
              <Link key={a.id} to={`${base}/albuns/${a.id}`} className="album-card">
                <div className="album-cover album-cover-biblico"><Sparkles size={28} /><b>Bíblico</b><span>App</span></div>
                <div className="album-info">
                  <h2>{a.name}</h2>
                  <div className="album-bar"><span style={{ width: `${(a.stuck / a.total) * 100}%` }} /></div>
                  <p className="small">{a.stuck} de {a.total} coladas{a.packs_unopened ? <> · <b>{a.packs_unopened} pacotinho{a.packs_unopened > 1 ? 's' : ''} para abrir</b></> : ''}</p>
                  {a.completed_at && <Badge kind="green">Completo!</Badge>}
                </div>
              </Link>
            ) : (
              <div key={a.id} className="album-card is-soon">
                <div className="album-cover"><span className="album-year">27</span><b>Palmares</b></div>
                <div className="album-info">
                  <h2>{a.name}</h2>
                  <span className="badge badge-yellow">Em breve</span>
                  <p className="small">Figurinhas com a foto dos membros dos clubes.</p>
                </div>
              </div>
            )))}
          </div>
        )}
      </Loading>
    </>
  );
}

function StickerModal({ sticker, onClose }) {
  return (
    <Modal title={`#${sticker.id} · ${sticker.name}`} onClose={onClose}>
      <div className="stk-detail">
        <StickerCard sticker={sticker} size={200} />
        <div>
          <p className="small muted" style={{ margin: 0 }}>{sticker.ref} · {RARITY[sticker.rarity]}</p>
          <p>{sticker.story}</p>
        </div>
      </div>
    </Modal>
  );
}

/** Comprar pacotinhos: escolhe a quantidade e paga no Pix sem sair do app. */
function BuyModal({ album, onClose, onDone }) {
  const [order, setOrder] = useState(null);
  const [busy, run] = useAsync();
  const buy = async (packs) => setOrder(await run(() => api.post(`/albuns/${album.id}/pedidos`, { packs }), null));
  const copy = async () => {
    try { await navigator.clipboard.writeText(order.pix); notify('Código Pix copiado! Cole no app do seu banco.'); } catch { notify('Não deu para copiar. Selecione o código e copie.', 'error'); }
  };
  const paid = async () => {
    await run(() => api.post(`/albuns/pedidos/${order.id}/paguei`), 'Recebemos o seu aviso! Assim que o pagamento for confirmado, os pacotinhos aparecem aqui.');
    onDone(); onClose();
  };
  return (
    <Modal title={order ? 'Pague com Pix' : 'Comprar pacotinhos'} onClose={onClose}>
      {!order ? (
        <>
          <p className="small muted" style={{ marginTop: 0 }}>Cada pacotinho tem {album.pack_size} figurinhas e custa {money(album.price_cents)}.</p>
          {!album.pix_ready && <Card className="small">O pagamento ainda não foi liberado pela equipe. Tente mais tarde.</Card>}
          <div className="buy-grid">
            {album.options.map((n) => (
              <button key={n} type="button" className="buy-option" disabled={busy || !album.pix_ready} onClick={() => buy(n)}>
                <Package size={26} />
                <b>{n} pacotinho{n > 1 ? 's' : ''}</b>
                <small>{n * album.pack_size} figurinhas</small>
                <span>{money(n * album.price_cents)}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="pix-box">
          <p className="center" style={{ margin: 0 }}><b>{order.packs} pacotinho{order.packs > 1 ? 's' : ''}</b> · <b>{money(order.amount_cents)}</b></p>
          {order.qr && <img src={order.qr} alt="QR Code do Pix" className="pix-qr" />}
          <p className="small muted center">Copie o código abaixo e cole no app do seu banco, em <b>Pix copia e cola</b>.{order.receiver ? <> Recebedor: <b>{order.receiver}</b>.</> : null}</p>
          <div className="pix-code">{order.pix}</div>
          <Button block onClick={copy}><Copy size={16} /> Copiar código Pix</Button>
          <Button block variant="green" busy={busy} onClick={paid}>Já paguei</Button>
          <p className="small muted center" style={{ margin: 0 }}>Depois que o pagamento for confirmado, os pacotinhos aparecem no topo do álbum.</p>
        </div>
      )}
    </Modal>
  );
}

/** Abrir pacotinho: o pacote treme, rasga e as 4 figurinhas viram uma a uma. */
function OpenPack({ album, onClose, onChanged }) {
  const [step, setStep] = useState('sealed'); // sealed → opening → cards
  const [result, setResult] = useState(null);
  const [shown, setShown] = useState(0);
  const [left, setLeft] = useState(album.packs_unopened);
  const [busy, run] = useAsync();
  const [detail, setDetail] = useState(null);
  const open = async () => {
    unlockAudio();
    setStep('opening'); sfx('pop');
    try {
      const r = await api.post(`/albuns/${album.id}/abrir`);
      setTimeout(() => {
        setResult(r); setLeft(r.packs_unopened); setStep('cards'); setShown(0);
        r.cards.forEach((c, i) => setTimeout(() => { setShown(i + 1); sfx(c.isNew ? 'coin' : 'flip'); }, 350 + i * 450));
        onChanged();
      }, 900);
    } catch (e) { notify(e.message, 'error'); onClose(); }
  };
  const pasteNew = async () => {
    const ids = [...new Set(result.cards.filter((c) => c.isNew).map((c) => c.id))];
    const r = await run(() => api.post(`/albuns/${album.id}/colar`, { ids }), null);
    sfx('win');
    notify(r.completed ? 'Parabéns! Você completou o álbum!' : `${ids.length} figurinha${ids.length > 1 ? 's' : ''} colada${ids.length > 1 ? 's' : ''}!`);
    onChanged();
    if (left > 0) { setStep('sealed'); setResult(null); } else onClose();
  };
  const newCount = result ? result.cards.filter((c) => c.isNew).length : 0;
  return (
    <div className="pack-overlay" role="dialog" aria-modal="true">
      <button type="button" className="pack-close" onClick={onClose} aria-label="Fechar">✕</button>
      {step !== 'cards' ? (
        <div className="pack-stage">
          <p className="pack-hint">{step === 'sealed' ? 'Toque no pacotinho para abrir' : 'Abrindo...'}</p>
          <button type="button" className={'stk-pack pack-btn' + (step === 'opening' ? ' is-opening' : '')} onClick={step === 'sealed' ? open : undefined} aria-label="Abrir pacotinho">
            <span className="stk-pack-text">{data.name}<br /><small>{album.pack_size} figurinhas</small></span>
          </button>
          <p className="pack-hint small">{left} pacotinho{left !== 1 ? 's' : ''} para abrir</p>
        </div>
      ) : (
        <div className="pack-stage">
          <p className="pack-hint">{newCount ? `${newCount} nova${newCount > 1 ? 's' : ''}!` : 'Só repetidas desta vez...'}</p>
          <div className="pack-cards">
            {result.cards.map((c, i) => {
              const s = BY_ID[c.id];
              return (
                <div key={i} className="stk-flip" style={{ width: 130, height: Math.round(130 * 1.36) }}>
                  <div className={'stk-flip-inner' + (shown > i ? ' is-flipped' : '')}>
                    <div className="stk-flip-front"><StickerCard sticker={s} size={130} state="back" /></div>
                    <div className="stk-flip-back"><StickerCard sticker={s} size={130} badge={c.isNew ? 'NOVA' : 'REPETIDA'} onClick={() => setDetail(s)} /></div>
                  </div>
                </div>
              );
            })}
          </div>
          {shown >= result.cards.length && (
            <div className="pack-actions">
              {newCount > 0 && <Button busy={busy} onClick={pasteNew}><Sparkles size={16} /> Colar as novas no álbum</Button>}
              {left > 0 && <Button variant="secondary" onClick={() => { setStep('sealed'); setResult(null); }}><Package size={16} /> Abrir outro ({left})</Button>}
              <Button variant="secondary" onClick={onClose}>Fechar</Button>
              <p className="small pack-note">As repetidas vão para o monte de repetidas. As novas também podem ser coladas depois.</p>
            </div>
          )}
        </div>
      )}
      {detail && <StickerModal sticker={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

/** O Álbum Bíblico App. */
export function AlbumPage() {
  const { id } = useParams();
  const state = useLoad(() => api.get('/albuns/' + id), [id]);
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState('album');
  const [buy, setBuy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [detail, setDetail] = useState(null);
  const [busy, run] = useAsync();
  const toPaste = useMemo(() => Object.entries(state.data?.stickers || {}).filter(([, v]) => !v.stuck).map(([k]) => Number(k)).sort((a, b) => a - b), [state.data]);
  if (id !== 'biblico') return <Navigate to=".." replace />;
  const paste = async (ids) => {
    const r = await run(() => api.post(`/albuns/${id}/colar`, ids ? { ids } : {}), null);
    sfx(r.completed ? 'record' : 'pop');
    if (r.completed) notify('Parabéns! Você completou o álbum!');
    state.reload();
  };
  const trade = async () => {
    await run(() => api.post(`/albuns/${id}/trocar`), 'Troca feita! Você ganhou 1 pacotinho.');
    state.reload();
  };
  return (
    <Loading {...state}>
      {(a) => {
        const stuck = Object.values(a.stickers).filter((x) => x.stuck).length;
        const pg = data.pages[page];
        const waiting = a.orders.filter((o) => o.status === 'aberto' || o.status === 'aguardando');
        return (
          <>
            <PageHeader title={a.name} subtitle={`${stuck} de ${a.total} figurinhas coladas`} />
            <div className="album-bar big"><span style={{ width: `${(stuck / a.total) * 100}%` }} /></div>
            {a.completed_at && <Card className="album-done"><Trophy size={22} /> Álbum completo em {fmtDate(a.completed_at)}! A equipe vai entregar o seu troféu pelo diretor do seu clube.</Card>}

            <div className="album-top">
              <button type="button" className={'album-packs' + (a.packs_unopened ? ' has' : '')} disabled={!a.packs_unopened} onClick={() => setOpening(true)}>
                <Package size={30} />
                <span><b>{a.packs_unopened}</b> pacotinho{a.packs_unopened !== 1 ? 's' : ''}</span>
                <small>{a.packs_unopened ? 'Toque para abrir' : 'Nenhum para abrir'}</small>
              </button>
              <div className="album-side">
                <Button block onClick={() => setBuy(true)}><ShoppingCart size={16} /> Comprar</Button>
                <Button block variant="secondary" disabled={a.repeats < a.repeats_per_free_pack || busy} onClick={trade}>
                  <Gift size={16} /> Trocar {a.repeats_per_free_pack} repetidas
                </Button>
                <span className="small muted center"><Repeat size={12} /> {a.repeats} repetida{a.repeats !== 1 ? 's' : ''}</span>
              </div>
            </div>
            {waiting.length > 0 && <Card className="small">Pedido{waiting.length > 1 ? 's' : ''} esperando confirmação do Pix: {waiting.map((o) => `${o.packs} pacotinho${o.packs > 1 ? 's' : ''}`).join(', ')}. Assim que confirmar, aparece aqui.</Card>}

            {toPaste.length > 0 && (
              <Section title={`Para colar (${toPaste.length})`} action={<Button small busy={busy} onClick={() => paste(null)}><Sparkles size={14} /> Colar todas</Button>}>
                <div className="paste-row">
                  {toPaste.map((sid) => <StickerCard key={sid} sticker={BY_ID[sid]} size={84} badge="COLAR" onClick={() => paste([sid])} />)}
                </div>
              </Section>
            )}

            <Tabs tabs={[['album', 'Álbum'], ['repetidas', `Repetidas (${a.repeats})`], ['pedidos', 'Pedidos']]} value={tab} onChange={setTab} />
            {tab === 'album' && (
              <div className="album-page">
                <div className="album-page-head">
                  <button type="button" className="icon-btn" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Página anterior"><ChevronLeft /></button>
                  <div className="center"><small className="muted">Página {page + 1} de {data.pages.length}</small><b>{pg.title}</b></div>
                  <button type="button" className="icon-btn" disabled={page === data.pages.length - 1} onClick={() => setPage(page + 1)} aria-label="Próxima página"><ChevronRight /></button>
                </div>
                <div className="album-slots">
                  {pg.stickers.map((sid) => {
                    const s = BY_ID[sid];
                    const mine = a.stickers[sid];
                    if (mine?.stuck) return <StickerCard key={sid} sticker={s} size={104} onClick={() => setDetail(s)} />;
                    if (mine) return <StickerCard key={sid} sticker={s} size={104} badge="COLAR" onClick={() => paste([sid])} />;
                    return <StickerCard key={sid} sticker={s} size={104} state="empty" />;
                  })}
                </div>
                <div className="album-dots">
                  {data.pages.map((p, i) => {
                    const done = p.stickers.every((sid) => a.stickers[sid]?.stuck);
                    return <button key={i} type="button" className={(i === page ? 'on ' : '') + (done ? 'done' : '')} onClick={() => setPage(i)} aria-label={`Página ${i + 1}`} />;
                  })}
                </div>
              </div>
            )}
            {tab === 'repetidas' && (
              <>
                <p className="small muted">A cada {a.repeats_per_free_pack} repetidas você troca por 1 pacotinho grátis.</p>
                <div className="paste-row wrap">
                  {Object.entries(a.stickers).filter(([, v]) => v.qty > 1).map(([sid, v]) => (
                    <StickerCard key={sid} sticker={BY_ID[sid]} size={84} badge={`x${v.qty - 1}`} onClick={() => setDetail(BY_ID[sid])} />
                  ))}
                </div>
                {a.repeats === 0 && <p className="muted center">Nenhuma repetida ainda.</p>}
              </>
            )}
            {tab === 'pedidos' && (
              <div className="list">
                {a.orders.length === 0 && <p className="muted center">Nenhum pedido ainda.</p>}
                {a.orders.map((o) => (
                  <div key={o.id} className="list-item">
                    <Package size={22} />
                    <div className="grow">
                      <div className="title">{o.packs} pacotinho{o.packs > 1 ? 's' : ''} · {money(o.amount_cents)}</div>
                      <div className="sub">{fmtDate(o.created_at)}</div>
                    </div>
                    <Badge kind={{ pago: 'green', aguardando: 'yellow', aberto: 'blue', recusado: 'red' }[o.status] || ''}>
                      {{ pago: 'Pago', aguardando: 'Confirmando', aberto: 'Esperando Pix', recusado: 'Recusado', cancelado: 'Cancelado' }[o.status]}
                    </Badge>
                    {o.status === 'aberto' && <Button small variant="secondary" onClick={() => run(() => api.post(`/albuns/pedidos/${o.id}/cancelar`), 'Pedido cancelado').then(state.reload)}>Cancelar</Button>}
                  </div>
                ))}
              </div>
            )}

            {buy && <BuyModal album={a} onClose={() => setBuy(false)} onDone={state.reload} />}
            {opening && <OpenPack album={a} onClose={() => { setOpening(false); state.reload(); }} onChanged={state.reload} />}
            {detail && <StickerModal sticker={detail} onClose={() => setDetail(null)} />}
          </>
        );
      }}
    </Loading>
  );
}
