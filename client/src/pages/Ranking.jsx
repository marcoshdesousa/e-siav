import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Compass, Flag, Map as MapIcon, Tent } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Avatar, Field, Loading, PageHeader, Section, Tabs, useLoad, Empty } from '../ui.jsx';

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
          <Wrap key={r.id} r={r} className={'rank-row' + (highlight === r.id ? ' me' : '')}>
            <span className="rank-pos">{r.position}º</span>
            <Avatar src={r.photo || r.logo} name={r.name} size={38} square={avatarSquare} />
            <div className="grow">
              <div className="title ellipsis" style={{ fontWeight: 800 }}>{r.name}</div>
              {sub && <div className="sub muted small ellipsis">{sub(r)}</div>}
              <BibleTag r={r} />
            </div>
            <span className="rank-pts">{r.points} <small>pts</small></span>
          </Wrap>
        ))}
      </div>
    </>
  );
}

/**
 * Não há ranking de todos os distritos: o usuário vê o do seu distrito (e, para pessoas, o do clube).
 * O Administrador Geral escolhe o distrito.
 */
function DistrictFilter({ value, onChange, withClub }) {
  const { actor, meta } = useAuth();
  const mine = meta.districts.find((d) => d.id === actor.district_id);
  if (actor.type !== 'admin') {
    if (!withClub) return mine ? <span className="muted small"><MapIcon size={13} /> {mine.name}</span> : null;
    return (
      <div className="seg" role="tablist">
        <button type="button" className={value === 'clube' ? 'active' : ''} onClick={() => onChange('clube')}>Meu clube</button>
        <button type="button" className={value !== 'clube' ? 'active' : ''} onClick={() => onChange(null)}>{mine?.name || 'Distrito'}</button>
      </div>
    );
  }
  return (
    <select value={value || meta.districts[0]?.id || ''} onChange={(e) => onChange(Number(e.target.value))} style={{ width: 'auto' }}>
      {meta.districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
    </select>
  );
}

const SUBTITLE = {
  clube: 'Desbravadores do seu clube · requisitos do clube + Leitura bíblica',
  membros: 'Desbravadores do distrito · requisitos do Distrito + Leitura bíblica',
  lideranca_clube: 'Liderança do seu clube · requisitos do clube + Leitura bíblica',
  lideranca: 'Liderança do distrito · requisitos do Distrito + Leitura bíblica',
  unidades: 'Unidades do distrito · requisitos do Distrito + Leitura bíblica',
  clubes: 'Clubes do distrito · requisitos do Distrito + Leitura bíblica',
};

function GeneralRanking({ kind, base, highlight }) {
  const { actor } = useAuth();
  const people = kind === 'membros' || kind === 'lideranca';
  const withClub = people && !!actor.club_id;
  const [district, setDistrict] = useState(withClub ? 'clube' : null);
  const url = { membros: '/rankings/members', lideranca: '/rankings/leaders', unidades: '/rankings/units', clubes: '/rankings/clubs' }[kind];
  const clubUrl = kind === 'lideranca' ? 'leaders' : 'members';
  // null = o distrito do usuário (o servidor decide); o administrador escolhe um distrito.
  const state = useLoad(
    () => (district === 'clube' ? api.get(`/rankings/club/${actor.club_id}/${clubUrl}`) : api.get(url + (district ? `?district_id=${district}` : ''))),
    [kind, district],
  );
  const props = {
    membros: { sub: (r) => r.club_name, link: (r) => `${base}/ver/membro/${r.code}`, avatarSquare: false },
    lideranca: { sub: (r) => r.club_name, link: (r) => `${base}/ver/membro/${r.code}`, avatarSquare: false },
    unidades: { sub: (r) => r.club_name, link: (r) => `${base}/ver/unidade/${r.id}` },
    clubes: { sub: (r) => r.district_name, link: (r) => `${base}/ver/clube/${r.id}` },
  }[kind];
  return (
    <>
      <div className="rank-tools">
        <span className="muted small">{SUBTITLE[district === 'clube' ? (kind === 'lideranca' ? 'lideranca_clube' : 'clube') : kind]}</span>
        <DistrictFilter value={district} onChange={setDistrict} withClub={withClub} />
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
export default function RankingHub({ base }) {
  const { actor } = useAuth();
  const summary = useLoad(() => (actor.type === 'admin' ? Promise.resolve(null) : api.get('/rankings/summary')));
  const adminClubs = useLoad(() => (actor.type === 'admin' ? api.get('/admin/clubs') : Promise.resolve([])));
  const [adminClub, setAdminClub] = useState(null);
  const clubId = actor.type === 'admin' ? adminClub ?? adminClubs.data?.[0]?.id : actor.club_id;
  const myUnit = actor.type === 'unit' ? actor.id : actor.unit_id;
  const isLeader = actor.type === 'member' && actor.kind === 'lideranca';
  const tabs = [
    ['membros', 'Desbravadores'],
    ['lideranca', 'Liderança'],
    ...(clubId ? [['clube', 'Unidades']] : []),
    ['unidades', 'Unidades do distrito'],
    ['clubes', 'Clubes'],
  ];
  const [tab, setTab] = useState(isLeader ? 'lideranca' : actor.type === 'member' ? 'membros' : actor.type === 'unit' ? 'clube' : actor.type === 'club' ? 'clubes' : 'membros');
  const highlight = { membros: actor.type === 'member' ? actor.id : null, lideranca: actor.type === 'member' ? actor.id : null, clube: myUnit, unidades: myUnit, clubes: clubId }[tab];

  return (
    <>
      <PageHeader title="Ranking" subtitle="Do seu distrito e do seu clube · cada dia do Ano Bíblico concluído vale pontos" />
      {summary.data && (
        <div className="pos-grid">
          {actor.type === 'member' && (
            actor.kind === 'desbravador'
              ? <>
                <SummaryCard gold icon={<Compass size={16} />} title="Eu no meu clube" pos={summary.data.member_club} onClick={() => setTab('membros')} />
                <SummaryCard gold icon={<MapIcon size={16} />} title="Eu no distrito" pos={summary.data.member} onClick={() => setTab('membros')} />
              </>
              : <>
                <SummaryCard gold icon={<Compass size={16} />} title="Eu no meu clube" pos={summary.data.leader_club} onClick={() => setTab('lideranca')} />
                <SummaryCard gold icon={<MapIcon size={16} />} title="Eu no distrito" pos={summary.data.leader} onClick={() => setTab('lideranca')} />
              </>
          )}
          {summary.data.unit && <SummaryCard icon={<Flag size={16} />} title={`${summary.data.unit.name} no clube`} pos={summary.data.unit.club} onClick={() => setTab('clube')} />}
          {summary.data.unit && <SummaryCard icon={<MapIcon size={16} />} title={`${summary.data.unit.name} no distrito`} pos={summary.data.unit.general} onClick={() => setTab('unidades')} />}
          {summary.data.club && <SummaryCard icon={<Tent size={16} />} title="Meu clube no distrito" pos={summary.data.club.position ? summary.data.club : null} onClick={() => setTab('clubes')} />}
        </div>
      )}
      <Section>
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
        {tab === 'clube' && actor.type === 'admin' && (
          <Field label="Clube">
            <select value={clubId || ''} onChange={(e) => setAdminClub(Number(e.target.value))}>
              {(adminClubs.data || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
        {tab === 'clube' && actor.type !== 'admin' && <div className="rank-tools"><span className="muted small">Unidades do seu clube · requisitos do clube + Leitura bíblica</span></div>}
        {tab === 'clube' ? clubId && <ClubUnitsRanking clubId={clubId} base={base} highlight={highlight} /> : <GeneralRanking kind={tab} base={base} highlight={highlight} />}
      </Section>
    </>
  );
}
