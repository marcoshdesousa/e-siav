// Criar conta pelo app (sem o link de um clube) e Registrar clube (manda os dados no WhatsApp da equipe).
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Award, CheckCircle2, Compass, Info, KeyRound, MessageCircle, Tent } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Button, Card, Field, LogoHorizontal, useAsync, useLoad } from '../ui.jsx';
import './club-signup.css';

const ageOf = (d) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) return null;
  const b = new Date(d + 'T12:00:00');
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a >= 0 && a < 120 ? a : null;
};

/** Campo do @ (opcional na criação da conta): único no app e sem troca depois. */
export function HandleField({ value, onChange }) {
  return (
    <Field label="Seu @" hint="Entre com ele ou com o código, que o app cria depois. Ninguém pesquisa pelo @, e depois de criado ele não muda.">
      <div className="handle-input"><span>@</span><input value={value} onChange={(e) => onChange(e.target.value.replace(/\s/g, '').toLowerCase())} placeholder="seu.nome" autoCapitalize="none" spellCheck={false} maxLength={21} /></div>
    </Field>
  );
}

const Top = () => (
  <>
    <div className="csu-top"><LogoHorizontal /></div>
    <Link to="/" className="small ico csu-back"><ArrowLeft size={14} /> Voltar para a entrada</Link>
  </>
);

/** Criar conta pelo App do DBV: entra no Clube App Brasil, sem clube e sem unidade de verdade. */
export function CreateAccount() {
  const nav = useNavigate();
  const { setActor } = useAuth();
  const [f, setF] = useState({ name: '', birth_date: '', handle: '' });
  const [done, setDone] = useState(null);
  const [busy, run] = useAsync();
  const age = ageOf(f.birth_date);
  const young = age != null && age < 10;
  const leader = age != null && age >= 16;
  const ready = f.name.trim().split(/\s+/).length >= 2 && age != null && !young && f.handle.replace(/^@/, '').length >= 3;
  const send = () => run(async () => setDone(await api.post('/criar-conta', f)));

  if (done) {
    return (
      <div className="csu">
        <Top />
        <Card className="csu-card center">
          <CheckCircle2 size={44} className="csu-ok" />
          <h2>Conta criada!</h2>
          <p>Você está no <b>Clube App Brasil</b>. <b>Anote</b> para entrar de novo:</p>
          <div className="csu-login">
            <div><small>Código</small><b>{done.code}</b></div>
            <div><small>Senha</small><b>{done.password}</b></div>
          </div>
          <p style={{ margin: 0 }}>Você entra com <b>@{done.actor.handle}</b> ou com o código.</p>
          <p className="small muted">A senha é o ano em que você nasceu.</p>
          <Button block onClick={() => { setActor(done.actor); nav('/membro', { replace: true }); }}>Entrar no app</Button>
        </Card>
      </div>
    );
  }
  return (
    <div className="csu">
      <Top />
      <div className="csu-club">
        <img src="/marca/logo.png" alt="" className="csu-logo" />
        <div>
          <small>Criar conta</small>
          <h1>Clube App Brasil</h1>
        </div>
      </div>
      <div className="csu-notice">
        <Info size={20} />
        <p>Você está criando a conta pelo <b>App do DBV (App Brasil)</b>. Você <b>não terá registro de clube nem de unidade</b> e participa só do <b>ranking Brasil</b>.<br />Faz parte de um clube? <b>Peça o link de inscrição do seu clube</b> e cadastre-se por ele: assim você entra direto no clube.</p>
      </div>
      <Card className="csu-card">
        <div className="form">
          <Field label="Nome completo">
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nome e sobrenome" autoComplete="name" />
          </Field>
          <HandleField value={f.handle} onChange={(handle) => setF({ ...f, handle })} />
          <Field label="Data de nascimento" hint={age != null ? `${age} anos` : null}>
            <input type="date" value={f.birth_date} onChange={(e) => setF({ ...f, birth_date: e.target.value })} />
          </Field>
          {young && <p className="small csu-warn">Para criar a conta é preciso ter pelo menos 10 anos.</p>}
          {age != null && !young && (
            <Field label="Cargo" hint={leader ? 'Com 16 anos ou mais você entra na Liderança' : 'Até 15 anos você entra como Desbravador'}>
              <div className="csu-chips">
                {leader
                  ? <button type="button" className="on" disabled><Award size={18} /> Liderança</button>
                  : <button type="button" className="on" disabled><Compass size={18} /> Desbravador</button>}
              </div>
            </Field>
          )}
          <Button block busy={busy} disabled={!ready} onClick={send}><KeyRound size={18} /> Criar minha conta</Button>
        </div>
      </Card>
    </div>
  );
}

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

/** Registrar clube: preenche os dados e manda tudo pronto no WhatsApp da equipe. */
export function RegisterClub() {
  const wa = useLoad(() => api.get('/public/whatsapp'));
  const [f, setF] = useState({ club: '', church: '', uf: '', city: '', district: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const ready = f.club.trim() && f.church.trim() && f.uf && f.city.trim() && f.district.trim();
  const number = wa.data?.number;
  const text = [
    'Olá! Quero registrar o meu clube no App do DBV.',
    '',
    `*Clube:* ${f.club.trim()}`,
    `*Igreja:* ${f.church.trim()}`,
    `*Estado:* ${f.uf}`,
    `*Cidade:* ${f.city.trim()}`,
    `*Bairro:* ${f.district.trim()}`,
  ].join('\n');
  const send = () => window.open(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  return (
    <div className="csu">
      <Top />
      <div className="csu-club">
        <span className="csu-ico"><Tent size={30} /></span>
        <div>
          <small>Registrar clube</small>
          <h1>Coloque o seu clube no App do DBV</h1>
        </div>
      </div>
      <Card className="csu-card">
        <div className="form">
          <Field label="Nome do clube"><input value={f.club} onChange={set('club')} placeholder="Ex.: Clube Águias do Vale" /></Field>
          <Field label="Nome da igreja"><input value={f.church} onChange={set('church')} placeholder="Ex.: IASD Central" /></Field>
          <div className="row">
            <Field label="Estado">
              <select value={f.uf} onChange={set('uf')}>
                <option value="">UF</option>
                {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
            <Field label="Cidade"><input value={f.city} onChange={set('city')} placeholder="Cidade" /></Field>
          </div>
          {f.uf && f.city.trim() && <Field label="Bairro"><input value={f.district} onChange={set('district')} placeholder="Bairro da igreja" /></Field>}
          {wa.data && !number && <p className="small muted">O WhatsApp da equipe ainda não foi configurado. Tente de novo mais tarde.</p>}
          <Button block disabled={!ready || !number} onClick={send}><MessageCircle size={18} /> Enviar no WhatsApp</Button>
          <p className="small muted center">Os dados vão prontos na mensagem para a nossa equipe. Depois é só aguardar o retorno.</p>
        </div>
      </Card>
    </div>
  );
}
