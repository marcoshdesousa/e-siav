import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { homeFor, useAuth } from '../auth.jsx';
import { ArrowLeft, Compass, Tent } from 'lucide-react';
import { Button, Field, LogoIcon } from '../ui.jsx';

const DEMO = {
  clube: [['aguias', 'aguias123', 'Clube Águias do Vale'], ['falcoes', 'falcoes123', 'Unidade Falcões']],
  membros: [['pedro', 'dbv123', 'Desbravador'], ['marcos', 'dbv123', 'Liderança'], ['admin', 'admin123', 'Administrador Geral']],
};

export default function Login() {
  const { actor, login } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState('membros');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <Link to="/" className="login-back"><ArrowLeft size={18} /> Início</Link>
      <div className="login-brand">
        <LogoIcon size={96} />
        <h1>App do DBV</h1>
        <p>Seu clube de Desbravadores na palma da mão</p>
      </div>
      <form className="login-card form" onSubmit={submit}>
        <div className="login-switch" role="tablist">
          <button type="button" className={mode === 'clube' ? 'active' : ''} onClick={() => setMode('clube')}>
            <Tent size={20} />Login Clube<small>Clube e unidades</small>
          </button>
          <button type="button" className={mode === 'membros' ? 'active' : ''} onClick={() => setMode('membros')}>
            <Compass size={20} />Login Membros<small>Desbravadores e liderança</small>
          </button>
        </div>
        <Field label="Usuário">
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoComplete="username" required />
        </Field>
        <Field label="Senha">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </Field>
        {error && <div className="badge badge-red" style={{ whiteSpace: 'normal', padding: '.5rem .8rem' }}>{error}</div>}
        <Button busy={busy} block>Entrar</Button>
        <p className="muted small center">Não há cadastro aberto: a sua conta é criada pelo seu clube{mode === 'clube' ? ' (ou pelo Administrador Geral)' : ''}.</p>
        <div className="demo">
          <b>Contas de demonstração</b> (toque para preencher):
          {DEMO[mode].map(([u, p, l]) => (
            <div key={u}>
              {l}: <code onClick={() => { setUsername(u); setPassword(p); }}>{u}</code> / <code onClick={() => { setUsername(u); setPassword(p); }}>{p}</code>
            </div>
          ))}
        </div>
      </form>
    </div>
  );
}
