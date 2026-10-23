import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, UserPlus } from 'lucide-react';
import { api } from '../api.js';
import { Avatar, Button, Card, Field, Loading, LogoHorizontal, useAsync, useLoad } from '../ui.jsx';
import FichaForm, { DocFields, SaudeAssinatura, SaudeQuiz, SexoField, TermosAssinatura, cadastroFaltando } from './Ficha.jsx';

const ageOf = (d) => (d ? Math.floor((Date.now() - Date.parse(d + 'T12:00:00')) / 31557600000) : null);

/**
 * Cadastro completo em duas partes:
 * 1) Ficha de cadastro + termos + assinatura (nome e CPF de quem assina).
 * 2) Ficha de saúde em formato de quiz + declaração + assinatura.
 * Usado na inscrição pelo link (mode "link") e no cadastro feito pelo clube (mode "cla").
 */
export function CadastroFlow({ local, mode = 'link', extra = null, submitLabel, busy, onSubmit }) {
  const [step, setStep] = useState('cadastro');
  const [f, setF] = useState({ name: '', birth_date: '', cpf: '' });
  const [ficha, setFicha] = useState({ doc_tipo: 'rg_cpf' });
  const age = ageOf(f.birth_date);
  const minor = age != null && age < 18;
  // No cadastro pelo clube, quem assina é o responsável, depois, pelo link do termo.
  const signed = mode !== 'cla';
  const missing = cadastroFaltando({ ...f, age, needPassword: false, signed }, ficha);
  const top = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const assinaturaOk = ficha.termo_medico && (ficha.med_assinatura_nome || '').trim().split(/\s+/).length >= 2 && (ficha.med_assinatura_cpf || '').length === 11;
  const send = () => onSubmit({ ...ficha, ...f, cpf: ficha.doc_tipo === 'certidao' ? '' : f.cpf, certidao: ficha.doc_tipo === 'certidao' ? ficha.certidao : '' });

  return (
    <>
      <div className="steps-head"><span className={step === 'cadastro' ? 'on' : ''}>1. Ficha de cadastro</span><span className={step !== 'cadastro' ? 'on' : ''}>2. Ficha de saúde</span></div>
      {step === 'cadastro' && (
        <Card>
          {extra}
          <div className="form">
            <h3 className="ficha-title">Dados pessoais</h3>
            <Field label="Nome completo"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></Field>
            <Field label="Data de nascimento" hint={age != null ? (age < 10 ? 'É preciso ter pelo menos 10 anos' : `${age} anos`) : 'A ficha muda conforme a idade'}>
              <input type="date" value={f.birth_date} onChange={(e) => setF({ ...f, birth_date: e.target.value })} />
            </Field>
            <SexoField value={ficha} onChange={setFicha} />
            <DocFields value={ficha} onChange={setFicha} cpf={f.cpf} onCpf={(cpf) => setF({ ...f, cpf })} />
          </div>
          <FichaForm value={ficha} onChange={setFicha} age={age} personal={false} />
          {signed ? <TermosAssinatura value={ficha} onChange={setFicha} minor={minor} />
            : <p className="small muted">Os termos e as assinaturas ficam com o {minor ? 'responsável' : 'próprio membro'}: depois de salvar, você recebe o link do termo para enviar.</p>}
          <div className="form">
            <p className="small muted">Data: <b>{new Date().toLocaleDateString('pt-BR')}</b> · Local: <b>{local}</b></p>
            <p className="small muted"><KeyRound size={14} style={{ verticalAlign: '-2px' }} /> O acesso é automático: o app cria um <b>código de 6 números</b> e a <b>senha é o ano de nascimento</b>{f.birth_date ? <> ({f.birth_date.slice(0, 4)})</> : ''}. Não dá para mudar.</p>
            {missing.length > 0 && <p className="small muted center">Falta: {missing.join(', ')}.</p>}
            <Button block disabled={missing.length > 0} onClick={() => { setStep('saude'); top(); }}>Continuar para a ficha de saúde <ArrowRight size={16} /></Button>
          </div>
        </Card>
      )}
      {step === 'saude' && (
        <Card>
          <SaudeQuiz value={ficha} onChange={setFicha} onDone={() => { if (signed) { setStep('assinar'); top(); } else send(); }} />
          <button type="button" className="ig-link mt" onClick={() => { setStep('cadastro'); top(); }}><ArrowLeft size={14} /> Voltar para a ficha de cadastro</button>
        </Card>
      )}
      {step === 'assinar' && (
        <Card>
          <h3 className="ficha-title" style={{ marginTop: 0 }}>Assinatura da ficha de saúde</h3>
          <p className="small muted">{minor ? 'O responsável confirma as respostas e assina com o nome completo e o CPF.' : 'Confirme as respostas e assine com o seu nome completo e CPF.'}</p>
          <SaudeAssinatura value={ficha} onChange={setFicha} minor={minor} />
          <div className="row between mt">
            <Button variant="secondary" onClick={() => setStep('saude')}><ArrowLeft size={16} /> Revisar</Button>
            <Button busy={busy} disabled={!assinaturaOk} onClick={send}><UserPlus size={18} /> {submitLabel}</Button>
          </div>
        </Card>
      )}
    </>
  );
}

/** Aviso com o código (6 números, aleatório) e a senha (ano de nascimento). Nenhum dos dois muda. */
export function AccessInfo({ code, password }) {
  return (
    <div className="access-info">
      <div><small>Código</small><div className="code-big">{code}</div></div>
      <div><small>Senha</small><div className="code-big">{password}</div></div>
      <p className="small" style={{ margin: 0 }}><b>Anote!</b> A senha é o ano de nascimento. O código e a senha não podem ser alterados.</p>
    </div>
  );
}

/**
 * Inscrição pelo link do clube. A pessoa (ou o responsável) preenche tudo; a inscrição
 * fica pendente até o clube aprovar.
 */
export default function SignupPage() {
  const { code } = useParams();
  const club = useLoad(() => api.get('/public/inscricao/' + code), [code]);
  const [done, setDone] = useState(null);
  const [busy, run] = useAsync();
  const send = async (body) => {
    const r = await run(() => api.post('/public/inscricao/' + code, body), null);
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
              <AccessInfo code={done.code} password={done.password} />
              <p className="muted small">Você já pode entrar no app. Até o clube aprovar, vai aparecer "Esperando a aprovação do clube".</p>
              <Link to="/"><Button block>Ir para a tela de entrada</Button></Link>
            </Card>
          ) : (
            <>
              <div className="hero">
                <div className="profile-head">
                  <Avatar src={c.logo} name={c.name} size={80} square />
                  <p className="muted small" style={{ margin: '.4rem 0 0' }}>Inscrição no clube</p>
                  <h1>{c.name}</h1>
                  <span className="chip">{c.district_name}</span>
                </div>
              </div>
              <CadastroFlow local={`${c.name} — sistema online`} submitLabel="Enviar inscrição" busy={busy} onSubmit={send} />
              <p className="muted small center">Saiu de outro clube? É só fazer a inscrição aqui: este clube confere e aprova.</p>
            </>
          )}
        </Loading>
      </main>
    </div>
  );
}
