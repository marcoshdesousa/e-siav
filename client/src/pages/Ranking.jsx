import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Compass, Flag, Globe, Map as MapIcon, Medal, PauseCircle, Plus, Tent, Trophy as TrophyIco } from 'lucide-react';
import { Trophy } from '../trophies.jsx';
import TrophyStudio from './TrophyStudio.jsx';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Avatar, Button, Card, Field, Loading, PageHeader, Section, Tabs, useAsync, useLoad, Empty } from '../ui.jsx';

/** Pontos da Leitura bíblica (Ano Bíblico) que entram no total. */
const BibleTag = ({ r }) => (r.bible_points > 0
  ? <span className="small muted ellipsis" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><BookOpen size={12} /> Leitura bíblica: {r.bible_points} pts</span>
  : null);

/** Tabela de ranking com pódio para os três primeiros. */
export function RankingTable({ rows, highlight, sub, link, avatarSquare = true }) {
  if (!rows.length) return <Empty icon="trophy">Ainda sem participantes.</Empty>;
  const top = rows.slice(0, 3);
  const order = [top[1], top[0], top[2]];
  const Wrap = ({ r, children, className }) => (link ? <Link to={link(r)} className={className}>{children}</Link> : <div className={className}>{children}</div>);
  return (
    <>
      <div className="podium">
        {order.map((r, i) =>
          r ? (
            <Wrap key={r.id} r={r} className={`podium-col podium-${r.position}`}>
              <Avatar src={r.photo || r.logo} name={r.name} size={r.position === 1 ? 64 : 52} square={avatarSquare} />
              <span className="name">{r.name}</span>
              {sub && <span className="sub ellipsis">{sub(r)}</span>}
              <div className="podium-step">
                <span className="medal-num">{r.position}º</span>
                <small>{r.points} pts</small>
              </div>
            </Wrap>
          ) : <div key={'e' + i} />,
        )}
      </div>
      <div className="list">
        {rows.map((r) => (
          <Fragment key={r.id}>
          {r.extra && <div className="rank-gap">Só os 50 primeiros aparecem · a sua posição:</div>}
          <Wrap r={r} className={'rank-row' + (highlight === r.id || r.extra ? ' me' : '')}>
            <span className="rank-pos">{r.position}º</span>
            <Avatar src={r.photo || r.logo} name={r.name} size={38} square={avatarSquare} />
            <div className="grow">
              <div className="title ellipsis" style={{ fontWeight: 800 }}>{r.name}</div>
              {sub && <div className="sub muted small ellipsis">{sub(r)}</div>}
              <BibleTag r={r} />
            </div>
            <span className="rank-pts">{r.points} <small>pts</small></span>
          </Wrap>
          </Fragment>
        ))}
      </div>
    </>
  );
}

/**
 * Nível do ranking: Clube (pessoas e unidades do meu clube), Distrito e Brasil (todo mundo do app).
 * O Administrador Geral escolhe o distrito quando está em Distrito.
 */
