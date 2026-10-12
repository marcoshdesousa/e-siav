import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Compass, Download, Monitor, Share, Smartphone, SquarePlus, Tent, MoreVertical } from 'lucide-react';
import { api } from '../api.js';
import { homeFor, useAuth } from '../auth.jsx';
import { platform, useInstall } from '../install.js';
import { LogoIcon, Modal, Spinner } from '../ui.jsx';

const SHOTS = ['/showcase/perfil.jpg', '/showcase/ranking.jpg', '/showcase/requisitos.jpg'];

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

function FloatField({ label, type = 'text', value, onChange, autoComplete, right, inputMode }) {
  return (
    <label className={'ig-field' + (value ? ' filled' : '')}>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder=" " autoComplete={autoComplete} autoCapitalize="none" spellCheck={false} inputMode={inputMode} />
      <span>{label}</span>
      {right}
    </label>
  );
}

const STEPS = {
  ios: { title: 'Instalar no iPhone', steps: [[Share, 'No Safari, toque em Compartilhar (o quadrado com a seta para cima).'], [SquarePlus, 'Role e toque em “Adicionar à Tela de Início”.'], [Smartphone, 'Toque em “Adicionar”. O Exploradores do Brasil aparece junto com os seus apps.']] },
  android: { title: 'Instalar no Android', steps: [[MoreVertical, 'No Chrome, toque no menu (os três pontinhos no canto de cima).'], [Download, 'Toque em “Instalar app” ou “Adicionar à tela inicial”.'], [Smartphone, 'Confirme. O Exploradores do Brasil aparece junto com os seus apps.']] },
  desktop: { title: 'Instalar no computador', steps: [[Monitor, 'No Chrome ou Edge, clique no ícone de instalar na barra de endereço (à direita).'], [Download, 'Ou abra o menu do navegador e escolha “Instalar Exploradores do Brasil”.'], [Monitor, 'O app abre em uma janela própria, como um programa.']] },
};

function InstallSection() {
  const install = useInstall();
  const [help, setHelp] = useState(null);
  if (install.installed) return null;
  // Um botão só: instala direto quando o navegador deixa; senão mostra o passo a passo do aparelho.
  const go = async () => {
    const target = platform();
    if (target !== 'ios' && (await install.prompt())) return;
    setHelp(target);
  };
  return (
    <div className="ig-get">
      <button type="button" className="ig-install" onClick={go}><Download size={18} /> Instalar o aplicativo</button>
      {help && (
        <Modal title={STEPS[help].title} onClose={() => setHelp(null)}>
          <div className="seg" style={{ marginBottom: '.6rem' }}>
            {[['android', 'Android'], ['ios', 'iPhone'], ['desktop', 'Computador']].map(([k, l]) => (
              <button key={k} type="button" className={help === k ? 'active' : ''} onClick={() => setHelp(k)}>{l}</button>
            ))}
          </div>
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

/** IMPROVISO PARA TESTES (tirar depois): entrar com um clique nas contas de exemplo. */
function QuickLogin({ mode, onPick }) {
  const [list, setList] = useState(null);
  useEffect(() => { api.get('/auth/contas-teste').then(setList).catch(() => setList({ clube: [], membros: [] })); }, []);
  const items = list?.[mode] || [];
  if (!items.length) return null;
  return (
    <>
      <div className="ig-or"><span />ENTRAR COMO (TESTE)<span /></div>
      <div className="ig-demo">
        {items.map((a) => (
          <button type="button" key={a.username + a.label} onClick={() => onPick(a)}>
            <b>{a.label}</b><span>{a.sub}</span>
          </button>
        ))}
      </div>
    </>
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

  const enter = async (u, pw) => {
    setBusy(true);
    setError('');
    try {
      const a = await login(mode, u, pw);
      nav(homeFor(a), { replace: true });
    } catch (err) {
      setError(err.message);
      setShake((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };
  const submit = (e) => {
    e.preventDefault();
    enter(username, password);
  };
  const pick = (a) => {
    setUsername(a.username);
    setPassword(a.password || '');
    if (a.password) enter(a.username, a.password);
  };

  return (
    <div className="ig">
      <main className="ig-main">
        <PhoneShowcase />
        <div className="ig-col">
          <form className="ig-card ig-login" onSubmit={submit} key={shake} data-shake={shake > 0 || undefined}>
            <LogoIcon size={132} />
            <h1 className="ig-brand">Exploradores do Brasil</h1>
            <p className="ig-tagline">Entre para ver o seu clã, o seu grupo e o ranking.</p>

            <div className="ig-switch" role="tablist" data-mode={mode}>
              <span className="ig-switch-pill" />
              <button type="button" role="tab" aria-selected={mode === 'membros'} onClick={() => setMode('membros')}><Compass size={17} /> Membros</button>
              <button type="button" role="tab" aria-selected={mode === 'clube'} onClick={() => setMode('clube')}><Tent size={17} /> Clã</button>
            </div>

            <FloatField label={mode === 'clube' ? 'Código do clã' : 'Seu código'} value={username} onChange={setUsername} autoComplete="username" inputMode={mode === 'clube' ? 'numeric' : undefined} />
            <FloatField
              label="Senha" type={show ? 'text' : 'password'} value={password} onChange={setPassword} autoComplete="current-password"
              right={password ? <button type="button" className="ig-show" onClick={() => setShow((s) => !s)}>{show ? 'Ocultar' : 'Mostrar'}</button> : null}
            />
            <button className="ig-submit" disabled={busy || !username || password.length < 1}>
              {busy ? <span className="btn-spin" /> : 'Entrar'}
            </button>
            {error && <p className="ig-error" role="alert">{error}</p>}
            <QuickLogin mode={mode} onPick={pick} />
            <p className="ig-hint">{mode === 'clube'
              ? 'Coloque o código do clã e a senha. Para entrar como grupo, use a senha do seu grupo.'
              : 'Coloque o seu código e a sua senha.'}</p>

          </form>

          <div className="ig-card ig-signup">
            Não tem uma conta? <b>Peça ao seu clã o link de inscrição.</b>
          </div>

          <InstallSection />
        </div>
      </main>
      <footer className="ig-footer">
        <span>Clãs, grupos e aventura</span>
        <span>© {new Date().getFullYear()} Exploradores do Brasil</span>
      </footer>
    </div>
  );
}
