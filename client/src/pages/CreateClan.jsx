import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, FileText, Send } from 'lucide-react';
import { api } from '../api.js';
import { fmtCpf } from '../format.js';
import { Button, Card, Field, LogoHorizontal, useAsync } from '../ui.jsx';

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

/** Página pública: quem quer criar um clube envia os dados e a equipe entra em contato. */
export default function CreateClanPage() {
  const [f, setF] = useState({ name: '', cpf: '', whatsapp: '', uf: '', city: '', neighborhood: '', clan_name: '', adults: '', teens: '', kids_6_9: '', kids_10_15: '' });
  const [sent, setSent] = useState(false);
  const [busy, run] = useAsync();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const num = (k, label, hint) => <Field label={label} hint={hint}><input type="number" min="0" inputMode="numeric" value={f[k]} onChange={set(k)} /></Field>;
  const ready = f.name.trim().split(/\s+/).length >= 2 && f.cpf.replace(/\D/g, '').length === 11 && f.whatsapp.replace(/\D/g, '').length >= 10
    && f.uf && f.city.trim() && f.neighborhood.trim() && ['adults', 'teens', 'kids_6_9', 'kids_10_15'].every((k) => f[k] !== '');
  const send = async () => {
    await run(() => api.post('/public/criar-cla', f), null);
    setSent(true);
    window.scrollTo(0, 0);
  };
  return (
    <div className="app">
      <header className="topbar"><Link to="/"><LogoHorizontal light size={34} /></Link></header>
      <main className="main no-nav">
        {sent ? (
          <Card className="center">
            <CheckCircle2 size={56} color="var(--green)" />
            <h1 style={{ marginTop: '.5rem' }}>Dados enviados!</h1>
            <p>Alguém da nossa equipe vai entrar em contato com você pelo WhatsApp para a possível criação do seu clube.</p>
            <Link to="/"><Button block>Voltar ao início</Button></Link>
          </Card>
        ) : (
          <>
            <div className="hero"><div className="profile-head"><h1>Criar um clube</h1><p className="muted">Envie os seus dados e a nossa equipe entra em contato.</p></div></div>
            <Card>
              <div className="form">
                <h3 className="ficha-title">Seus dados</h3>
                <Field label="Nome completo"><input value={f.name} onChange={set('name')} autoComplete="name" /></Field>
                <div className="grid2">
                  <Field label="CPF"><input value={f.cpf} onChange={(e) => setF({ ...f, cpf: fmtCpf(e.target.value) })} inputMode="numeric" placeholder="000.000.000-00" /></Field>
                  <Field label="WhatsApp"><input value={f.whatsapp} onChange={set('whatsapp')} inputMode="tel" placeholder="(00) 00000-0000" /></Field>
                </div>
                <h3 className="ficha-title">Onde vai ser o clube</h3>
                <div className="grid-addr">
                  <Field label="Cidade"><input value={f.city} onChange={set('city')} /></Field>
                  <Field label="Estado"><select value={f.uf} onChange={set('uf')}><option value="">UF</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select></Field>
                </div>
                <Field label="Bairro ou setor"><input value={f.neighborhood} onChange={set('neighborhood')} /></Field>
                <Field label="Nome que gostaria para o clube" hint="Opcional"><input value={f.clan_name} onChange={set('clan_name')} /></Field>
                <h3 className="ficha-title">Liderança</h3>
                <div className="grid2">
                  {num('adults', 'Pessoas com 18 anos ou mais', 'Quantos líderes você tem')}
                  {num('teens', 'Pessoas de 16 e 17 anos', 'Possíveis conselheiros')}
                </div>
                <h3 className="ficha-title">Crianças e adolescentes no bairro ou setor (estimativa)</h3>
                <div className="grid2">
                  {num('kids_6_9', 'De 6 a 9 anos')}
                  {num('kids_10_15', 'De 10 a 15 anos')}
                </div>
                <p className="small muted ico"><FileText size={14} /> Em breve: material em PDF explicando como funciona um clube.</p>
                <Button block busy={busy} disabled={!ready} onClick={send}><Send size={16} /> Enviar dados</Button>
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
