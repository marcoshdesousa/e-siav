import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Apple, Compass, Download, Monitor, Share, Smartphone, SquarePlus, Tent, MoreVertical } from 'lucide-react';
import { homeFor, useAuth } from '../auth.jsx';
import { platform, useInstall } from '../install.js';
import { LogoIcon, Modal, Spinner } from '../ui.jsx';

const SHOTS = ['/showcase/perfil.jpg', '/showcase/ranking.jpg', '/showcase/chat.jpg', '/showcase/requisitos.jpg'];

/** Celular com as telas do app trocando sozinhas (só no computador). */
function PhoneShowcase() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % SHOTS.length), 3500);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="ig-phone" aria-hidden="true">
      <div className="ig-phone-screen">
        {SHOTS.map((src, k) => <img key={src} src={src} alt="" className={k === i ? 'on' : ''} loading={k ? 'lazy' : 'eager'} />)}
      </div>
    </div>
  );
}

function FloatField({ label, type = 'text', value, onChange, autoComplete, right }) {
  return (
    <label className={'ig-field' + (value ? ' filled' : '')}>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder=" " autoComplete={autoComplete} autoCapitalize="none" spellCheck={false} />
      <span>{label}</span>
      {right}
    </label>
  );
}

const STEPS = {
  ios: { title: 'Instalar no iPhone', steps: [[Share, 'No Safari, toque em Compartilhar (o quadrado com a seta para cima).'], [SquarePlus, 'Role e toque em “Adicionar à Tela de Início”.'], [Smartphone, 'Toque em “Adicionar”. O App do DBV aparece junto com os seus apps.']] },
  android: { title: 'Instalar no Android', steps: [[MoreVertical, 'No Chrome, toque no menu (os três pontinhos no canto de cima).'], [Download, 'Toque em “Instalar app” ou “Adicionar à tela inicial”.'], [Smartphone, 'Confirme. O App do DBV aparece junto com os seus apps.']] },
  desktop: { title: 'Instalar no computador', steps: [[Monitor, 'No Chrome ou Edge, clique no ícone de instalar na barra de endereço (à direita).'], [Download, 'Ou abra o menu do navegador e escolha “Instalar App do DBV”.'], [Monitor, 'O app abre em uma janela própria, como um programa.']] },
};

function InstallSection() {
  const install = useInstall();
  const [help, setHelp] = useState(null);
  if (install.installed) return null;
  const go = async (target) => {
    if (target !== 'ios' && target === platform() && (await install.prompt())) return;
    setHelp(target);
  };
  return (
    <div className="ig-get">
      <p>Instale o aplicativo.</p>
      <div className="ig-stores">
        <button type="button" onClick={() => go('android')}><Smartphone size={22} /><span><small>Instalar no</small>Android</span></button>
        <button type="button" onClick={() => go('ios')}><Apple size={22} /><span><small>Instalar no</small>iPhone</span></button>
        <button type="button" onClick={() => go('desktop')}><Monitor size={22} /><span><small>Instalar no</small>Computador</span></button>
      </div>
      {help && (
        <Modal title={STEPS[help].title} onClose={() => setHelp(null)}>
          <ol className="ig-steps">
            {STEPS[help].steps.map(([Ico, text], k) => (
              <li key={k}><span className="ig-step-ico"><Ico size={20} /></span><span>{text}</span></li>
            ))}
          </ol>
        </Modal>
      )}
    </div>
  );
}

/** Tela de entrada (também é a página inicial do site). */
export default function Login() {
  const { actor, login } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState('membros');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);

  if (actor === undefined) return <Spinner />;
  if (actor) return <Navigate to={homeFor(actor)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const a = await login(mode, username, password);
      nav(homeFor(a), { replace: true });
    } catch (err) {
      setError(err.message);
      setShake((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ig">
      <main className="ig-main">
        <PhoneShowcase />
        <div className="ig-col">
          <form className="ig-card ig-login" onSubmit={submit} key={shake} data-shake={shake > 0 || undefined}>
            <LogoIcon size={132} />
            <h1 className="ig-brand">App do DBV</h1>
            <p className="ig-tagline">Entre para ver o seu clube, a sua unidade e o ranking.</p>

            <div className="ig-switch" role="tablist" data-mode={mode}>
              <span className="ig-switch-pill" />
              <button type="button" role="tab" aria-selected={mode === 'membros'} onClick={() => setMode('membros')}><Compass size={17} /> Membros</button>
              <button type="button" role="tab" aria-selected={mode === 'clube'} onClick={() => setMode('clube')}><Tent size={17} /> Clube</button>
            </div>

            <FloatField label="Usuário" value={username} onChange={setUsername} autoComplete="username" />
            <FloatField
              label="Senha" type={show ? 'text' : 'password'} value={password} onChange={setPassword} autoComplete="current-password"
              right={password ? <button type="button" className="ig-show" onClick={() => setShow((s) => !s)}>{show ? 'Ocultar' : 'Mostrar'}</button> : null}
            />
            <button className="ig-submit" disabled={busy || !username || password.length < 1}>
              {busy ? <span className="btn-spin" /> : 'Entrar'}
            </button>
            {error && <p className="ig-error" role="alert">{error}</p>}

          </form>

          <div className="ig-card ig-signup">
            Não tem uma conta? <b>Peça à secretaria do seu clube.</b>
          </div>

          <InstallSection />
        </div>
      </main>
      <footer className="ig-footer">
        <span>Clubes de Desbravadores</span>
        <span>© {new Date().getFullYear()} App do DBV</span>
      </footer>
    </div>
  );
}
