// Álbuns de figurinhas: lista, o Álbum Bíblico (comprar, abrir, colar, trocar repetidas)
// e o Palmares 27 (em breve).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Gift, Heart, Package, Repeat, ShoppingCart, Sparkles, Trophy } from 'lucide-react';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { fmtDate } from '../../format.js';
import { Badge, Button, Card, Loading, Modal, PageHeader, Section, Tabs, notify, useAsync, useLoad } from '../../ui.jsx';
import { sfx, unlockAudio } from '../games/audio.js';
import { StickerCard } from './StickerArt.jsx';
import { PixCheckout, money } from '../Payment.jsx';
import { clearPasteQueue, pasteQueue, queuePaste, saveAlbum, savedAlbum, useOnline } from '../../offline.js';
import { AlbumCover, BibleEmblem } from './AlbumCover.jsx';
import data from './biblico.json';
import './albums.css';

const PALMARES_LOGO = '/img/distrito-palmares.png';
const BY_ID = Object.fromEntries(data.stickers.map((s) => [s.id, s]));
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
                <div className="album-cover-art"><AlbumCover variant="biblico" width={110} /></div>
                <div className="album-info">
                  <h2>{a.name}</h2>
                  <div className="album-bar"><span style={{ width: `${(a.stuck / a.total) * 100}%` }} /></div>
                  <p className="small">{a.stuck} de {a.total} coladas{a.packs_unopened ? <> · <b>{a.packs_unopened} pacotinho{a.packs_unopened > 1 ? 's' : ''} para abrir</b></> : ''}</p>
                  {a.completed_at && <Badge kind="green">Completo!</Badge>}
                </div>
              </Link>
            ) : (
              <div key={a.id} className="album-card is-soon">
                <div className="album-cover-art"><AlbumCover variant="palmares27" width={110} logo={PALMARES_LOGO} /></div>
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

/** Recado na compra: o dinheiro ajuda o app a se manter (não vai para distrito nem clube). */
function SupportNote() {
  return (
    <div className="support-note">
      <Heart size={18} />
      <span>Além da diversão e da nostalgia, você ajuda o <b>App do DBV</b> a se manter e a ganhar novas atualizações. Quem completa o álbum ganha um <b>trunfo especial físico</b>!</span>
    </div>
  );
}


/**
 * Comprar pacotinhos: escolhe a quantidade e paga no Pix sem sair do app (nada de CPF ou outros
 * dados). Com a SyncPay ligada, libera sozinho quando o Pix cai.
 */
function BuyModal({ album, onClose, onDone, onOpen }) {
  const [order, setOrder] = useState(null);
  const [paid, setPaid] = useState(null);
  const [busy, run] = useAsync();
  const create = async (n) => {
    const o = await run(() => api.post(`/albuns/${album.id}/pedidos`, { packs: n }), null);
    if (o) setOrder(o);
  };
  const title = paid ? 'Pagamento confirmado!' : order ? 'Pague com Pix' : 'Comprar pacotinhos';
  return (
    <Modal title={title} onClose={onClose}>
      {!order && (
        <>
          <p className="small muted" style={{ marginTop: 0 }}>Cada pacotinho tem {album.pack_size} figurinhas e custa {money(album.price_cents)}.</p>
          <SupportNote />
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
      {order && !paid && (
        <PixCheckout payment={order} onPaid={(o) => { sfx('win'); setPaid(o); onDone(); }} onNotified={() => { onDone(); onClose(); }}>
          <SupportNote />
        </PixCheckout>
      )}
      {paid && (
        <div className="pix-box center">
          <Sparkles size={44} style={{ color: 'var(--yellow)', margin: '0 auto' }} />
          <p><b>{paid.ref.packs} pacotinho{paid.ref.packs > 1 ? 's' : ''}</b> já estão no seu álbum.</p>
          <Button block onClick={() => { onClose(); onOpen(); }}><Package size={16} /> Abrir agora</Button>
          <Button block variant="secondary" onClick={onClose}>Depois</Button>
        </div>
      )}
    </Modal>
  );
}

const PAGE_OF = Object.fromEntries(data.pages.flatMap((p, i) => p.stickers.map((sid) => [sid, i])));

/**
 * Abrir pacotinho: a pessoa RASGA o pacote arrastando o dedo na borda de cima; as 6 figurinhas
 * saem voando e ficam viradas para baixo. Ela vira uma por uma (as raras brilham pelo verso).
 */
function OpenPack({ album, onClose, onChanged, onGoPaste }) {
  const [left, setLeft] = useState(album.packs_unopened);
  const [phase, setPhase] = useState('sealed'); // sealed → torn → cards
  const [tear, setTear] = useState(0);
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const flippedRef = useRef([]);
  const [detail, setDetail] = useState(null);
  const req = useRef(null);
  const drag = useRef(null);
  const lastTick = useRef(0);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

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
      later(() => { flippedRef.current = r.cards.map(() => false); setCards(r.cards); setFlipped(flippedRef.current); setPhase('cards'); sfx('shoot'); }, 650);
    } catch (e) { notify(e.message, 'error'); onClose(); }
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
  const flip = (i) => {
    if (flippedRef.current[i]) return;
    flippedRef.current = flippedRef.current.map((v, k) => v || k === i);
    setFlipped(flippedRef.current);
    const c = cards[i];
    later(() => sfx(c.isNew ? (BY_ID[c.id].rarity === 'lendaria' ? 'record' : 'coin') : 'flip'), 260);
  };
  const flipAll = () => cards.forEach((_, i) => later(() => flip(i), i * 260));
  const again = () => { req.current = null; flippedRef.current = []; setCards([]); setFlipped([]); setTear(0); setPhase('sealed'); };
  const allFlipped = cards.length > 0 && flipped.every(Boolean);
  const newOnes = cards.filter((c) => c.isNew);

  return (
    <div className="pack-overlay" role="dialog" aria-modal="true">
      <button type="button" className="pack-close" onClick={onClose} aria-label="Fechar">✕</button>
      <div className="pack-stage">
        {phase !== 'cards' && (
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
                <BibleEmblem size={86} />
                <b>{data.name}</b>
                <small>{album.pack_size} figurinhas</small>
              </div>
              {phase === 'torn' && <div className="op-pack-burst" />}
            </div>
            {phase === 'sealed' && <button type="button" className="op-link" onClick={() => { unlockAudio(); request(); finishTear(); }}>ou toque aqui para rasgar</button>}
            <p className="pack-hint small">{left} pacotinho{left !== 1 ? 's' : ''} para abrir</p>
          </>
        )}

        {phase === 'cards' && (
          <>
            <p className="pack-hint">{allFlipped ? (newOnes.length ? `${newOnes.length} nova${newOnes.length > 1 ? 's' : ''} para colar!` : 'Só repetidas desta vez...') : 'Toque nas figurinhas para virar'}</p>
            <div className="op-grid">
              {cards.map((c, i) => {
                const st = BY_ID[c.id];
                return (
                  <div key={i} className={`op-slot op-r-${st.rarity}` + (flipped[i] ? ' is-open' : '') + (flipped[i] && c.isNew ? ' is-new' : '') + (flipped[i] && !c.isNew ? ' is-rep' : '')}
                    style={{ '--i': i }} onClick={() => (flipped[i] ? setDetail(st) : flip(i))}>
                    <div className="stk-flip" style={{ width: 100, height: 136 }}>
                      <div className={'stk-flip-inner' + (flipped[i] ? ' is-flipped' : '')}>
                        <div className="stk-flip-front"><StickerCard sticker={st} size={100} state="back" /></div>
                        <div className="stk-flip-back"><StickerCard sticker={st} size={100} /></div>
                      </div>
                    </div>
                    {flipped[i] && c.isNew && <><span className="op-burst" /><span className="op-tag new">NOVA</span></>}
                    {flipped[i] && !c.isNew && <span className="op-tag rep">REPETIDA</span>}
                  </div>
                );
              })}
            </div>
            <div className="pack-actions">
              {!allFlipped && <Button variant="secondary" onClick={flipAll}>Virar todas</Button>}
              {allFlipped && newOnes.length > 0 && <Button onClick={() => onGoPaste(newOnes[0].id)}><Sparkles size={16} /> Colar no álbum</Button>}
              {allFlipped && left > 0 && <Button variant="secondary" onClick={again}><Package size={16} /> Abrir outro ({left})</Button>}
              {allFlipped && <Button variant="secondary" onClick={onClose}>Fechar</Button>}
              {allFlipped && <p className="small pack-note">As repetidas foram para o monte. Junte {album.repeats_per_free_pack} e troque por um pacotinho.</p>}
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

/** O Álbum Bíblico. */
/**
 * Carrega o álbum: com internet, primeiro envia o que foi colado sem internet e guarda uma cópia
 * no aparelho; sem internet, usa a cópia guardada.
 */
async function loadAlbum(id, offlineSession) {
  if (offlineSession) {
    // Entrou sem internet: até entrar de verdade de novo, usa só a cópia guardada.
    const saved = savedAlbum(id);
    if (saved) return { ...saved, offline: true };
  }
  try {
    const q = pasteQueue(id);
    if (q.length) { await api.post(`/albuns/${id}/colar`, { ids: q }); clearPasteQueue(id); }
    const d = await api.get('/albuns/' + id);
    saveAlbum(id, d);
    return d;
  } catch (e) {
    const saved = e.offline && savedAlbum(id);
    if (saved) return { ...saved, offline: true };
    if (e.offline) throw new Error('Sem internet. Abra o álbum uma vez com internet para poder usar sem internet depois.');
    throw e;
  }
}

export function AlbumPage() {
  const { id } = useParams();
  const online = useOnline();
  const { actor } = useAuth();
  const offlineSession = !!actor?.offline;
  const state = useLoad(() => loadAlbum(id, offlineSession), [id, online, offlineSession]);
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState('album');
  const [buy, setBuy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [detail, setDetail] = useState(null);
  const [sel, setSel] = useState(null);
  const [peeled, setPeeled] = useState(false);
  const [justStuck, setJustStuck] = useState(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [opening2, setOpening2] = useState(false);
  const [turn, setTurn] = useState('');
  const swipe = useRef(null);
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

  const pick = (sid) => { unlockAudio(); setSel(sid); setPeeled(false); setTab('album'); setBookOpen(true); sfx('tap'); };
  const goPage = (n) => {
    if (n < 0 || n >= data.pages.length || n === page) return;
    setTurn(n > page ? 'next' : 'prev');
    setPage(n);
    sfx('flip');
  };
  const openBook = () => { unlockAudio(); setOpening2(true); sfx('flip'); setTimeout(() => { setBookOpen(true); setOpening2(false); }, 750); };
  const closeBook = () => { setBookOpen(false); setTurn(''); sfx('flip'); };
  const swipeStart = (e) => { swipe.current = { x: e.clientX, y: e.clientY }; };
  const swipeEnd = (e) => {
    const s0 = swipe.current; swipe.current = null;
    if (!s0) return;
    const dx = e.clientX - s0.x; const dy = e.clientY - s0.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) goPage(page + (dx < 0 ? 1 : -1));
  };
  const peel = () => { sfx('flip'); setPeeled(true); };
  const pasteOne = async (sid) => {
    setSel(null); setPeeled(false);
    setJustStuck(sid);
    sfx('pop');
    state.setData((d) => ({ ...d, stickers: { ...d.stickers, [sid]: { ...d.stickers[sid], stuck: true } } }));
    setTimeout(() => setJustStuck(null), 1200);
    // Sem internet: cola aqui e envia quando a internet voltar.
    if (!online || state.data?.offline) { queuePaste(id, sid); return; }
    try {
      const r = await api.post(`/albuns/${id}/colar`, { ids: [sid] });
      if (r.completed) { sfx('record'); notify('Parabéns! Você completou o álbum! Seu trunfo especial está garantido.'); state.reload(); }
      else {
        const pg = data.pages[PAGE_OF[sid]];
        if (pg.stickers.every((x) => x === sid || state.data?.stickers[x]?.stuck)) { setTimeout(() => sfx('win'), 350); notify(`Página "${pg.title}" completa!`); }
      }
    } catch (e) {
      if (e.offline) queuePaste(id, sid);
      else { notify(e.message, 'error'); state.reload(); }
    }
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
        const off = !online || a.offline;
        return (
          <div className={sel ? 'album-pasting' : ''}>
            <PageHeader title={a.name} subtitle={`${stuck} de ${a.total} figurinhas coladas`} />
            <div className="album-bar big"><span style={{ width: `${(stuck / a.total) * 100}%` }} /></div>
            {a.completed_at
              ? <Card className="album-done"><Trophy size={22} /> Álbum completo em {fmtDate(a.completed_at)}! Seu trunfo especial vai ser entregue pela equipe distrital ao diretor do seu clube.</Card>
              : <Card className="album-prize"><Trophy size={22} /><span>Complete o álbum e ganhe um <b>trunfo especial físico</b>, entregue pela equipe distrital ao diretor do seu clube.</span></Card>}

            <div className="album-top">
              <button type="button" className={'album-packs' + (a.packs_unopened && !off ? ' has' : '')} disabled={!a.packs_unopened || off} onClick={() => setOpening(true)}>
                <Package size={30} />
                <span><b>{a.packs_unopened}</b> pacotinho{a.packs_unopened !== 1 ? 's' : ''}</span>
                <small>{off ? 'Abrir precisa de internet' : a.packs_unopened ? 'Toque para abrir' : 'Nenhum para abrir'}</small>
              </button>
              <div className="album-side">
                <Button block disabled={off} onClick={() => setBuy(true)}><ShoppingCart size={16} /> Comprar</Button>
                <Button block variant="secondary" disabled={off || a.repeats < a.repeats_per_free_pack || busy} onClick={trade}>
                  <Gift size={16} /> Trocar {a.repeats_per_free_pack} repetidas
                </Button>
                <span className="small muted center"><Repeat size={12} /> {a.repeats} repetida{a.repeats !== 1 ? 's' : ''}</span>
              </div>
            </div>
            {off && <Card className="small offline-note">Sem internet: dá para ver o álbum e colar as figurinhas que você já tem. Abrir pacotinhos e comprar precisam de internet. O que você colar agora é salvo quando a internet voltar.</Card>}

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
            {tab === 'album' && !bookOpen && (
              <div className="book-closed">
                <button type="button" className={'book-cover-btn' + (opening2 ? ' is-opening' : '')} onClick={openBook} aria-label="Abrir o álbum">
                  <AlbumCover variant="biblico" width={240} />
                </button>
                <p className="small muted center">{opening2 ? 'Abrindo...' : 'Toque na capa para abrir o álbum'}</p>
              </div>
            )}
            {tab === 'album' && bookOpen && (
              <div className="book">
                <div className="book-bar">
                  <button type="button" className="book-close" onClick={closeBook}><BibleEmblem size={22} /> Fechar álbum</button>
                  <span className="small muted">{stuck}/{a.total}</span>
                </div>
                <div className="book-stage" onPointerDown={swipeStart} onPointerUp={swipeEnd}>
                  <div className={'album-page' + (turn ? ` turn-${turn}` : '')} key={page}>
                    <div className="album-page-head">
                      <button type="button" className="icon-btn" disabled={page === 0} onClick={() => goPage(page - 1)} aria-label="Página anterior"><ChevronLeft /></button>
                      <div className="center"><small>Página {page + 1} de {data.pages.length}</small><b>{pg.title}</b></div>
                      <button type="button" className="icon-btn" disabled={page === data.pages.length - 1} onClick={() => goPage(page + 1)} aria-label="Próxima página"><ChevronRight /></button>
                    </div>
                    <div className="album-slots">
                      {pg.stickers.map((sid) => {
                        const st = BY_ID[sid];
                        const mine = a.stickers[sid];
                        if (mine?.stuck) {
                          return (
                            <div key={sid} className={'slot-wrap' + (justStuck === sid ? ' just-stuck' : '')}>
                              <StickerCard sticker={st} size={100} onClick={() => setDetail(st)} />
                              {justStuck === sid && <span className="stuck-shine" />}
                            </div>
                          );
                        }
                        return (
                          <div key={sid} data-slot={sid} className={'slot-wrap slot-empty' + (sel === sid && peeled ? ' is-target' : '')}
                            onClick={() => sel && peeled && dropAt(sid, document.querySelector(`[data-slot="${sid}"]`))}>
                            <StickerCard sticker={st} size={100} state="empty" />
                          </div>
                        );
                      })}
                    </div>
                    <span className="page-num">{page + 1}</span>
                  </div>
                </div>
                <div className="album-dots">
                  {data.pages.map((p, i) => {
                    const done = p.stickers.every((sid) => a.stickers[sid]?.stuck);
                    return <button key={i} type="button" className={(i === page ? 'on ' : '') + (done ? 'done' : '')} onClick={() => goPage(i)} aria-label={`Página ${i + 1}`} />;
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
                    {o.status === 'aberto' && <Button small variant="secondary" onClick={() => run(() => api.post(`/pagamentos/${o.id}/cancelar`), 'Pedido cancelado').then(state.reload)}>Cancelar</Button>}
                  </div>
                ))}
              </div>
            )}

            {sel && a.stickers[sel] && !a.stickers[sel].stuck && (
              <PasteBar sid={sel} peeled={peeled} page={page} onPeel={peel} onCancel={() => { setSel(null); setPeeled(false); }}
                onGoPage={() => goPage(PAGE_OF[sel])} onDropAt={dropAt} />
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
