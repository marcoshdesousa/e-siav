import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Eye, KeyRound, MapPin,
} from 'lucide-react';
import { api } from '../../api.js';
import { plural } from '../../format.js';
import { Avatar, Badge, Card, Loading, Tabs, useLoad } from '../../ui.jsx';
import { MembersBrowser } from '../club/Members.jsx';

/**
 * O Administrador Geral vê o clube por dentro: membros, unidades e
 * senhas das unidades. Tudo só para visualizar — nada pode ser editado daqui.
 */
export default function ClanView({ base }) {
  const { id } = useParams();
  const state = useLoad(() => api.get(`/admin/clubs/${id}/view`), [id]);
  const [tab, setTab] = useState('membros');
  return (
    <>
      <Loading {...state}>
        {({ club: c, members, units }) => (
          <>
            <div className="hero">
              <div className="profile-head">
                <Avatar src={c.logo} name={c.name} size={80} square />
                <h1>{c.name}</h1>
                <div className="chips">
                  <span className="chip ico"><MapPin size={14} /> {c.district_name}</span>
                  <span className="chip ico"><KeyRound size={14} /> Código {c.code}</span>
                </div>
                {c.director_name && <p className="small" style={{ margin: '.3rem 0 0' }}>Diretor(a): <b>{c.director_name}</b>{c.associate_directors ? <><br />Diretores associados: <b>{c.associate_directors.split('\n').join(', ')}</b></> : ''}</p>}
              </div>
            </div>
            <Card className="small"><Eye size={14} style={{ verticalAlign: '-2px' }} /> Você está vendo o clube por dentro. <b>Nada pode ser editado daqui</b>: só o próprio clube altera os dados.</Card>
            <Tabs tabs={[['membros', `Membros (${members.filter((m) => m.status !== 'inativo').length})`], ['grupos', `Unidades (${units.length})`]]} value={tab} onChange={setTab} />
            {tab === 'membros' ? (
              <MembersBrowser list={members} units={units} />
            ) : (
              <div className="list">
                {units.map((u) => (
                  <div key={u.id} className="list-item">
                    <Avatar src={u.logo} name={u.name} size={48} square />
                    <div className="grow">
                      <div className="title">{u.name} {u.is_leadership ? <Badge kind="yellow">automático</Badge> : null}</div>
                      <div className="sub">{plural(u.member_count, 'membro', 'membros')} · senha <span className="pin-box"><KeyRound size={13} />{u.pin}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Loading>
    </>
  );
}
