import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { ContentIcon } from '../ui.jsx';

/** Agrupa classes (regulares por idade, de liderança) ou especialidades (por área). */
export function groupCatalog(type, items) {
  const groups = new Map();
  for (const c of items) {
    const g = type === 'classe' ? (c.leader ? 'Classes de liderança' : 'Classes regulares e avançadas') : c.category || 'Outras';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(c);
  }
  return [...groups.entries()];
}

/** Insígnia/foto do item do catálogo (ou o ícone da área, se ainda não tiver foto). */
export const CatalogBadge = ({ c, size = 48 }) => (
  <span className="cat-badge" style={{ width: size, height: size }}><ContentIcon c={c} size={Math.round(size * 0.5)} /></span>
);

/**
 * Lista do catálogo com busca, filtro por área e seleção múltipla.
 * locked: ids que não podem ser marcados (já tem / já pediu), com o motivo.
 */
export default function CatalogPicker({ type, items, selected, onChange, locked = {} }) {
  const [q, setQ] = useState('');
  const [area, setArea] = useState('');
  const groups = useMemo(() => groupCatalog(type, items), [type, items]);
  const nq = q.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const match = (c) => !nq || c.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(nq) || (c.code || '').toLowerCase().includes(nq);
  const toggle = (id) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    onChange(s);
  };
  const shown = groups
    .filter(([g]) => !area || g === area)
    .map(([g, list]) => [g, list.filter(match)])
    .filter(([, list]) => list.length);
  return (
    <div className="cat-picker">
      <div className="cat-search"><Search size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={type === 'classe' ? 'Buscar classe' : 'Buscar especialidade ou código'} /></div>
      {type === 'especialidade' && (
        <div className="cat-areas">
          <button type="button" className={!area ? 'on' : ''} onClick={() => setArea('')}>Todas</button>
          {groups.map(([g, list]) => <button key={g} type="button" className={area === g ? 'on' : ''} onClick={() => setArea(g)}>{g} <small>{list.length}</small></button>)}
        </div>
      )}
      {shown.map(([g, list]) => (
        <section key={g} className="cat-group">
          <h3>{g}</h3>
          <div className="cat-grid">
            {list.map((c) => {
              const lock = locked[c.id];
              const on = selected.has(c.id);
              return (
                <button key={c.id} type="button" className={'cat-item' + (on ? ' on' : '') + (lock ? ' locked' : '')} disabled={!!lock} onClick={() => toggle(c.id)}>
                  <CatalogBadge c={c} size={56} />
                  <span className="cat-name">{c.name}</span>
                  {c.age ? <small>{c.age} anos</small> : c.code ? <small>{c.code}</small> : null}
                  {lock && <small className="cat-lock">{lock}</small>}
                  {on && <span className="cat-check"><Check size={14} strokeWidth={3} /></span>}
                </button>
              );
            })}
          </div>
        </section>
      ))}
      {!shown.length && <p className="muted center">Nada encontrado.</p>}
    </div>
  );
}
