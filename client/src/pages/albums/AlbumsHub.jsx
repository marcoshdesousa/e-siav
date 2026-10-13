// Álbuns de figurinhas: lista, o Álbum Bíblico App (comprar, abrir, colar, trocar repetidas)
// e o Palmares 27 (em breve).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Copy, Gift, Heart, Package, Repeat, ShoppingCart, Sparkles, Trophy } from 'lucide-react';
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

/** Recado na compra: o dinheiro ajuda o app e o distrito. */
function SupportNote({ district }) {
  return (
    <div className="support-note">
      <Heart size={18} />
      <span>Além da diversão e da nostalgia, você ajuda o <b>App do DBV</b> e o seu distrito{district ? <> (<b>{district}</b>)</> : ''}. Quem completa o álbum ganha um <b>trunfo especial físico</b>!</span>
    </div>
  );
}


/**
 * Comprar pacotinhos: escolhe a quantidade e paga no Pix sem sair do app (nada de CPF ou outros
 * dados). Com a SyncPay ligada, libera sozinho quando o Pix cai.
 */
function BuyModal({ album, onClose, onDone, onOpen }) {
    const [order, setOrder] = useState(null);
  const [busy, run] = useAsync();
  const create = async (n) => {
    const o = await run(() => api.post(`/albuns/${album.id}/pedidos`, { packs: n }), null);
    if (o) setOrder(o);
  };
  // Pix automático: confere a cada 4 s se o pagamento caiu.
  useEffect(() => {
    if (!order?.auto || order.status === 'pago') return undefined;
    const t = setInterval(async () => {
      try {
        const o = await api.get('/albuns/pedidos/' + order.id);
        if (o.status !== order.status) { setOrder((cur) => ({ ...cur, status: o.status })); if (o.status === 'pago') { sfx('win'); onDone(); } }
      } catch { /* tenta de novo */ }
    }, 4000);
    return () => clearInterval(t);
  }, [order?.id, order?.status, order?.auto, onDone]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(order.pix); notify('Código Pix copiado! Cole no app do seu banco.'); } catch { notify('Não deu para copiar. Selecione o código e copie.', 'error'); }
  };
  const paid = async () => {
    await run(() => api.post(`/albuns/pedidos/${order.id}/paguei`), 'Recebemos o seu aviso! Assim que o pagamento for confirmado, os pacotinhos aparecem aqui.');
    onDone(); onClose();
  };
  const title = order ? (order.status === 'pago' ? 'Pagamento confirmado!' : 'Pague com Pix') : 'Comprar pacotinhos';
  return (
    <Modal title={title} onClose={onClose}>
      {!order && (
        <>
          <p className="small muted" style={{ marginTop: 0 }}>Cada pacotinho tem {album.pack_size} figurinhas e custa {money(album.price_cents)}.</p>
          <SupportNote district={album.district_name} />
          {!album.pix_ready && <Card className="small">O pagamento ainda não foi liberado pela equipe. Tente mais tarde.</Card>}
          <div className="buy-grid">
            {album.options.map((n) => (
              <button key={n} type="button" className="buy-option" disabled={busy || !album.pix_ready} onClick={() => create(n)}>
                <Package size={26} />
                <b>{n} pacotinho{n > 1 ? 's' : ''}</b>
                <small>{n * album.pack_size} figurinhas</small>
                <span>{money(n * album.price_cents)}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {order && order.status === 'pago' && (
        <div className="pix-box center">
          <Sparkles size={44} style={{ color: 'var(--yellow)', margin: '0 auto' }} />
          <p><b>{order.packs} pacotinho{order.packs > 1 ? 's' : ''}</b> já estão no seu álbum.</p>
          <Button block onClick={() => { onClose(); onOpen(); }}><Package size={16} /> Abrir agora</Button>
          <Button block variant="secondary" onClick={onClose}>Depois</Button>
        </div>
      )}
      {order && order.status !== 'pago' && (
        <div className="pix-box">
          <p className="center" style={{ margin: 0 }}><b>{order.packs} pacotinho{order.packs > 1 ? 's' : ''}</b> · <b>{money(order.amount_cents)}</b></p>
          <SupportNote district={album.district_name} />
          {order.qr && <img src={order.qr} alt="QR Code do Pix" className="pix-qr" />}
          <p className="small muted center">Copie o código abaixo e cole no app do seu banco, em <b>Pix copia e cola</b>.{order.receiver ? <> Recebedor: <b>{order.receiver}</b>.</> : null}</p>
          <div className="pix-code">{order.pix}</div>
          <Button block onClick={copy}><Copy size={16} /> Copiar código Pix</Button>
          {order.auto
            ? <p className="small center pix-wait"><span className="spinner-inline" /> Esperando o pagamento... assim que cair, os pacotinhos aparecem sozinhos.</p>
            : (
              <>
                <Button block variant="green" busy={busy} onClick={paid}>Já paguei</Button>
                <p className="small muted center" style={{ margin: 0 }}>Depois que o pagamento for confirmado, os pacotinhos aparecem no topo do álbum.</p>
              </>
            )}
        </div>
      )}
    </Modal>
  );
}

const PAGE_OF = Object.fromEntries(data.pages.flatMap((p, i) => p.stickers.map((sid) => [sid, i])));

/**
 * Abrir pacotinho, do jeito de antigamente: a pessoa RASGA o pacote arrastando o dedo na borda de
 * cima, as figurinhas saem num montinho e ela vai passando uma por uma.
 */
function OpenPack({ album, onClose, onChanged, onGoPaste }) {
  const [left, setLeft] = useState(album.packs_unopened);
  const [phase, setPhase] = useState('sealed'); // sealed → torn → stack → done
  const [tear, setTear] = useState(0);
  const [cards, setCards] = useState([]);
  const [idx, setIdx] = useState(0);
  const [flying, setFlying] = useState(null);
  const [detail, setDetail] = useState(null);
  const req = useRef(null);
  const drag = useRef(null);
  const lastTick = useRef(0);

  const request = () => {
    if (!req.current) req.current = api.post(`/albuns/${album.id}/abrir`);
    return req.current;
  };
  const finishTear = async () => {
    setTear(1); setPhase('torn'); sfx('pop');
    try {
      const r = await request();
      setLeft(r.packs_unopened);
      onChanged();
      setTimeout(() => { setCards(r.cards); setIdx(0); setPhase('stack'); reveal(r.cards[0]); }, 750);
    } catch (e) { notify(e.message, 'error'); onClose(); }
  };
  const reveal = (c) => {
    if (!c) return;
    const s = BY_ID[c.id];
    sfx(c.isNew ? (s.rarity === 'lendaria' ? 'record' : 'coin') : 'flip');
  };
  const onDown = (e) => {
    if (phase !== 'sealed') return;
    unlockAudio();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, w: e.currentTarget.getBoundingClientRect().width };
    request();
  };
  const onMove = (e) => {
    if (!drag.current) return;
    const t = Math.min(1, Math.abs(e.clientX - drag.current.x) / (drag.current.w * 0.75));
    setTear(t);
    if (t - lastTick.current > 0.12) { lastTick.current = t; sfx('tap'); }
  };
  const onUp = () => {
    if (!drag.current) return;
    drag.current = null; lastTick.current = 0;
    if (tear >= 0.55) finishTear(); else setTear(0);
  };
  const next = (dir = 1) => {
    if (flying) return;
    setFlying(dir);
    setTimeout(() => {
      setFlying(null);
      const n = idx + 1;
      setIdx(n);
      if (n >= cards.length) setPhase('done'); else reveal(cards[n]);
    }, 380);
  };
  const again = () => { req.current = null; setCards([]); setIdx(0); setTear(0); setPhase('sealed'); };
  const newOnes = cards.filter((c) => c.isNew);
  const cur = cards[idx];
  const curSticker = cur && BY_ID[cur.id];

  return (
    <div className="pack-overlay" role="dialog" aria-modal="true">
      <button type="button" className="pack-close" onClick={onClose} aria-label="Fechar">✕</button>
      <div className="pack-stage">
        {(phase === 'sealed' || phase === 'torn') && (
          <>
            <p className="pack-hint">{phase === 'sealed' ? 'Arraste o dedo na borda de cima para rasgar' : 'Rasgou!'}</p>
            <div className={'op-pack' + (phase === 'torn' ? ' is-torn' : '')}>
              <div
                className="op-pack-top"
                style={{ transform: phase === 'torn' ? undefined : `rotate(${-tear * 14}deg) translate(${tear * 18}px, ${-tear * 10}px)` }}
                onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
              >
                <span className="op-pack-cut" style={{ width: `${tear * 100}%` }} />
              </div>
              <div className="op-pack-body">
                <span className="op-pack-star">★</span>
                <b>{data.name}</b>
                <small>{album.pack_size} figurinhas</small>
              </div>
              {phase === 'torn' && <div className="op-pack-peek" />}
            </div>
            {phase === 'sealed' && <button type="button" className="op-link" onClick={() => { unlockAudio(); request(); finishTear(); }}>ou toque aqui para rasgar</button>}
            <p className="pack-hint small">{left} pacotinho{left !== 1 ? 's' : ''} para abrir</p>
          </>
        )}

        {phase === 'stack' && cur && (
          <>
            <p className="pack-hint">{cur.isNew ? (curSticker.rarity === 'lendaria' ? 'LENDÁRIA!' : 'Nova!') : 'Repetida'}</p>
            <div className="op-stack" onClick={() => next(1)}>
              {cards.slice(idx + 1).map((c, k) => (
                <div key={k} className="op-under" style={{ transform: `translate(${(k + 1) * 5}px, ${(k + 1) * 6}px) rotate(${(k + 1) * 2.5}deg)` }}>
                  <StickerCard sticker={BY_ID[c.id]} size={190} state="back" />
                </div>
              ))}
              <div key={idx} className={'op-top' + (cur.isNew ? ' is-new' : ' is-rep') + (curSticker.rarity === 'lendaria' ? ' is-legend' : '') + (flying ? ' fly' : '')}>
                {cur.isNew && <span className="op-rays" />}
                <StickerCard sticker={curSticker} size={190} />
                {!cur.isNew && <span className="op-stamp">REPETIDA</span>}
                {cur.isNew && <span className="op-ribbon">NOVA</span>}
              </div>
            </div>
            <p className="pack-hint small">{curSticker.name} · {idx + 1} de {cards.length} — toque para ver a próxima</p>
          </>
        )}

        {phase === 'done' && (
          <>
            <p className="pack-hint">{newOnes.length ? `${newOnes.length} nova${newOnes.length > 1 ? 's' : ''} para colar!` : 'Só repetidas desta vez...'}</p>
            <div className="pack-cards">
              {cards.map((c, i) => <StickerCard key={i} sticker={BY_ID[c.id]} size={120} badge={c.isNew ? 'NOVA' : 'REPETIDA'} onClick={() => setDetail(BY_ID[c.id])} />)}
            </div>
            <div className="pack-actions">
              {newOnes.length > 0 && <Button onClick={() => onGoPaste(newOnes[0].id)}><Sparkles size={16} /> Colar no álbum</Button>}
              {left > 0 && <Button variant="secondary" onClick={again}><Package size={16} /> Abrir outro ({left})</Button>}
              <Button variant="secondary" onClick={onClose}>Fechar</Button>
              <p className="small pack-note">As repetidas foram para o monte de repetidas. Junte {REPEATS_FREE} e troque por um pacotinho.</p>
            </div>
          </>
        )}
      </div>
      {detail && <StickerModal sticker={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

/**
 * Colar a figurinha: escolhe na bandeja, descola o verso e arrasta até o espaço certo do álbum
 * (ou toca no espaço). Errou o lugar, ela volta para a mão.
 */
function PasteBar({ sid, peeled, onPeel, onCancel, onGoPage, onDropAt, page }) {
  const s = BY_ID[sid];
  const [ghost, setGhost] = useState(null);
  const target = useRef(null);
  const findSlot = (x, y) => document.elementsFromPoint(x, y).map((el) => el.closest?.('[data-slot]')).find(Boolean) || null;
  const down = (e) => {
    if (!peeled) { onPeel(); return; }
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setGhost({ x: e.clientX, y: e.clientY });
    sfx('tap');
  };
  const move = (e) => {
    if (!ghost) return;
    setGhost({ x: e.clientX, y: e.clientY });
    const el = findSlot(e.clientX, e.clientY);
    if (el !== target.current) {
      target.current?.classList.remove('is-hover');
      el?.classList.add('is-hover');
      target.current = el;
    }
  };
  const up = () => {
    if (!ghost) return;
    const el = target.current;
    el?.classList.remove('is-hover');
    target.current = null;
    setGhost(null);
    if (el) onDropAt(Number(el.dataset.slot), el);
  };
  const onRightPage = PAGE_OF[sid] === page;
  return (
    <>
      <div className="paste-bar">
        <div className={'paste-held' + (peeled ? ' peeled' : '') + (ghost ? ' lifted' : '')} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <StickerCard sticker={s} size={78} />
          {!peeled && <span className="paste-peel"><span>Descolar</span></span>}
        </div>
        <div className="paste-info">
          <b>#{s.id} · {s.name}</b>
          <small>{!peeled ? 'Toque para descolar o verso' : onRightPage ? 'Arraste até o espaço dela nesta página' : 'Procure a página dela no álbum'}</small>
          <div className="row" style={{ gap: '.35rem', marginTop: '.3rem' }}>
            {peeled && !onRightPage && <Button small onClick={onGoPage}>Achar a página</Button>}
            <Button small variant="secondary" onClick={onCancel}>Guardar</Button>
          </div>
        </div>
      </div>
      {ghost && (
        <div className="paste-ghost" style={{ left: ghost.x, top: ghost.y }}>
          <StickerCard sticker={s} size={104} />
        </div>
      )}
    </>
  );
}

const REPEATS_FREE = 20;

/** O Álbum Bíblico App. */
export function AlbumPage() {
  const { id } = useParams();
  const state = useLoad(() => api.get('/albuns/' + id), [id]);
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState('album');
  const [buy, setBuy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [detail, setDetail] = useState(null);
  const [sel, setSel] = useState(null);
  const [peeled, setPeeled] = useState(false);
  const [justStuck, setJustStuck] = useState(null);
  const [busy, run] = useAsync();
  const toPaste = useMemo(() => Object.entries(state.data?.stickers || {}).filter(([, v]) => !v.stuck).map(([k]) => Number(k)).sort((a, b) => a - b), [state.data]);
  // Colando: a barra de abas some e o álbum fica à vista, acima da figurinha na mão.
  useEffect(() => {
    document.body.classList.toggle('album-pasting-mode', !!sel);
    return () => document.body.classList.remove('album-pasting-mode');
  }, [sel]);
  useEffect(() => {
    if (!sel || !peeled) return;
    const el = document.querySelector('.album-page');
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' });
  }, [sel, peeled, page]);
  if (id !== 'biblico') return <Navigate to=".." replace />;

  const pick = (sid) => { unlockAudio(); setSel(sid); setPeeled(false); setTab('album'); sfx('tap'); };
  const peel = () => { sfx('flip'); setPeeled(true); };
  const pasteOne = async (sid) => {
    setSel(null); setPeeled(false);
    setJustStuck(sid);
    sfx('pop');
    state.setData((d) => ({ ...d, stickers: { ...d.stickers, [sid]: { ...d.stickers[sid], stuck: true } } }));
    setTimeout(() => setJustStuck(null), 1200);
    try {
      const r = await api.post(`/albuns/${id}/colar`, { ids: [sid] });
      if (r.completed) { sfx('record'); notify('Parabéns! Você completou o álbum! Seu trunfo especial está garantido.'); state.reload(); }
      else {
        const pg = data.pages[PAGE_OF[sid]];
        if (pg.stickers.every((x) => x === sid || state.data?.stickers[x]?.stuck)) { setTimeout(() => sfx('win'), 350); notify(`Página "${pg.title}" completa!`); }
      }
    } catch (e) { notify(e.message, 'error'); state.reload(); }
  };
  const dropAt = (slotId, el) => {
    if (slotId === sel) { pasteOne(sel); return; }
    sfx('error');
    el?.classList.add('is-wrong');
    setTimeout(() => el?.classList.remove('is-wrong'), 500);
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
          <div className={sel ? 'album-pasting' : ''}>
            <PageHeader title={a.name} subtitle={`${stuck} de ${a.total} figurinhas coladas`} />
            <div className="album-bar big"><span style={{ width: `${(stuck / a.total) * 100}%` }} /></div>
            {a.completed_at
              ? <Card className="album-done"><Trophy size={22} /> Álbum completo em {fmtDate(a.completed_at)}! Seu trunfo especial vai ser entregue pela equipe distrital ao diretor do seu clube.</Card>
              : <Card className="album-prize"><Trophy size={22} /><span>Complete o álbum e ganhe um <b>trunfo especial físico</b>, entregue pela equipe distrital ao diretor do seu clube.</span></Card>}

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
            {waiting.length > 0 && <Card className="small">Pedido{waiting.length > 1 ? 's' : ''} esperando o pagamento: {waiting.map((o) => `${o.packs} pacotinho${o.packs > 1 ? 's' : ''}`).join(', ')}. Assim que cair, aparece aqui.</Card>}

            {toPaste.length > 0 && (
              <Section title={`Para colar (${toPaste.length})`}>
                <p className="small muted" style={{ marginTop: '-.4rem' }}>Escolha uma figurinha, descole o verso e cole no lugar dela no álbum.</p>
                <div className="paste-row">
                  {toPaste.map((sid) => (
                    <div key={sid} className={'tray-card' + (sel === sid ? ' is-sel' : '')}>
                      <StickerCard sticker={BY_ID[sid]} size={84} onClick={() => pick(sid)} />
                    </div>
                  ))}
                </div>
              </Section>
            )}

            <Tabs tabs={[['album', 'Álbum'], ['repetidas', `Repetidas (${a.repeats})`], ['pedidos', 'Pedidos']]} value={tab} onChange={setTab} />
            {tab === 'album' && (
              <div className="album-page" key={page}>
                <div className="album-page-head">
                  <button type="button" className="icon-btn" disabled={page === 0} onClick={() => { setPage(page - 1); sfx('flip'); }} aria-label="Página anterior"><ChevronLeft /></button>
                  <div className="center"><small className="muted">Página {page + 1} de {data.pages.length}</small><b>{pg.title}</b></div>
                  <button type="button" className="icon-btn" disabled={page === data.pages.length - 1} onClick={() => { setPage(page + 1); sfx('flip'); }} aria-label="Próxima página"><ChevronRight /></button>
                </div>
                <div className="album-slots">
                  {pg.stickers.map((sid) => {
                    const s = BY_ID[sid];
                    const mine = a.stickers[sid];
                    if (mine?.stuck) {
                      return (
                        <div key={sid} className={'slot-wrap' + (justStuck === sid ? ' just-stuck' : '')}>
                          <StickerCard sticker={s} size={104} onClick={() => setDetail(s)} />
                          {justStuck === sid && <span className="stuck-shine" />}
                        </div>
                      );
                    }
                    return (
                      <div key={sid} data-slot={sid} className={'slot-wrap slot-empty' + (sel === sid && peeled ? ' is-target' : '')}
                        onClick={() => sel && peeled && dropAt(sid, document.querySelector(`[data-slot="${sid}"]`))}>
                        <StickerCard sticker={s} size={104} state="empty" />
                      </div>
                    );
                  })}
                </div>
                <div className="album-dots">
                  {data.pages.map((p, i) => {
                    const done = p.stickers.every((sid) => a.stickers[sid]?.stuck);
                    return <button key={i} type="button" className={(i === page ? 'on ' : '') + (done ? 'done' : '')} onClick={() => { setPage(i); sfx('flip'); }} aria-label={`Página ${i + 1}`} />;
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

            {sel && a.stickers[sel] && !a.stickers[sel].stuck && (
              <PasteBar sid={sel} peeled={peeled} page={page} onPeel={peel} onCancel={() => { setSel(null); setPeeled(false); }}
                onGoPage={() => { setPage(PAGE_OF[sel]); sfx('flip'); }} onDropAt={dropAt} />
            )}
            {buy && <BuyModal album={a} onClose={() => setBuy(false)} onDone={state.reload} onOpen={() => setOpening(true)} />}
            {opening && <OpenPack album={a} onClose={() => { setOpening(false); state.reload(); }} onChanged={state.reload}
              onGoPaste={(sid) => { setOpening(false); state.reload(); pick(sid); }} />}
            {detail && <StickerModal sticker={detail} onClose={() => setDetail(null)} />}
          </div>
        );
      }}
    </Loading>
  );
}
