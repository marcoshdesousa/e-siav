import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Minus } from 'lucide-react';
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

/**
 * Escolha de destinatários: clube → unidade → pessoas, com "selecionar todos".
 * value: { clubs: Set, units: Set, members: Set }.
 * allowGroups: permite marcar o próprio clube/unidade como destinatário (medalhas, eventos).
 */
export default function PeoplePicker({ directory, value, onChange, allowClubs = false, allowUnits = false, filterMember }) {
  const [open, setOpen] = useState({});
  const [q, setQ] = useState('');
  const toggleOpen = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const clubs = useMemo(() => (directory || []).map((c) => {
    const keep = (m) => (!filterMember || filterMember(m)) && (!q || m.name.toLowerCase().includes(q.toLowerCase()) || (m.handle || '').includes(q.toLowerCase().replace(/^@/, '')));
    const units = c.units.map((u) => ({ ...u, members: u.members.filter(keep) }));
    const noUnit = c.no_unit.filter(keep);
    const allIds = [...units.flatMap((u) => u.members.map((m) => m.id)), ...noUnit.map((m) => m.id)];
    return { ...c, units, noUnit, allIds };
  }), [directory, q, filterMember]);

  const setMembers = (ids, on) => {
    const members = new Set(value.members);
    ids.forEach((id) => (on ? members.add(id) : members.delete(id)));
    onChange({ ...value, members });
  };
  const toggleIn = (key, id) => {
    const s = new Set(value[key]);
    s.has(id) ? s.delete(id) : s.add(id);
    onChange({ ...value, [key]: s });
  };
  const everyone = clubs.flatMap((c) => c.allIds);
  const total = value.members.size + (allowClubs ? value.clubs.size : 0) + (allowUnits ? value.units.size : 0);

  return (
    <div className="pp">
      <div className="pp-top">
        <input placeholder="Buscar pessoa por nome ou @" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="pp-all">
          <Box state={stateOf(everyone, value.members)} label="Selecionar todas as pessoas" onClick={() => setMembers(everyone, stateOf(everyone, value.members) !== 'on')} />
          Todas as pessoas
        </label>
      </div>
      <Loading data={directory} loading={!directory} error={null}>
        {() => clubs.map((c) => {
          const cs = stateOf(c.allIds, value.members);
          const isOpen = open['c' + c.id] ?? clubs.length === 1;
          return (
            <div key={c.id} className="pp-club">
              <div className="pp-row pp-club-row">
                <Box state={cs} label={`Selecionar todos do ${c.name}`} onClick={() => setMembers(c.allIds, cs !== 'on')} />
                <button type="button" className="pp-name" onClick={() => toggleOpen('c' + c.id)}>
                  <Avatar src={c.logo} name={c.name} size={34} square />
                  <span className="grow"><b>{c.name}</b><small>{c.allIds.length} pessoas</small></span>
                  {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </button>
              </div>
              {isOpen && (
                <div className="pp-children">
                  {allowClubs && (
                    <label className="pp-row pp-group">
                      <Box state={value.clubs.has(c.id) ? 'on' : 'off'} label="O próprio clube" onClick={() => toggleIn('clubs', c.id)} />
                      <span>O próprio clube <small>(aparece no perfil do clube)</small></span>
                    </label>
                  )}
                  {[...c.units, ...(c.noUnit.length ? [{ id: 'none-' + c.id, name: 'Sem unidade', members: c.noUnit, virtual: true }] : [])].map((u) => {
                    if (!u.members.length && !(allowUnits && !u.virtual && !u.is_leadership)) return null;
                    const ids = u.members.map((m) => m.id);
                    const us = stateOf(ids, value.members);
                    const uOpen = open['u' + u.id] ?? !!q;
                    return (
                      <div key={u.id} className="pp-unit">
                        <div className="pp-row">
                          <Box state={us} label={`Selecionar todos da unidade ${u.name}`} onClick={() => setMembers(ids, us !== 'on')} />
                          <button type="button" className="pp-name" onClick={() => toggleOpen('u' + u.id)}>
                            <Avatar src={u.logo} name={u.name} size={28} square />
                            <span className="grow"><b>{u.virtual ? u.name : 'Unidade ' + u.name}</b><small>{ids.length} pessoas</small></span>
                            {uOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        </div>
                        {uOpen && (
                          <div className="pp-children">
                            {allowUnits && !u.virtual && !u.is_leadership && (
                              <label className="pp-row pp-group">
                                <Box state={value.units.has(u.id) ? 'on' : 'off'} label="A própria unidade" onClick={() => toggleIn('units', u.id)} />
                                <span>A própria unidade <small>(aparece no perfil da unidade)</small></span>
                              </label>
                            )}
                            {u.members.map((m) => (
                              <label key={m.id} className="pp-row pp-person">
                                <Box state={value.members.has(m.id) ? 'on' : 'off'} label={m.name} onClick={() => toggleIn('members', m.id)} />
                                <Avatar src={m.photo} name={m.name} size={30} />
                                <span className="grow"><b>{m.name}</b><small>{m.cargo}{m.handle ? ' · @' + m.handle : ''}</small></span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </Loading>
      <div className="pp-count">{total} selecionado{total === 1 ? '' : 's'}</div>
    </div>
  );
}

export const emptySelection = () => ({ clubs: new Set(), units: new Set(), members: new Set() });
