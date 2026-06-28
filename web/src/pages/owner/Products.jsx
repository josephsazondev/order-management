import { useState } from 'react';
import { call } from '../../api/client.js';
import { useApi } from '../../lib/useApi.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { Table, Badge, Spinner, Alert, Modal, Field } from '../../components/ui.jsx';
import { formatPHP } from '../../lib/format.js';

export default function Products() {
  const { can } = useAuth();
  const { data, loading, error, reload } = useApi('listProducts');
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');
  const rows = data || [];

  // Action controls are gated per-grant — a role with only products:read sees a read-only
  // catalog. The server independently enforces each mutation.
  const canCreate = can('products', 'create');
  const canUpdate = can('products', 'update');
  const canDelete = can('products', 'delete');

  async function deactivate(r) {
    if (!confirm(`Deactivate "${r.product_name}"? It stays on existing subscriptions but can't be picked for new ones.`)) return;
    const res = await call('deleteProduct', { product_name: r.product_name });
    if (res.ok) { setMsg(`${r.product_name} deactivated.`); reload(); } else setMsg(res.error);
  }

  const columns = [
    { key: 'product_name', header: 'Product' },
    { key: 'price_per_week', header: 'Price / week', align: 'right', render: (r) => formatPHP(r.price_per_week) },
    { key: 'num_days', header: 'Days', align: 'right' },
    { key: 'active', header: 'Status', render: (r) => <Badge>{r.active ? 'Active' : 'Inactive'}</Badge> },
  ];
  if (canUpdate || canDelete) {
    columns.push({
      key: 'actions', header: '', render: (r) => (
        <div className="row-actions">
          {canUpdate && <button className="link-btn" onClick={() => setEditing(r)}>Edit</button>}
          {canDelete && r.active && <button className="link-btn danger" onClick={() => deactivate(r)}>Deactivate</button>}
        </div>
      ),
    });
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Products</h1>
          <p className="muted">The meal-plan catalog and weekly prices. Drives all payment amounts. Reps can view it for reference; editing needs the products permissions.</p>
        </div>
        {canCreate && (
          <button className="btn primary" onClick={() => setEditing({ product_name: '', price_per_week: 0, num_days: 7, active: true, _new: true })}>+ Add product</button>
        )}
      </div>

      <Alert tone={msg.includes('Forbidden') ? 'error' : 'info'} onClose={() => setMsg('')}>{msg}</Alert>
      <Alert tone="error">{error}</Alert>

      {loading ? <Spinner /> : <Table columns={columns} rows={rows} rowKey={(r) => r.product_name} empty="No products configured." />}

      {editing && (
        <ProductModal row={editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); setMsg('Product saved.'); }} />
      )}
    </div>
  );
}

function ProductModal({ row, onClose, onSaved }) {
  const [form, setForm] = useState({ ...row });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (f, v) => setForm((s) => ({ ...s, [f]: v }));

  async function save() {
    setBusy(true); setError('');
    const res = await call('upsertProduct', form);
    setBusy(false);
    if (res.ok) onSaved(); else setError(res.error);
  }

  return (
    <Modal title={row._new ? 'Add product' : `Edit ${row.product_name}`} onClose={onClose}
      footer={<>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
      </>}>
      <Alert tone="error" onClose={() => setError('')}>{error}</Alert>
      <Field label="Product name" required>
        <input value={form.product_name} disabled={!row._new} onChange={(e) => set('product_name', e.target.value)} />
      </Field>
      <div className="grid-2">
        <Field label="Price per week (₱)" required>
          <input type="number" min="0" step="0.01" value={form.price_per_week} onChange={(e) => set('price_per_week', e.target.value)} />
        </Field>
        <Field label="Days" required>
          <input type="number" min="1" value={form.num_days} onChange={(e) => set('num_days', e.target.value)} />
        </Field>
      </div>
      <Field label="Status">
        <select value={String(form.active)} onChange={(e) => set('active', e.target.value === 'true')}>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </Field>
    </Modal>
  );
}
