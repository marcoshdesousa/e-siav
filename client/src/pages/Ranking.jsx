import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Compass, Flag, Globe2, Tent } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Avatar, Field, Loading, PageHeader, Section, Tabs, useLoad, Empty } from '../ui.jsx';

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
            </div>
            <span className="rank-pts">{r.points} <small>pts</small></span>
          </Wrap>
        ))}
      </div>
    </>
  );
}

/** Distrito do usuário ou todos. O administrador escolhe qualquer distrito. */
function DistrictFilter({ value, onChange }) {
  const { actor, meta } = useAuth();
  const mine = meta.districts.find((d) => d.id === actor.district_id);
  if (mine) {
    return (
      <div className="seg" role="tablist">
        <button type="button" className={value === mine.id ? 'active' : ''} onClick={() => onChange(mine.id)}>{mine.name}</button>
        <button type="button" className={value === null ? 'active' : ''} onClick={() => onChange(null)}>Todos</button>
      </div>
    );
  }
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} style={{ width: 'auto' }}>
      <option value="">Todos os distritos</option>
      {meta.districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
    </select>
  );
}

const SUBTITLE = {
  membros: 'Desbravadores · pontos dos requisitos gerais',
  unidades: 'Unidades de todos os clubes · requisitos gerais',
  clubes: 'Clubes · requisitos gerais de clube',
};

function GeneralRanking({ kind, base, highlight }) {
  const { actor } = useAuth();
  const [district, setDistrict] = useState(actor.district_id ?? null);
  const url = { membros: '/rankings/members', unidades: '/rankings/units', clubes: '/rankings/clubs' }[kind];
  const state = useLoad(() => api.get(url + (district ? `?district_id=${district}` : '')), [kind, district]);
  const props = {
    membros: { sub: (r) => r.club_name, link: (r) => `${base}/ver/membro/${r.code}`, avatarSquare: false },
    unidades: { sub: (r) => r.club_name, link: (r) => `${base}/ver/unidade/${r.id}` },
    clubes: { sub: (r) => r.district_name, link: (r) => `${base}/ver/clube/${r.id}` },
  }[kind];
  return (
    <>
      <div className="rank-tools">
        <span className="muted small">{SUBTITLE[kind]}</span>
        <DistrictFilter value={district} onChange={setDistrict} />
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
      <span className="pos-card-pts">{pos ? `${pos.points} pontos` : 'Sem posição ainda'}</span>
    </button>
  );
}

/**
 * Aba Ranking. O membro vê de uma vez a sua posição, a da sua unidade e a do seu clube,
 * e pode abrir cada tabela completa. Não existe ranking de liderança.
 */
export default function RankingHub({ base }) {
  const { actor } = useAuth();
  const summary = useLoad(() => (actor.type === 'admin' ? Promise.resolve(null) : api.get('/rankings/summary')));
  const adminClubs = useLoad(() => (actor.type === 'admin' ? api.get('/admin/clubs') : Promise.resolve([])));
  const [adminClub, setAdminClub] = useState(null);
  const clubId = actor.type === 'admin' ? adminClub ?? adminClubs.data?.[0]?.id : actor.club_id;
  const myUnit = actor.type === 'unit' ? actor.id : actor.unit_id;
  const tabs = [
    ['membros', 'Membros'],
    ...(clubId ? [['clube', 'Unidades']] : []),
    ['unidades', 'Unidades gerais'],
    ['clubes', 'Clubes'],
  ];
  const [tab, setTab] = useState(actor.type === 'member' ? 'membros' : actor.type === 'unit' ? 'clube' : actor.type === 'club' ? 'clubes' : 'membros');
  const highlight = { membros: actor.type === 'member' ? actor.id : null, clube: myUnit, unidades: myUnit, clubes: clubId }[tab];

  return (
    <>
      <PageHeader title="Ranking" subtitle="Atualizado automaticamente a cada envio pontuado" />
      {summary.data && (
        <div className="pos-grid">
          {actor.type === 'member' && (
            actor.kind === 'desbravador'
              ? <SummaryCard gold icon={<Compass size={16} />} title="Minha posição" pos={summary.data.member} onClick={() => setTab('membros')} />
              : <div className="pos-card muted small">A liderança não participa do ranking individual.</div>
          )}
          {summary.data.unit && <SummaryCard icon={<Flag size={16} />} title={`${summary.data.unit.name} no clube`} pos={summary.data.unit.club} onClick={() => setTab('clube')} />}
          {summary.data.unit && <SummaryCard icon={<Globe2 size={16} />} title={`${summary.data.unit.name} no geral`} pos={summary.data.unit.general} onClick={() => setTab('unidades')} />}
          {summary.data.club && <SummaryCard icon={<Tent size={16} />} title="Meu clube" pos={summary.data.club.position ? summary.data.club : null} onClick={() => setTab('clubes')} />}
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
        {tab === 'clube' && actor.type !== 'admin' && <div className="rank-tools"><span className="muted small">Unidades do seu clube · requisitos do clube</span></div>}
        {tab === 'clube' ? clubId && <ClubUnitsRanking clubId={clubId} base={base} highlight={highlight} /> : <GeneralRanking kind={tab} base={base} highlight={highlight} />}
      </Section>
    </>
  );
}
