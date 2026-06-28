import { useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { API_MODE } from '../api/client.js';
import { DEMO_ACCOUNTS, ROLE_LABELS } from '../config.js';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e, presetEmail) {
    if (e) e.preventDefault();
    const value = (presetEmail || email).trim();
    if (!value) return;
    setBusy(true); setError('');
    const res = await login(value);
    setBusy(false);
    if (!res.ok) setError(res.error || 'Login failed');
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="brand"><img className="brand-logo" src="/logo.svg" alt="" aria-hidden="true" /> Ketolab Order Management</div>
        <p className="muted">Healthy low-carb / keto meal plans · role-based access</p>

        <form onSubmit={submit}>
          <label className="field">
            <span>Sign in with your work email</span>
            <input type="email" value={email} autoFocus placeholder="you@ketolab.com" onChange={(e) => setEmail(e.target.value)} />
          </label>
          {error && <div className="alert error">{error}</div>}
          <button className="btn primary block" disabled={busy} type="submit">{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>

        {API_MODE === 'mock' && (
          <div className="demo-pick">
            <div className="muted small">Demo accounts (mock mode) — click to sign in:</div>
            {DEMO_ACCOUNTS.map((a) => (
              <div className="demo-group" key={a.email}>
                <span className={`tag ${a.role}`}>{ROLE_LABELS[a.role]}</span>
                <button className="link-btn" onClick={() => submit(null, a.email)}>{a.email}</button>
              </div>
            ))}
          </div>
        )}
        {API_MODE === 'appsscript' && (
          <p className="muted small">Connected to Apps Script. Your Google account determines your role.</p>
        )}
      </div>
    </div>
  );
}
