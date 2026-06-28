import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { call, setSessionEmail } from '../api/client.js';
import { DEFAULT_SETTINGS } from '../config.js';

const AuthContext = createContext(null);
const STORAGE_KEY = 'orderflow_session_email';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { email, role, permissions: string[] }
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const permissions = user && Array.isArray(user.permissions) ? user.permissions : [];

  // can('payments','verify') — true if the user holds that grant. UI gating only;
  // the server independently enforces via requirePermission_. A plain `read` check is
  // satisfied by either read scope (own/all); use canScope to distinguish them.
  const can = useCallback(
    (feature, action) => {
      if (permissions.indexOf(`${feature}:${action}`) >= 0) return true;
      if (action === 'read') {
        return permissions.indexOf(`${feature}:read:own`) >= 0 || permissions.indexOf(`${feature}:read:all`) >= 0;
      }
      return false;
    },
    [permissions],
  );
  // canScope('subscriptions','all') — for scoped-read features (own vs all).
  const canScope = useCallback(
    (feature, scope) => permissions.indexOf(`${feature}:read:${scope}`) >= 0,
    [permissions],
  );

  async function loadSettings() {
    const res = await call('getSettings');
    if (res.ok) setSettings(res.data);
  }

  // Restore a remembered session on load.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) { setLoading(false); return; }
    setSessionEmail(saved);
    call('getSession')
      .then(async (res) => {
        if (res.ok) { setUser(res.data); await loadSettings(); }
        else localStorage.removeItem(STORAGE_KEY);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email) => {
    setSessionEmail(email);
    const res = await call('getSession');
    if (!res.ok) { setSessionEmail(null); return { ok: false, error: res.error }; }
    localStorage.setItem(STORAGE_KEY, email);
    setUser(res.data);
    await loadSettings();
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSessionEmail(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, permissions, can, canScope, settings, loading, login, logout, reloadSettings: loadSettings }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
