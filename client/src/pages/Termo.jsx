import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, PenLine } from 'lucide-react';
import { api } from '../api.js';
import { fmtCpf } from '../format.js';
import { Avatar, Button, Card, Field, Loading, LogoHorizontal, useAsync, useLoad } from '../ui.jsx';
import { DECLARACAO_CADASTRO, DECLARACAO_SAUDE, TERMOS, TermosLista } from './Ficha.jsx';

/**
 * Assinatura do termo pelo link (cada membro tem o seu). O responsável lê,
 * marca os termos e assina digitalmente com o nome completo e o CPF.
 */
export default function TermoPage() {
  const { token } = useParams();
  const state = useLoad(() => api.get('/public/termo/' + token), [token]);
  const [f, setF] = useState({});
  const [done, setDone] = useState(null);
  const [busy, run] = useAsync();
  const ready = TERMOS.every(([k]) => f[k]) && f.termo_medico && f.decl_cadastro
    && (f.assinatura_nome || '').trim().split(/\s+/).length >= 2 && (f.assinatura_cpf || '').length === 11;
  const sign = async () => {
    const r = await run(() => api.post('/public/termo/' + token, f), null);
    setDone(r);
    window.scrollTo(0, 0);
  };
  return (
    <div className="app">
      <header className="topbar"><Link to="/"><LogoHorizontal light size={34} /></Link></header>
      <main className="main no-nav">
        <Loading {...state}>
          {(m) => done ? (
            <Card className="center">
              <CheckCircle2 size={56} color="var(--green)" />
              <h1 style={{ marginTop: '.5rem' }}>Termo assinado!</h1>
              <p><b>{done.name}</b> já está ativo no <b>{done.club_name}</b> e pode participar das atividades.</p>
              <Link to="/"><Button block>Ir para o início</Button></Link>
            </Card>
          ) : (
            <>
              <div className="hero">
                <div className="profile-head">
                  <Avatar src={m.club_logo} name={m.club_name} size={72} square />
                  <p className="muted small" style={{ margin: '.4rem 0 0' }}>Assinar termo · {m.club_name}</p>
                  <h1>{m.name}</h1>
                  <span className="chip">{m.age} anos</span>
                </div>
              </div>
              <Card>
                <div className="form">
                  <p className="small" style={{ marginTop: 0 }}>
                    {m.minor ? <>Você, responsável por <b>{m.name.split(' ')[0]}</b>, precisa ler e assinar os termos abaixo para que {m.name.split(' ')[0]} possa participar das atividades do clube.</>
                      : <>Leia e assine os termos abaixo para participar das atividades do clube.</>}
                  </p>
                  <TermosLista value={f} onChange={setF} />
                  <label className="check termo"><input type="checkbox" checked={!!f.decl_cadastro} onChange={(e) => setF({ ...f, decl_cadastro: e.target.checked })} /> <span><b style={{ display: 'block' }}>Ficha de cadastro</b>{DECLARACAO_CADASTRO}</span></label>
                  <label className="check termo"><input type="checkbox" checked={!!f.termo_medico} onChange={(e) => setF({ ...f, termo_medico: e.target.checked })} /> <span><b style={{ display: 'block' }}>Ficha de saúde</b>{DECLARACAO_SAUDE}</span></label>
                  <h3 className="ficha-title">Assinatura digital</h3>
                  <div className="grid2">
                    <Field label={m.minor ? 'Nome completo do responsável' : 'Seu nome completo'}><input value={f.assinatura_nome || ''} onChange={(e) => setF({ ...f, assinatura_nome: e.target.value })} autoComplete="name" /></Field>
                    <Field label={m.minor ? 'CPF do responsável' : 'Seu CPF'}><input value={fmtCpf(f.assinatura_cpf)} onChange={(e) => setF({ ...f, assinatura_cpf: e.target.value.replace(/\D/g, '') })} inputMode="numeric" placeholder="000.000.000-00" /></Field>
                  </div>
                  <p className="small muted">Data: <b>{new Date().toLocaleDateString('pt-BR')}</b>. A assinatura vale para a ficha de cadastro e para a ficha de saúde.</p>
                  <Button block busy={busy} disabled={!ready} onClick={sign}><PenLine size={17} /> Assinar digitalmente</Button>
                </div>
              </Card>
            </>
          )}
        </Loading>
      </main>
    </div>
  );
}
