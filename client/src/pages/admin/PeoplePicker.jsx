import { useMemo, useState } from 'react';
import { Check, Minus, Search, Tent, Flag } from 'lucide-react';
import { Avatar, Loading } from '../../ui.jsx';

/** Caixinha com três estados: marcada, parcial (alguns) e vazia. */
function Box({ state, onClick, label }) {
  return (
    <button type="button" className={'pp-box ' + state} onClick={onClick} aria-label={label} aria-pressed={state === 'on'}>
      {state === 'on' ? <Check size={14} strokeWidth={3} /> : state === 'some' ? <Minus size={14} strokeWidth={3} /> : null}
    </button>
  );
}

const stateOf = (ids, set) => {
  if (!ids.length) return 'off';
  const n = ids.filter((id) => set.has(id)).length;
  return n === 0 ? 'off' : n === ids.length ? 'on' : 'some';
};

const plain = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Escolha de destinatários com filtros: distrito → clube → unidade → tipo → busca.
 * Mostra só quem passa nos filtros; "Selecionar todos" marca a lista filtrada.
 * value: { clubs: Set, units: Set, members: Set }.
 * allowClubs / allowUnits: permite marcar o próprio clube/unidade (medalhas, eventos).
 */
export default function PeoplePicker({ directory, value, onChange, allowClubs = false, allowUnits = false }) {
  const [district, setDistrict] = useState('');
  const [clubId, setClubId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');

  const clubsAll = directory || [];
  const districts = useMemo(() => [...new Map(clubsAll.map((c) => [c.district_id, c.district_name])).entries()], [clubsAll]);
  const clubs = clubsAll.filter((c) => !district || String(c.district_id) === district);
  const club = clubs.find((c) => String(c.id) === clubId);

  const people = useMemo(() => {
    const out = [];
    for (const c of clubs) {
      if (clubId && String(c.id) !== clubId) continue;
      const groups = [...c.units.map((u) => [u, u.members]), [{ id: 'none', name: 'Sem unidade', virtual: true }, c.no_unit]];
      for (const [u, members] of groups) {
        if (unitId && String(u.id) !== unitId) continue;
        for (const m of members) {
          if (kind && m.kind !== kind) continue;
          if (q && !plain(m.name).includes(plain(q)) && !(m.handle || '').includes(plain(q).replace(/^@/, ''))) continue;
          out.push({ ...m, club: c, unit: u });
        }
      }
    }
    return out;
  }, [clubs, clubId, unitId, kind, q]);

  const ids = people.map((m) => m.id);
  const allState = stateOf(ids, value.members);
  const setMembers = (list, on) => {
    const members = new Set(value.members);
    list.forEach((id) => (on ? members.add(id) : members.delete(id)));
    onChange({ ...value, members });
  };
  const toggleIn = (key, id) => {
    const s = new Set(value[key]);
    s.has(id) ? s.delete(id) : s.add(id);
    onChange({ ...value, [key]: s });
  };
  const unit = club?.units.find((u) => String(u.id) === unitId);
  const total = value.members.size + (allowClubs ? value.clubs.size : 0) + (allowUnits ? value.units.size : 0);

  // Agrupa a lista filtrada por clube e unidade para leitura.
  const sections = [];
  for (const m of people) {
    const key = m.club.id + '-' + m.unit.id;
    let sec = sections.find((x) => x.key === key);
    if (!sec) sections.push((sec = { key, title: `${m.club.name} · ${m.unit.virtual ? 'Sem unidade' : 'Unidade ' + m.unit.name}`, list: [] }));
    sec.list.push(m);
  }

  return (
    <Loading data={directory} loading={!directory} error={null}>
      {() => (
        <div className="pp">
          <div className="pp-filters">
            <select value={district} onChange={(e) => { setDistrict(e.target.value); setClubId(''); setUnitId(''); }} aria-label="Distrito">
              <option value="">Todos os distritos</option>
              {districts.map(([id, name]) => <option key={id} value={String(id)}>{name}</option>)}
            </select>
            <select value={clubId} onChange={(e) => { setClubId(e.target.value); setUnitId(''); }} aria-label="Clube">
              <option value="">Todos os clubes</option>
              {clubs.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </select>
            <select value={unitId} onChange={(e) => setUnitId(e.target.value)} disabled={!club} aria-label="Unidade">
              <option value="">{club ? 'Todas as unidades' : 'Escolha um clube'}</option>
              {club?.units.map((u) => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
              {club && <option value="none">Sem unidade</option>}
            </select>
            <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Tipo de membro">
              <option value="">Desbravadores e liderança</option>
              <option value="desbravador">Só desbravadores</option>
              <option value="lideranca">Só liderança</option>
            </select>
          </div>
          <div className="cat-search"><Search size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou @" /></div>

          {(allowClubs && club) || (allowUnits && unit && !unit.is_leadership) ? (
            <div className="pp-groups">
              {allowClubs && club && (
                <label className="pp-row pp-group"><Box state={value.clubs.has(club.id) ? 'on' : 'off'} label="O próprio clube" onClick={() => toggleIn('clubs', club.id)} />
                  <Tent size={16} /> <span>Entregar também ao clube <b>{club.name}</b></span></label>
              )}
              {allowUnits && unit && !unit.is_leadership && (
                <label className="pp-row pp-group"><Box state={value.units.has(unit.id) ? 'on' : 'off'} label="A própria unidade" onClick={() => toggleIn('units', unit.id)} />
                  <Flag size={16} /> <span>Entregar também à unidade <b>{unit.name}</b></span></label>
              )}
            </div>
          ) : null}

          <div className="pp-bar">
            <label className="pp-all"><Box state={allState} label="Selecionar todos da lista" onClick={() => setMembers(ids, allState !== 'on')} /> Selecionar todos ({ids.length})</label>
            {value.members.size > 0 && <button type="button" className="ig-link" onClick={() => onChange({ ...value, members: new Set() })}>Limpar</button>}
          </div>

          <div className="pp-list">
            {sections.map((sec) => (
              <div key={sec.key}>
                <div className="pp-sec">{sec.title}</div>
                {sec.list.map((m) => (
                  <label key={m.id} className={'pp-row pp-person' + (value.members.has(m.id) ? ' on' : '')}>
                    <Box state={value.members.has(m.id) ? 'on' : 'off'} label={m.name} onClick={() => toggleIn('members', m.id)} />
                    <Avatar src={m.photo} name={m.name} size={32} />
                    <span className="grow"><b>{m.name}</b><small>{m.cargo}{m.handle ? ' · @' + m.handle : ''}</small></span>
                  </label>
                ))}
              </div>
            ))}
            {!people.length && <p className="muted center small">Ninguém com esses filtros.</p>}
          </div>
          <div className="pp-count">{total} selecionado{total === 1 ? '' : 's'}</div>
        </div>
      )}
    </Loading>
  );
}

export const emptySelection = () => ({ clubs: new Set(), units: new Set(), members: new Set() });