function ScopeFilter({ value, onChange, withClub, district, onDistrict }) {
  const { actor, meta } = useAuth();
  const mine = meta.districts.find((d) => d.id === actor.district_id);
  // App Brasil (conta sem clube): só o ranking Brasil.
  if (actor.app) return <div className="rank-scope"><div className="seg" role="tablist"><button type="button" className="active">Brasil</button></div></div>;
  const opts = [...(withClub ? [['clube', 'Meu clube']] : []), ['distrito', actor.type === 'admin' ? 'Distrito' : mine?.name || 'Distrito'], ['brasil', 'Brasil']];
  return (
    <div className="rank-scope">
      <div className="seg" role="tablist">
        {opts.map(([k, l]) => <button key={k} type="button" className={value === k ? 'active' : ''} onClick={() => onChange(k)}>{l}</button>)}
      </div>
      {actor.type === 'admin' && value === 'distrito' && (
        <select value={district || meta.districts[0]?.id || ''} onChange={(e) => onDistrict(Number(e.target.value))} style={{ width: 'auto' }}>
          {meta.districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      )}
    </div>
  );
}

const WHO = { membros: 'Desbravadores', lideranca: 'Liderança', unidades: 'Unidades', clubes: 'Clubes' };
const subtitle = (kind, scope) => (scope === 'clube'
  ? `${WHO[kind]} do seu clube · requisitos do clube + Leitura bíblica`
  : scope === 'brasil'
    ? `${WHO[kind]} de todo o Brasil · requisitos gerais + Leitura bíblica`
    : `${WHO[kind]} do distrito · requisitos do Distrito + Leitura bíblica`);

function GeneralRanking({ kind, base, highlight, clubId }) {
  const { actor } = useAuth();
  // O administrador vê o "clube" só nas unidades (escolhe o clube acima da tabela).
  const withClub = kind !== 'clubes' && !!clubId && !actor.app && (actor.type !== 'admin' || kind === 'unidades');
  const [scope, setScope] = useState(actor.app ? 'brasil' : withClub ? 'clube' : 'distrito');
  const [district, setDistrict] = useState(null);
  const url = { membros: '/rankings/members', lideranca: '/rankings/leaders', unidades: '/rankings/units', clubes: '/rankings/clubs' }[kind];
  const clubUrl = { membros: 'members', lideranca: 'leaders', unidades: 'units' }[kind];
  const state = useLoad(
    () => (scope === 'clube'
      ? api.get(`/rankings/club/${clubId}/${clubUrl}`).then((d) => (Array.isArray(d) ? d : d.rows))
      : api.get(url + (scope === 'brasil' ? '?escopo=brasil' : district ? `?district_id=${district}` : ''))),
    [kind, scope, district, clubId],
  );
  const { meta } = useAuth();
  // Situação da tabela (aberta, ou finalizada esperando ser criada).
  const distId = district || actor.district_id || meta.districts[0]?.id;
  const est = useLoad(() => api.get('/rankings/estado' + (actor.type === 'admin' && !actor.district_id && scope === 'distrito' ? `?district_id=${distId}` : '')), [scope, distId]);
  const key = scope === 'clube' ? `club:${clubId}` : scope === 'distrito' ? `district:${distId}` : 'brasil';
  const table = est.data?.scopes.find((x) => x.key === key)?.tables?.[kind];
  const placeName = scope === 'clube' ? 'do clube' : scope === 'distrito' ? 'do distrito' : 'do Brasil';
  const where = (r) => (scope === 'brasil' && r.district_name ? `${r.club_name} · ${r.district_name}` : r.club_name);
  const props = {
    membros: { sub: where, link: (r) => `${base}/ver/membro/${r.link}`, avatarSquare: false },
    lideranca: { sub: where, link: (r) => `${base}/ver/membro/${r.link}`, avatarSquare: false },
    unidades: { sub: (r) => (scope === 'clube' ? null : where(r)), link: (r) => `${base}/ver/unidade/${r.id}` },
    clubes: { sub: (r) => r.district_name, link: (r) => `${base}/ver/clube/${r.id}` },
  }[kind];
  return (
    <>
      <div className="rank-tools">
        <ScopeFilter value={scope} onChange={setScope} withClub={withClub} district={district} onDistrict={setDistrict} />
        <span className="muted small">{subtitle(kind, scope)}</span>
      </div>
      {table && !table.open
        ? <ClosedRanking table={table} kind={kind} where={placeName} />
        : <Loading {...state}>{(rows) => <RankingTable rows={rows} highlight={highlight} {...props} />}</Loading>}
    </>
  );
}

export function ClubUnitsRanking({ clubId, base, highlight }) {
  const state = useLoad(() => api.get(`/rankings/club/${clubId}/units`), [clubId]);
  return (
    <Loading {...state}>
      {(d) => <RankingTable rows={d.rows} highlight={highlight} link={(r) => `${base}/ver/unidade/${r.id}`} />}
    </Loading>
  );
}

function SummaryCard({ icon, title, pos, onClick, gold }) {
  return (
    <button type="button" className={'pos-card' + (gold ? ' gold' : '')} onClick={onClick}>
      <span className="pos-card-top">{icon}<span className="ellipsis">{title}</span></span>
      <span className="pos-card-num">{pos ? `${pos.position}º` : '—'}</span>
      <span className="pos-card-pts">{pos ? `${pos.points} pontos${pos.bible_points ? ` · ${pos.bible_points} da Leitura bíblica` : ''}` : 'Sem posição ainda'}</span>
    </button>
  );
}

/**
 * Aba Ranking. O membro vê de uma vez a sua posição, a da sua unidade e a do seu clube,
 * e pode abrir cada tabela completa. Desbravadores e liderança têm rankings separados.
 */
const TABLE_NAME = { membros: 'Desbravadores', lideranca: 'Liderança', unidades: 'Unidades', clubes: 'Clubes' };
const TROPHY_TITLE = { membros: 'Melhor Desbravador', lideranca: 'Melhor Líder', unidades: 'Melhor Unidade', clubes: 'Melhor Clube' };
const brDate = (iso) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

/** Ranking finalizado e ainda não criado de novo (ou nunca criado): mostra o último pódio. */
function ClosedRanking({ table, kind, where }) {
  const last = table.last;
  return (
    <Card className="rank-closed">
      {last ? (
        <>
          <span className="rank-closed-kicker">Ranking finalizado em {brDate(last.finished_at)}</span>
          <b className="rank-closed-title">{last.design?.title || TROPHY_TITLE[kind]} · {last.year}</b>
          <div className="rank-closed-podium">
            {[2, 1, 3].map((p) => {
              const w = last.podium.find((x) => x.position === p);
              return (
                <div key={p} className={`rank-closed-place p${p}`}>
                  <Trophy design={last.design} pos={p} size={p === 1 ? 84 : 64} />
                  <span className="ellipsis">{w ? w.name : '—'}</span>
                  {w && <small>{w.points} pts</small>}
                </div>
              );
            })}
          </div>
        </>
      ) : <b className="rank-closed-title">Ranking ainda não criado</b>}
      <p className="small muted">O novo ranking de {TABLE_NAME[kind].toLowerCase()} {where} ainda não foi criado. Quando for criado, quem já fez estudos e requisitos desde então entra com os pontos.</p>
    </Card>
  );
}

/**
 * Para quem cuida do ranking: pausar, finalizar cada tabela (personalizando o troféu) e criar o novo.
 * O clube cuida dos rankings do clube, o administrador do distrito do distrito e o geral do Brasil e
 * de qualquer distrito (e finaliza os mini-jogos). Para todos: o aviso de ranking pausado.
 */
function RankingPause() {
  const { actor, meta } = useAuth();
  const general = actor.type === 'admin' && !actor.district_id;
  const canControl = actor.type === 'club' || actor.type === 'admin';
  const [target, setTarget] = useState('brasil');
  const state = useLoad(() => api.get('/rankings/estado' + (general && target !== 'brasil' ? `?district_id=${target}` : '')), [target]);
  const [at, setAt] = useState('');
  const [busy, run] = useAsync();
  const [studio, setStudio] = useState(null);
  const s = state.data;
  if (!s) return null;
  const br = (iso) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const myKey = actor.type === 'club' ? `club:${actor.id}` : actor.type === 'admin' && actor.district_id ? `district:${actor.district_id}` : target === 'brasil' ? 'brasil' : `district:${target}`;
  const cur = s.scopes.find((x) => x.key === myKey) || { key: myKey, tables: {} };
  const name = actor.type === 'club' ? 'do clube' : actor.type === 'admin' && actor.district_id ? `do ${actor.district_name || 'distrito'}` : target === 'brasil' ? 'do Brasil' : `do ${meta.districts.find((d) => String(d.id) === String(target))?.name || 'distrito'}`;
  const where = general ? (target === 'brasil' ? { scope: 'brasil' } : { district_id: target }) : {};
  const act = (action, when) => run(() => api.put('/ranking/controle', { action, at: when, ...where }),
    { pause: 'Pausa marcada', resume: 'Ranking retomado' }[action]).then(state.reload);
  const finish = (design) => {
    const st = studio;
    const url = st.kind === 'jogos' ? '/admin/jogos/finalizar' : '/ranking/finalizar';
    return run(() => api.post(url, { kind: st.kind, design, ...where }), st.kind === 'jogos' ? 'Jogos finalizados: medalhas entregues' : 'Ranking finalizado: troféus e certificados entregues')
      .then(() => { setStudio(null); state.reload(); });
  };
  const create = (kind) => run(() => api.post('/ranking/criar', { kind, ...where }), kind ? 'Ranking criado' : 'Rankings criados').then(state.reload);
  const paused = s.scopes.filter((x) => x.paused && (actor.type !== 'admin' || x.key === myKey));
  const tables = Object.entries(cur.tables || {});
  return (
    <>
      {paused.map((x) => (
        <div key={x.key} className="rank-paused"><PauseCircle size={18} /><span><b>Ranking {x.key === 'brasil' ? 'do Brasil' : x.key.startsWith('club') ? 'do clube' : 'do distrito'} pausado</b> desde {br(x.paused_at)} para a apuração dos vencedores. Os pontos depois disso aparecem quando o ranking voltar.</span></div>
      ))}
      {canControl && (
        <Card className="rank-admin">
          <div className="rank-admin-head">
            <span className="rank-admin-ico"><TrophyIco size={20} /></span>
            <div className="grow"><b>Rankings {name}</b><small>Finalize cada ranking quando quiser: você personaliza o troféu e os 3 primeiros ganham o troféu e o certificado.</small></div>
          </div>
          {general && (
            <select value={target} onChange={(e) => setTarget(e.target.value)} style={{ width: 'auto', margin: '.2rem 0 .5rem' }}>
              <option value="brasil">Brasil (todos)</option>
              {meta.districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
          <div className="rank-tables">
            {tables.map(([kind, t]) => (
              <div key={kind} className={'rank-table' + (t.open ? '' : ' closed')}>
                <div className="grow">
                  <b>{TABLE_NAME[kind]}</b>
                  <small>{t.open ? (t.finished_at ? `Aberto · recomeçou em ${brDate(t.finished_at)}` : 'Aberto') : t.finished_at ? `Finalizado em ${brDate(t.finished_at)} · esperando criar` : 'Ainda não criado'}</small>
                </div>
                {t.open
                  ? <Button small variant="secondary" busy={busy} onClick={() => setStudio({ kind })}><TrophyIco size={14} /> Finalizar</Button>
                  : <Button small busy={busy} onClick={() => create(kind)}><Plus size={14} /> Criar ranking</Button>}
              </div>
            ))}
          </div>
          {tables.filter(([, t]) => !t.open).length > 1 && <Button small block busy={busy} onClick={() => create()} style={{ marginTop: '.5rem' }}><Plus size={14} /> Criar todos</Button>}
          <details className="rank-pause-box">
            <summary>Pausar o ranking {name}</summary>
            <p className="small muted" style={{ margin: '.3rem 0 .5rem' }}>
              {cur.paused_at ? (cur.paused ? `Pausado desde ${br(cur.paused_at)}.` : `Pausa marcada para ${br(cur.paused_at)}.`) : 'Contando normalmente.'} Pausado, o ranking fica parado para você conferir quem ganhou antes de finalizar.
            </p>
            <div className="row wrap">
              <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} style={{ width: 'auto' }} />
              <Button small busy={busy} disabled={!at} onClick={() => act('pause', new Date(at).toISOString())}>Marcar pausa</Button>
              <Button small variant="secondary" busy={busy} onClick={() => act('pause', new Date().toISOString())}>Pausar agora</Button>
              {cur.paused_at && <Button small variant="secondary" busy={busy} onClick={() => act('resume')}>Retomar</Button>}
            </div>
          </details>
          {general && (
            <div className="rank-table games">
              <div className="grow"><b>Mini-jogos (todos)</b><small>Os 3 primeiros de cada jogo no Brasil ganham uma medalha e os jogos recomeçam do zero.</small></div>
              <Button small variant="secondary" busy={busy} onClick={() => setStudio({ kind: 'jogos' })}><Medal size={14} /> Finalizar jogos</Button>
            </div>
          )}
        </Card>
      )}
      {studio && (
        <TrophyStudio
          mode={studio.kind === 'jogos' ? 'medalha' : 'trofeu'}
          heading={studio.kind === 'jogos' ? 'Finalizar os mini-jogos' : `Finalizar: ${TABLE_NAME[studio.kind]} ${name}`}
          title={studio.kind === 'jogos' ? 'Campeão dos Jogos' : TROPHY_TITLE[studio.kind]}
          info={studio.kind === 'jogos' ? 'Personalize a medalha. Todos os jogos são finalizados juntos e recomeçam do zero.' : `Personalize o troféu. ${cur.key === 'brasil' ? 'O ranking do Brasil recomeça na hora.' : 'Depois de finalizar, crie o novo ranking quando quiser.'}`}
          busy={busy}
          onClose={() => setStudio(null)}
          onConfirm={finish}
        />
      )}
    </>
  );
}

export default function RankingHub({ base }) {
  const { actor } = useAuth();
  const summary = useLoad(() => (actor.type === 'admin' ? Promise.resolve(null) : api.get('/rankings/summary')));
  const adminClubs = useLoad(() => (actor.type === 'admin' ? api.get('/admin/clubs').then((l) => l.filter((c) => !c.is_app)) : Promise.resolve([])));
  const [adminClub, setAdminClub] = useState(null);
  const clubId = actor.type === 'admin' ? adminClub ?? adminClubs.data?.[0]?.id : actor.club_id;
  const myUnit = actor.type === 'unit' ? actor.id : actor.unit_id;
  const isLeader = actor.type === 'member' && actor.kind === 'lideranca';
  const tabs = [['membros', 'Desbravadores'], ['lideranca', 'Liderança'], ['unidades', 'Unidades'], ['clubes', 'Clubes']];
  const [tab, setTab] = useState(isLeader ? 'lideranca' : actor.type === 'member' ? 'membros' : actor.type === 'unit' ? 'unidades' : actor.type === 'club' ? 'clubes' : 'membros');
  const highlight = { membros: actor.type === 'member' ? actor.id : null, lideranca: actor.type === 'member' ? actor.id : null, unidades: myUnit, clubes: clubId }[tab];

  return (
    <>
      <PageHeader title="Ranking" subtitle="Do seu clube, do seu distrito e do Brasil · estudo feito no dia certo vale mais pontos" />
      <RankingPause />
      {summary.data?.app && (
        <div className="pos-grid">
          <SummaryCard gold icon={<Globe size={16} />} title="Eu no Brasil" pos={actor.kind === 'desbravador' ? summary.data.member_brasil : summary.data.leader_brasil} onClick={() => setTab(isLeader ? 'lideranca' : 'membros')} />
        </div>
      )}
      {summary.data && !summary.data.app && (
        <div className="pos-grid">
          {actor.type === 'member' && (
            actor.kind === 'desbravador'
              ? <>
                <SummaryCard gold icon={<Compass size={16} />} title="Eu no meu clube" pos={summary.data.member_club} onClick={() => setTab('membros')} />
                <SummaryCard gold icon={<MapIcon size={16} />} title="Eu no distrito" pos={summary.data.member} onClick={() => setTab('membros')} />
                <SummaryCard gold icon={<Globe size={16} />} title="Eu no Brasil" pos={summary.data.member_brasil} onClick={() => setTab('membros')} />
              </>
              : <>
                <SummaryCard gold icon={<Compass size={16} />} title="Eu no meu clube" pos={summary.data.leader_club} onClick={() => setTab('lideranca')} />
                <SummaryCard gold icon={<MapIcon size={16} />} title="Eu no distrito" pos={summary.data.leader} onClick={() => setTab('lideranca')} />
                <SummaryCard gold icon={<Globe size={16} />} title="Eu no Brasil" pos={summary.data.leader_brasil} onClick={() => setTab('lideranca')} />
              </>
          )}
          {summary.data.unit && <SummaryCard icon={<Flag size={16} />} title={`${summary.data.unit.name} no clube`} pos={summary.data.unit.club} onClick={() => setTab('unidades')} />}
          {summary.data.unit && <SummaryCard icon={<MapIcon size={16} />} title={`${summary.data.unit.name} no distrito`} pos={summary.data.unit.general} onClick={() => setTab('unidades')} />}
          {summary.data.unit && <SummaryCard icon={<Globe size={16} />} title={`${summary.data.unit.name} no Brasil`} pos={summary.data.unit.brasil} onClick={() => setTab('unidades')} />}
          {summary.data.club && <SummaryCard icon={<Tent size={16} />} title="Meu clube no distrito" pos={summary.data.club.position ? summary.data.club : null} onClick={() => setTab('clubes')} />}
          {summary.data.club && <SummaryCard icon={<Globe size={16} />} title="Meu clube no Brasil" pos={summary.data.club.brasil} onClick={() => setTab('clubes')} />}
        </div>
      )}
      <Section>
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
        {tab === 'unidades' && actor.type === 'admin' && (
          <Field label="Clube">
            <select value={clubId || ''} onChange={(e) => setAdminClub(Number(e.target.value))}>
              {(adminClubs.data || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
        <GeneralRanking key={tab} kind={tab} base={base} highlight={highlight} clubId={clubId} />
      </Section>
    </>
  );
}
