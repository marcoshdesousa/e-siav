import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Compass, Flag, Globe, Map as MapIcon, PauseCircle, Tent } from 'lucide-react';
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
      <Loading {...state}>{(rows) => <RankingTable rows={rows} highlight={highlight} {...props} />}</Loading>
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
/** Ranking pausado (para apuração) e, para o administrador geral, o controle da pausa. */
function RankingPause() {
  const { actor } = useAuth();
  const state = useLoad(() => api.get('/rankings/estado'));
  const [at, setAt] = useState('');
  const [busy, run] = useAsync();
  const general = actor.type === 'admin' && !actor.district_id;
  const s = state.data;
  if (!s) return null;
  const br = (iso) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const save = (v) => run(() => api.put('/admin/ranking/pausa', { at: v }), v ? 'Pausa marcada' : 'Ranking retomado').then(state.reload);
  return (
    <>
      {s.paused && <div className="rank-paused"><PauseCircle size={18} /><span><b>Ranking pausado</b> desde {br(s.paused_at)} para a apuração dos vencedores. Os pontos depois disso aparecem quando o ranking voltar.</span></div>}
      {general && (
        <Card className="rank-pause-admin">
          <p style={{ margin: 0 }}><b>Pausar o ranking</b> <span className="small muted">· só você vê isto</span></p>
          <p className="small muted" style={{ margin: '.2rem 0 .5rem' }}>
            {s.paused_at ? (s.paused ? `Pausado desde ${br(s.paused_at)}.` : `Pausa marcada para ${br(s.paused_at)}.`) : 'O ranking está contando normalmente.'}
            {' '}Todo 1º de janeiro o ranking e o Ano Bíblico recomeçam do zero{s.start ? ` (temporada desde ${new Date(s.start).toLocaleDateString('pt-BR')})` : ''}.
          </p>
          <div className="row wrap">
            <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} style={{ width: 'auto' }} />
            <Button small busy={busy} disabled={!at} onClick={() => save(new Date(at).toISOString())}>Marcar pausa</Button>
            <Button small variant="secondary" busy={busy} onClick={() => save(new Date().toISOString())}>Pausar agora</Button>
            {s.paused_at && <Button small variant="secondary" busy={busy} onClick={() => save(null)}>Retomar</Button>}
          </div>
        </Card>
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
