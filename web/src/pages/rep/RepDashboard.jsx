import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { call } from '../../api/client.js';
import { useApi } from '../../lib/useApi.js';
import { Table, Badge, StatCard, Spinner, Alert, Modal, Field, Pagination } from '../../components/ui.jsx';
import { formatDateLong } from '../../lib/format.js';

export default function RepDashboard() {
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [week, setWeek] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const t = setTimeout(() => { setQ(qInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const { data, loading, error, reload } = useApi('listSubscriptions', { page, pageSize, q, status, week });
  const subs = data?.rows || [];
  const counts = data?.counts || { total: 0, active: 0, inactive: 0 };
  const weeks = data?.weeks || [];

  function changeStatus(v) { setStatus(v); setPage(1); }
  function changeWeek(v) { setWeek(v); setPage(1); }

  const columns = [
    { key: 'subscription_id', header: 'Subscription ID' },
    { key: 'customer_name', header: 'Customer' },
    { key: 'product', header: 'Product' },
    { key: 'quantity', header: 'Qty', align: 'right' },
    { key: 'start_date', header: 'Start', render: (r) => formatDateLong(r.start_date) },
    { key: 'allergy_concerns', header: 'Allergies', render: (r) => r.allergy_concerns || '—' },
    { key: 'is_active', header: 'Status', render: (r) => <Badge>{r.is_active ? 'Active' : 'Inactive'}</Badge> },
    { key: 'actions', header: '', render: (r) => <button className="link-btn" onClick={() => setEditing(r)}>Edit</button> },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>My Subscriptions</h1>
          <p className="muted">Customers you've enrolled. You can edit your own entries. Pricing and payments are managed by the owner.</p>
        </div>
        <Link className="btn primary" to="/new">+ New Subscription</Link>
      </div>

      <div className="stat-row">
        <StatCard label="Total subscriptions" value={counts.total} />
        <StatCard label="Active" value={counts.active} tone="ok" />
        <StatCard label="Pending / inactive" value={counts.inactive} tone="muted" />
      </div>

      <Alert tone={msg.includes('Forbidden') ? 'error' : 'info'} onClose={() => setMsg('')}>{msg}</Alert>
      <Alert tone="error">{error}</Alert>

      <div className="toolbar">
        <input className="search" placeholder="Search name, ID, product…" value={qInput} onChange={(e) => setQInput(e.target.value)} />
        <select value={status} onChange={(e) => changeStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
        <select value={week} onChange={(e) => changeWeek(e.target.value)}>
          <option value="all">All weeks</option>
          {weeks.map((w) => <option key={w}>{w}</option>)}
        </select>
      </div>

      {loading ? <Spinner /> : (
        <Table columns={columns} rows={subs} rowKey={(r) => r.subscription_id} empty="No subscriptions yet. Create your first one." />
      )}

      <Pagination page={data?.page || page} pageSize={data?.pageSize || pageSize} total={data?.total || 0}
        pages={data?.pages} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />

      {editing && (
        <EditOwnModal sub={editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); setMsg('Subscription updated.'); }} />
      )}
    </div>
  );
}

function EditOwnModal({ sub, onClose, onSaved }) {
  const [products, setProducts] = useState([sub.product]);
  const [form, setForm] = useState({ ...sub });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (f, v) => setForm((s) => ({ ...s, [f]: v }));

  useEffect(() => {
    call('listProductNames').then((res) => { if (res.ok) setProducts(res.data); });
  }, []);

  async function save() {
    setBusy(true); setError('');
    // Reps may not touch internal_notes; the backend enforces this regardless.
    const res = await call('updateSubscription', {
      subscription_id: sub.subscription_id, customer_name: form.customer_name,
      customer_address: form.customer_address, customer_phone: form.customer_phone,
      allergy_concerns: form.allergy_concerns, food_requests: form.food_requests,
      product: form.product, quantity: form.quantity, start_date: form.start_date,
    });
    setBusy(false);
    if (res.ok) onSaved(); else setError(res.error);
  }

  return (
    <Modal title={`Edit ${sub.subscription_id}`} onClose={onClose}
      footer={<>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
      </>}>
      <Alert tone="error" onClose={() => setError('')}>{error}</Alert>
      <Field label="Customer name"><input value={form.customer_name} onChange={(e) => set('customer_name', e.target.value)} /></Field>
      <Field label="Address"><input value={form.customer_address} onChange={(e) => set('customer_address', e.target.value)} /></Field>
      <Field label="Phone"><input value={form.customer_phone} onChange={(e) => set('customer_phone', e.target.value)} /></Field>
      <div className="grid-2">
        <Field label="Product">
          <select value={form.product} onChange={(e) => set('product', e.target.value)}>
            {[form.product, ...products.filter((n) => n !== form.product)].map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Quantity"><input type="number" min="1" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} /></Field>
      </div>
      <Field label="Allergy concerns"><textarea rows="2" value={form.allergy_concerns} onChange={(e) => set('allergy_concerns', e.target.value)} /></Field>
      <Field label="Food requests"><textarea rows="2" value={form.food_requests} onChange={(e) => set('food_requests', e.target.value)} /></Field>
    </Modal>
  );
}
