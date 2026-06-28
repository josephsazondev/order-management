import { useState } from 'react';
import { call } from '../../api/client.js';
import { useApi } from '../../lib/useApi.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { ROLE_LABELS } from '../../config.js';
import { Table, Badge, Spinner, Alert, Modal, Field, StatCard } from '../../components/ui.jsx';

// Resolve a role_id to a display label from the loaded roles list (falls back to
// the built-in label, then the raw id).
function roleLabel(roles, roleId) {
  const r = (roles || []).find((x) => x.role_id === roleId);
  return (r && r.name) || ROLE_LABELS[roleId] || roleId;
}

export default function Users() {
  const { can } = useAuth();
  const { data, loading, error, reload } = useApi('listUsers');
  const { data: rolesData } = useApi('listRoles');
  const roles = rolesData || [];
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');
  const users = data || [];

  // Granular controls — server enforces each independently.
  const canCreate = can('users', 'create');
  const canAssign = can('users', 'assign');
  const canDelete = can('users', 'delete');

  async function deactivate(u) {
    if (!confirm(`Deactivate ${u.email}? They will lose access on next sign-in.`)) return;
    const res = await call('deactivateUser', { email: u.email });
    if (res.ok) { setMsg(`${u.email} deactivated.`); reload(); }
    else setMsg(res.error);
  }

  const columns = [
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role', render: (r) => <Badge tone={r.role === 'admin' ? 'danger' : r.role === 'owner' ? 'ok' : 'muted'}>{roleLabel(roles, r.role)}</Badge> },
    { key: 'active', header: 'Status', render: (r) => <Badge>{r.active ? 'Active' : 'Inactive'}</Badge> },
    { key: 'assigned_by', header: 'Assigned by' },
    { key: 'assigned_at', header: 'Assigned at' },
  ];
  if (canAssign || canDelete) {
    columns.push({
      key: 'actions', header: '', render: (r) => (
        <div className="row-actions">
          {canAssign && <button className="link-btn" onClick={() => setEditing(r)}>Edit role</button>}
          {canDelete && r.active && <button className="link-btn danger" onClick={() => deactivate(r)}>Deactivate</button>}
        </div>
      ),
    });
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Users & Roles</h1>
          <p className="muted">Assign access by email. Roles take effect on the user's next sign-in.</p>
        </div>
        {canCreate && (
          <button className="btn primary" onClick={() => setEditing({ email: '', role: (roles[0] && roles[0].role_id) || 'sales_rep', active: true, _new: true })}>+ Add user</button>
        )}
      </div>

      <div className="stat-row">
        <StatCard label="Total users" value={users.length} />
        <StatCard label="Active" value={users.filter((u) => u.active).length} tone="ok" />
        <StatCard label="Owners" value={users.filter((u) => u.role === 'owner').length} />
      </div>

      <Alert tone={msg.includes('Forbidden') || msg.includes('Cannot') ? 'error' : 'info'} onClose={() => setMsg('')}>{msg}</Alert>
      <Alert tone="error">{error}</Alert>

      {loading ? <Spinner /> : <Table columns={columns} rows={users} rowKey={(r) => r.email} empty="No users yet." />}

      {editing && (
        <UserModal
          row={editing}
          roles={roles}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); setMsg('User saved.'); }}
        />
      )}
    </div>
  );
}

function UserModal({ row, roles, onClose, onSaved }) {
  const assignable = (roles || []).filter((r) => r.active);
  const [form, setForm] = useState({ ...row });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (f, v) => setForm((s) => ({ ...s, [f]: v }));

  async function save() {
    setBusy(true); setError('');
    const res = await call('upsertUser', { email: form.email, role: form.role, active: form.active });
    setBusy(false);
    if (res.ok) onSaved(); else setError(res.error);
  }

  return (
    <Modal
      title={row._new ? 'Add user' : `Edit ${row.email}`}
      onClose={onClose}
      footer={<>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
      </>}
    >
      <Alert tone="error" onClose={() => setError('')}>{error}</Alert>
      <Field label="Email" required>
        <input type="email" value={form.email} disabled={!row._new} onChange={(e) => set('email', e.target.value)} placeholder="person@gmail.com" />
      </Field>
      <Field label="Role" required>
        <select value={form.role} onChange={(e) => set('role', e.target.value)}>
          {assignable.map((r) => <option key={r.role_id} value={r.role_id}>{r.name}</option>)}
        </select>
      </Field>
      {!row._new && (
        <Field label="Status">
          <select value={String(form.active)} onChange={(e) => set('active', e.target.value === 'true')}>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </Field>
      )}
    </Modal>
  );
}
