import { useState } from 'react';
import { call } from '../../api/client.js';
import { useApi } from '../../lib/useApi.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { PERMISSIONS, ACTION_LABELS } from '../../config.js';
import { Table, Badge, Spinner, Alert, Modal, Field, StatCard, Empty } from '../../components/ui.jsx';

const FEATURES = Object.keys(PERMISSIONS);

// A human summary of how many grants a role holds, by feature.
function permSummary(perms) {
  if (!perms || perms.length === 0) return 'No permissions';
  const byFeature = {};
  perms.forEach((g) => {
    const feature = g.split(':')[0];
    byFeature[feature] = (byFeature[feature] || 0) + 1;
  });
  return Object.keys(byFeature)
    .map((f) => `${PERMISSIONS[f] ? PERMISSIONS[f].label : f} (${byFeature[f]})`)
    .join(', ');
}

export default function Roles() {
  const { can } = useAuth();
  const { data, loading, error, reload } = useApi('listRoles');
  const roles = data || [];
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');

  // Managing role definitions requires users:update; users:read alone is view-only.
  const canManage = can('users', 'update');

  async function remove(r) {
    if (!confirm(`Delete the "${r.name}" role? This cannot be undone.`)) return;
    const res = await call('deleteRole', { role_id: r.role_id });
    if (res.ok) { setMsg(`Role "${r.name}" deleted.`); reload(); }
    else setMsg(res.error);
  }

  const columns = [
    { key: 'name', header: 'Role', render: (r) => <strong>{r.name}</strong> },
    { key: 'type', header: 'Type', render: (r) => <Badge tone={r.is_builtin ? 'ok' : 'muted'}>{r.is_builtin ? 'Built-in' : 'Custom'}</Badge> },
    { key: 'perms', header: 'Permissions', render: (r) => <span className="muted small">{permSummary(r.permissions)}</span> },
    { key: 'active', header: 'Status', render: (r) => <Badge>{r.active ? 'Active' : 'Inactive'}</Badge> },
  ];
  if (canManage) {
    columns.push({
      key: 'actions', header: '', render: (r) => (
        <div className="row-actions">
          <button className="link-btn" onClick={() => setEditing(r)}>Edit</button>
          {!r.is_builtin && <button className="link-btn danger" onClick={() => remove(r)}>Delete</button>}
        </div>
      ),
    });
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Roles & Permissions</h1>
          <p className="muted">Define what each role can do. Assign roles to people on the Users screen.</p>
        </div>
        {canManage && <button className="btn primary" onClick={() => setEditing({ _new: true, name: '', permissions: [], active: true })}>+ Add role</button>}
      </div>

      <div className="stat-row">
        <StatCard label="Total roles" value={roles.length} />
        <StatCard label="Built-in" value={roles.filter((r) => r.is_builtin).length} />
        <StatCard label="Custom" value={roles.filter((r) => !r.is_builtin).length} tone="ok" />
      </div>

      <Alert tone={/cannot|Forbidden|already|Separation|leave|Unknown/.test(msg) ? 'error' : 'info'} onClose={() => setMsg('')}>{msg}</Alert>
      <Alert tone="error">{error}</Alert>

      {loading ? <Spinner /> : <Table columns={columns} rows={roles} rowKey={(r) => r.role_id} empty="No roles yet." />}

      {editing && (
        <RoleModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={(name) => { setEditing(null); reload(); setMsg(`Role "${name}" saved.`); }}
        />
      )}
    </div>
  );
}

function RoleModal({ row, onClose, onSaved }) {
  const [form, setForm] = useState({
    role_id: row.role_id,
    name: row.name || '',
    active: row.active !== undefined ? row.active : true,
    is_builtin: !!row.is_builtin,
    grants: new Set(row.permissions || []),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (f, v) => setForm((s) => ({ ...s, [f]: v }));

  function toggleGrant(grant, on) {
    setForm((s) => {
      const next = new Set(s.grants);
      if (on) next.add(grant); else next.delete(grant);
      return { ...s, grants: next };
    });
  }

  // For scoped-read features, set the read scope to none/own/all (mutually exclusive).
  function setReadScope(feature, scope) {
    setForm((s) => {
      const next = new Set(s.grants);
      next.delete(`${feature}:read:own`);
      next.delete(`${feature}:read:all`);
      if (scope === 'own' || scope === 'all') next.add(`${feature}:read:${scope}`);
      return { ...s, grants: next };
    });
  }

  async function save() {
    setBusy(true); setError('');
    const res = await call('upsertRole', {
      role_id: form.role_id,
      name: form.name,
      permissions: Array.from(form.grants),
      active: form.active,
    });
    setBusy(false);
    if (res.ok) onSaved(res.data ? res.data.name : form.name);
    else setError(res.error);
  }

  return (
    <Modal
      title={row._new ? 'Add role' : `Edit ${row.name}`}
      onClose={onClose}
      footer={<>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save role'}</button>
      </>}
    >
      <Alert tone="error" onClose={() => setError('')}>{error}</Alert>

      <Field label="Role name" required hint={form.is_builtin ? 'Built-in roles cannot be renamed.' : undefined}>
        <input value={form.name} disabled={form.is_builtin} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Senior Rep" />
      </Field>

      <Field label="Status">
        <select value={String(form.active)} onChange={(e) => set('active', e.target.value === 'true')}>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </Field>

      <div className="perm-matrix">
        <div className="perm-matrix-head">Permissions</div>
        {FEATURES.map((feature) => {
          const spec = PERMISSIONS[feature];
          const readScope = form.grants.has(`${feature}:read:all`) ? 'all'
            : form.grants.has(`${feature}:read:own`) ? 'own' : 'none';
          return (
            <div className="perm-row" key={feature}>
              <div className="perm-feature">{spec.label}</div>
              <div className="perm-actions">
                {spec.actions.map((action) => {
                  if (action === 'read' && spec.scopedRead) {
                    return (
                      <label className="perm-chip" key={`${feature}:read`}>
                        <span>Read</span>
                        <select value={readScope} onChange={(e) => setReadScope(feature, e.target.value)}>
                          <option value="none">None</option>
                          <option value="own">Own</option>
                          <option value="all">All</option>
                        </select>
                      </label>
                    );
                  }
                  const grant = `${feature}:${action}`;
                  return (
                    <label className="perm-chip" key={grant}>
                      <input type="checkbox" checked={form.grants.has(grant)} onChange={(e) => toggleGrant(grant, e.target.checked)} />
                      <span>{ACTION_LABELS[action] || action}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
        {FEATURES.length === 0 && <Empty>No permission catalog loaded.</Empty>}
      </div>
    </Modal>
  );
}
