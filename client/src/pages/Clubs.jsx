import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { plural } from '../format.js';
import { ChevronRight, Search, Trophy } from 'lucide-react';
import { Avatar, Field, Loading, PageHeader, useLoad } from '../ui.jsx';

/** Busca de clube pelo número (1º, 2º...), pelo código (4 números) ou pelo nome. */
function ClanSearch({ base }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  useEffect(() => {
    if (!q.trim()) { setResults(null); return undefined; }
    const t = setTimeout(() => api.get('/public/clubs/search?q=' + encodeURIComponent(q.trim())).then(setResults).catch(() => setResults([])), 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <>
      <div className="cat-search"><Search size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar clube: número, código ou nome" /></div>
      {results && (
        <div className="list mt">
          {results.map((c) => (
            <Link key={c.id} to={`${base}/ver/clube/${c.id}`} className="list-item">
              <Avatar src={c.logo} name={c.name} size={48} square />
              <div className="grow"><div className="title">{c.name}</div><div className="sub">Código {c.code} · {c.district_name}</div></div>
              <ChevronRight className="chev" size={20} />
            </Link>
          ))}
          {!results.length && <p className="muted small center">Nenhum clube encontrado.</p>}
        </div>
      )}
    </>
  );
}

/** Aba Clubes: pesquisa ou escolhe o distrito e abre o perfil de um clube. */
export default function ClubsBrowser({ base }) {
  const districts = useLoad(() => api.get('/public/districts'));
  const [district, setDistrict] = useState(null);
  useEffect(() => {
    if (!district && districts.data?.length) setDistrict(districts.data[0].id);
  }, [districts.data, district]);
  const clubs = useLoad(() => (district ? api.get(`/public/districts/${district}/clubs`) : Promise.resolve([])), [district]);

  return (
    <>
      <PageHeader title="Clubes" subtitle="Pesquise pelo número, pelo código ou pelo nome" />
      <ClanSearch base={base} />
      <h2 className="mt" style={{ marginBottom: '.5rem' }}>Por distrito</h2>
      <Loading {...districts}>
        {(ds) => (
          <Field label="Distrito">
            <select value={district || ''} onChange={(e) => setDistrict(Number(e.target.value))}>
              {ds.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.club_count})</option>)}
            </select>
          </Field>
        )}
      </Loading>
      <div className="mt">
        <Loading {...clubs} empty="Nenhum clube neste distrito.">
          {(list) => (
            <div className="list">
              {list.map((c) => (
                <Link key={c.id} to={`${base}/ver/clube/${c.id}`} className="list-item">
                  <Avatar src={c.logo} name={c.name} size={52} square />
                  <div className="grow">
                    <div className="title">{c.name}</div>
                    <div className="sub">{plural(c.unit_count, 'unidade', 'unidades')} · {plural(c.member_count, 'membro', 'membros')}</div>
                  </div>
                  {c.position && <span className="badge badge-yellow ico"><Trophy size={13} /> {c.position}º</span>}
                  <ChevronRight className="chev" size={20} />
                </Link>
              ))}
            </div>
          )}
        </Loading>
      </div>
    </>
  );
}
