import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { plural } from '../format.js';
import { ChevronRight, Trophy } from 'lucide-react';
import { Avatar, Field, Loading, PageHeader, useLoad } from '../ui.jsx';

/** Aba Clãs: escolhe o distrito e abre o perfil de um clã. */
export default function ClubsBrowser({ base }) {
  const districts = useLoad(() => api.get('/public/districts'));
  const [district, setDistrict] = useState(null);
  useEffect(() => {
    if (!district && districts.data?.length) setDistrict(districts.data[0].id);
  }, [districts.data, district]);
  const clubs = useLoad(() => (district ? api.get(`/public/districts/${district}/clubs`) : Promise.resolve([])), [district]);

  return (
    <>
      <PageHeader title="Clãs" subtitle="Conheça os clãs do seu distrito" />
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
        <Loading {...clubs} empty="Nenhum clã neste distrito.">
          {(list) => (
            <div className="list">
              {list.map((c) => (
                <Link key={c.id} to={`${base}/ver/clube/${c.id}`} className="list-item">
                  <Avatar src={c.logo} name={c.name} size={52} square />
                  <div className="grow">
                    <div className="title">{c.name}</div>
                    <div className="sub">{plural(c.unit_count, 'grupo', 'grupos')} · {plural(c.member_count, 'membro', 'membros')}</div>
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
