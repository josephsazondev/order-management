import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLES, ROLE_LABELS, API_MODE } from '../config.js';
import { call } from '../api/client.js';

// Build the sidebar from the user's permissions, not their role string. Each link
// appears only if the corresponding grant is present.
function navFor(can, canScope) {
  const nav = [];
  const subsAll = canScope('subscriptions', 'all');
  // Determine what the landing route ('/') renders so we don't duplicate its link below.
  let landing = null;
  if (can('dashboard', 'read')) { nav.push({ to: '/', label: 'Dashboard', end: true }); landing = 'dashboard'; }
  else if (can('subscriptions', 'read') && !subsAll) { nav.push({ to: '/', label: 'My Subscriptions', end: true }); landing = 'subs-own'; }
  else if (can('subscriptions', 'read') && subsAll) { nav.push({ to: '/', label: 'Subscriptions', end: true }); landing = 'subs-all'; }
  else if (can('users', 'read')) { nav.push({ to: '/', label: 'Users', end: true }); landing = 'users'; }

  if (subsAll && landing !== 'subs-all') nav.push({ to: '/subscriptions', label: 'Subscriptions' });
  if (can('customers', 'read')) nav.push({ to: '/customers', label: 'Customers' });
  if (can('payments', 'read')) nav.push({ to: '/payments', label: 'Payments' });
  if (can('products', 'read')) nav.push({ to: '/products', label: 'Products' });
  if (can('invoices', 'read')) nav.push({ to: '/invoices', label: 'Invoices' });
  if (can('users', 'read') && landing !== 'users') nav.push({ to: '/users', label: 'Users' });
  if (can('users', 'read')) nav.push({ to: '/roles', label: 'Roles' });
  if (can('settings', 'read') || can('settings', 'update')) nav.push({ to: '/settings', label: 'System Settings' });
  if (can('audit', 'read')) nav.push({ to: '/audit', label: 'Audit Log' });
  return nav;
}

export default function Layout({ children }) {
  const { user, can, canScope, settings, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const nav = navFor(can, canScope);
  const roleClass = user.role === ROLES.ADMIN ? 'admin' : user.role === ROLES.OWNER ? 'owner' : 'rep';

  async function resetDemo() {
    if (!confirm('Reset all demo data back to the seed dataset?')) return;
    await call('resetDemoData');
    location.reload();
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand"><img className="brand-logo" src="/logo.svg" alt="" aria-hidden="true" /> {settings.business_name || 'Ketolab Order Management'}</div>
        <div className={`role-pill ${roleClass}`}>{ROLE_LABELS[user.role] || user.role}</div>
        <nav onClick={() => setMenuOpen(false)}>
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          {(user.role === ROLES.OWNER || user.role === ROLES.ADMIN) && API_MODE === 'mock' && (
            <button className="link-btn small" onClick={resetDemo}>Reset demo data</button>
          )}
          <div className="env-note small muted">backend: {API_MODE}</div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="hamburger" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">☰</button>
          <div className="spacer" />
          <div className="user-box">
            <span className="user-email">{user.email}</span>
            <button className="btn ghost small" onClick={logout}>Sign out</button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>

      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
    </div>
  );
}
