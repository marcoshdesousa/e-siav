// Inscrição pelo link do clube: a pessoa já entra no clube e ganha o login na hora
// (código de 6 números + ano de nascimento). CPF fica para depois.
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, KeyRound, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Avatar, Button, Card, Field, Loading, LogoHorizontal, useAsync, useLoad } from '../ui.jsx';
import './club-signup.css';

const ageOf = (d) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) return null;
  const b = new Date(d + 'T12:00:00');
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a >= 0 && a < 120 ? a : null;
};

export default function ClubSignup() {
  const { token } = useParams();
  const state = useLoad(() => api.get(`/inscricao/${token}`), [token]);
  return (
    <div className="csu">
      <div className="csu-top"><LogoHorizontal /></div>
      <Loading {...state}>{(d) => <Form d={d} token={token} />}</Loading>
    </div>
  );
}

function Form({ d, token }) {
  const nav = useNavigate();
  const { setActor } = useAuth();
  const [f, setF] = useState({ name: '', birth_date: '', cargo: '', unit_id: null });
  const [done, setDone] = useState(null);
  const [busy, run] = useAsync();
  const age = ageOf(f.birth_date);
  const leader = age != null && age >= 16;
  const young = age != null && age < 10;
  const cargo = age == null || young ? '' : leader ? f.cargo : 'desbravador';
  const needUnit = cargo === 'desbravador' || cargo === 'conselheiro';
  const ready = f.name.trim().split(/\s+/).length >= 2 && age != null && !young && cargo && (!needUnit || f.unit_id);
  const send = () => run(async () => setDone(await api.post(`/inscricao/${token}`, { ...f, cargo })));

  if (done) {
    return (
      <Card className="csu-card center">
        <CheckCircle2 size={44} className="csu-ok" />
        <h2>Bem-vindo(a) ao {d.club.name}!</h2>
        <p>A sua conta já está pronta. <b>Anote</b> para entrar de novo:</p>
        <div className="csu-login">
          <div><small>Código</small><b>{done.code}</b></div>
          <div><small>Senha</small><b>{done.password}</b></div>
        </div>
        <p className="small muted">A senha é o ano em que você nasceu.</p>
        <Button block onClick={() => { setActor(done.actor); nav('/membro', { replace: true }); }}>Entrar no app</Button>
      </Card>
    );
  }
  return (
    <>
      <div className="csu-club">
        <Avatar src={d.club.logo} name={d.club.name} size={84} square />
        <div>
          <small>Inscrição no clube</small>
          <h1>{d.club.name}</h1>
        </div>
      </div>
      <Card className="csu-card">
        <div className="form">
          <Field label="Nome completo">
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nome e sobrenome" autoComplete="name" />
          </Field>
          <Field label="Data de nascimento" hint={age != null ? `${age} anos` : null}>
            <input type="date" value={f.birth_date} onChange={(e) => setF({ ...f, birth_date: e.target.value, cargo: '', unit_id: null })} />
          </Field>
          {young && <p className="small csu-warn">Para entrar no clube é preciso ter pelo menos 10 anos.</p>}
          {age != null && !young && (
            <Field label="Cargo">
              <div className="csu-chips">
                {leader ? (
                  <>
                    <button type="button" className={cargo === 'diretoria' ? 'on' : ''} onClick={() => setF({ ...f, cargo: 'diretoria', unit_id: null })}><ShieldCheck size={18} /> Diretoria</button>
                    <button type="button" className={cargo === 'conselheiro' ? 'on' : ''} onClick={() => setF({ ...f, cargo: 'conselheiro' })}><Users size={18} /> Conselheiro</button>
                  </>
                ) : <button type="button" className="on"><UserPlus size={18} /> Desbravador</button>}
              </div>
            </Field>
          )}
          {cargo === 'diretoria' && <p className="small muted">Você entra na Liderança do clube. Depois a diretoria do clube coloca o seu cargo certinho.</p>}
          {needUnit && (
            <Field label={cargo === 'conselheiro' ? 'Unidade em que você é conselheiro' : 'A sua unidade'}>
              {d.units.length ? (
                <div className="csu-units">
                  {d.units.map((u) => (
                    <button key={u.id} type="button" className={f.unit_id === u.id ? 'on' : ''} onClick={() => setF({ ...f, unit_id: u.id })}>
                      <Avatar src={u.logo} name={u.name} size={40} square />
                      <span>{u.name}</span>
                    </button>
                  ))}
                </div>
              ) : <p className="small muted">O clube ainda não tem unidades. Fale com a diretoria.</p>}
            </Field>
          )}
          <Button block busy={busy} disabled={!ready} onClick={send}><KeyRound size={18} /> Criar minha conta</Button>
        </div>
      </Card>
    </>
  );
}
