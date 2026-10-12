import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, UserPlus } from 'lucide-react';
import { api } from '../api.js';
import { fmtCpf } from '../format.js';
import { Avatar, Button, Card, Field, Loading, LogoHorizontal, useAsync, useLoad } from '../ui.jsx';
import FichaForm, { TermosChecks, TERMOS } from './Ficha.jsx';

const ageOf = (d) => (d ? Math.floor((Date.now() - Date.parse(d + 'T12:00:00')) / 31557600000) : null);

/**
 * Inscrição pelo link do clã. A pessoa (ou o responsável) preenche os dados pessoais,
 * a ficha médica e aceita os termos. Entra como pendente até o clã aprovar.
 */
export default function SignupPage() {
  const { code } = useParams();
  const club = useLoad(() => api.get('/public/inscricao/' + code), [code]);
  const [f, setF] = useState({ name: '', birth_date: '', cpf: '', password: '', password2: '' });
  const [ficha, setFicha] = useState({});
  const [done, setDone] = useState(null);
  const [busy, run] = useAsync();
  const age = ageOf(f.birth_date);
  const minor = age != null && age < 18;
  const termsOk = TERMOS.every(([k]) => ficha[k]);
  const ready = f.name.trim().split(/\s+/).length >= 2 && age >= 10 && f.cpf.replace(/\D/g, '').length === 11
    && f.password.length >= 6 && f.password === f.password2 && termsOk
    && (!minor || (ficha.responsavel_nome && ficha.responsavel_telefone));
  const send = async () => {
    const r = await run(() => api.post('/public/inscricao/' + code, { ...ficha, ...f }), null);
    setDone(r);
    window.scrollTo(0, 0);
  };

  return (
    <div className="app">
      <header className="topbar"><Link to="/"><LogoHorizontal light size={34} /></Link></header>
      <main className="main no-nav">
        <Loading {...club}>
          {(c) => done ? (
            <Card className="center">
              <CheckCircle2 size={56} color="var(--green)" />
              <h1 style={{ marginTop: '.5rem' }}>Inscrição enviada!</h1>
              <p>Agora a diretoria do <b>{done.club_name}</b> confere e aprova a sua inscrição.</p>
              <p className="muted small">Guarde o seu código de acesso. Depois da aprovação, entre na tela <b>Membros</b> com ele e a senha que você criou.</p>
              <div className="code-big">{done.code}</div>
              <Link to="/"><Button block>Ir para a tela de entrada</Button></Link>
            </Card>
          ) : (
            <>
              <div className="hero">
                <div className="profile-head">
                  <Avatar src={c.logo} name={c.name} size={80} square />
                  <p className="muted small" style={{ margin: '.4rem 0 0' }}>Inscrição no clã</p>
                  <h1>{c.name}</h1>
                  <span className="chip">{c.district_name}</span>
                </div>
              </div>
              <Card>
                <div className="form">
                  <h3 className="ficha-title">Dados pessoais</h3>
                  <Field label="Nome completo"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></Field>
                  <div className="grid2">
                    <Field label="Data de nascimento" hint={age != null ? (age < 10 ? 'É preciso ter pelo menos 10 anos' : `${age} anos`) : ''}>
                      <input type="date" value={f.birth_date} onChange={(e) => setF({ ...f, birth_date: e.target.value })} />
                    </Field>
                    <Field label="CPF"><input value={f.cpf} onChange={(e) => setF({ ...f, cpf: fmtCpf(e.target.value) })} inputMode="numeric" placeholder="000.000.000-00" /></Field>
                  </div>
                </div>
                <FichaForm value={ficha} onChange={setFicha} minor={minor} />
                <div className="form">
                  <h3 className="ficha-title">Termos {minor ? '(o responsável aceita)' : ''}</h3>
                  <TermosChecks value={ficha} onChange={setFicha} />
                  <h3 className="ficha-title">Senha de acesso</h3>
                  <div className="grid2">
                    <Field label="Crie uma senha" hint="Mínimo 6 caracteres"><input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" /></Field>
                    <Field label="Repita a senha" hint={f.password2 && f.password !== f.password2 ? 'As senhas não são iguais' : ''}><input type="password" value={f.password2} onChange={(e) => setF({ ...f, password2: e.target.value })} autoComplete="new-password" /></Field>
                  </div>
                  <Button block busy={busy} disabled={!ready} onClick={send}><UserPlus size={18} /> Enviar inscrição</Button>
                  <p className="muted small center">Cada pessoa pode estar em um clã só. Se você já é de outro clã, peça para este clã solicitar a sua transferência.</p>
                </div>
              </Card>
            </>
          )}
        </Loading>
      </main>
    </div>
  );
}
