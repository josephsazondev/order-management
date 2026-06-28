import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { call } from '../../api/client.js';
import { useApi } from '../../lib/useApi.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { Spinner, Alert, Badge, Empty, Modal, Field } from '../../components/ui.jsx';
import { formatPHP, formatDateLong } from '../../lib/format.js';

// Owner-only customer detail (Story 7.2): master contact record (editable) + full subscription
// history + payment history. Reps never reach this route (guarded on customers:read).
export default function CustomerDetail() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { data, loading, error, reload } = useApi('getCustomer', { customer_id: customerId });
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState('');
  // Action controls are gated per-grant; the server independently enforces each mutation.
  const canEdit = can('customers', 'update');
  const canCreateSub = can('subscriptions', 'create');

  if (loading) return <div className="page"><Spinner /></div>;
  if (error) {
    return (
      <div className="page">
        <Alert tone="error">{error}</Alert>
        <Link className="btn ghost" to="/customers">← Back to customers</Link>
      </div>
    );
  }

  const c = data.customer;
  const subs = data.subscriptions || [];
  const payments = data.payments || [];

  function startNewSubscription() {
    // Prefill the New Subscription form and link it to this client.
    navigate('/new', { state: { customer: c } });
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link className="muted small" to="/customers">← Customers</Link>
          <h1>{c.customer_name}</h1>
          <p className="muted">{c.customer_id} · joined {formatDateLong(String(c.created_at).slice(0, 10))}</p>
        </div>
        <div className="row gap">
          {canEdit && <button className="btn ghost" onClick={() => setEditing(true)}>Edit details</button>}
          {canCreateSub && <button className="btn primary" onClick={startNewSubscription}>+ New subscription</button>}
        </div>
      </div>

      <Alert tone={msg.includes('Forbidden') ? 'error' : 'info'} onClose={() => setMsg('')}>{msg}</Alert>

      <div className="card">
        <div className="grid-2">
          <div><div className="stat-label">Phone</div><div>{c.customer_phone || '—'}</div></div>
          <div><div className="stat-label">Address</div><div>{c.customer_address || '—'}</div></div>
          <div><div className="stat-label">Allergy concerns</div><div>{c.allergy_concerns || '—'}</div></div>
          <div><div className="stat-label">Food requests</div><div>{c.food_requests || '—'}</div></div>
        </div>
      </div>

      <h2 className="section-head">Subscription history</h2>
      {subs.length === 0 ? <Empty>No subscriptions for this customer.</Empty> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>ID</th><th>Product</th><th className="right">Qty</th><th>Start</th><th>Created by</th><th>Status</th></tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.subscription_id}>
                  <td data-label="ID">{s.subscription_id}</td>
                  <td data-label="Product">{s.product}</td>
                  <td className="right" data-label="Qty">{s.quantity}</td>
                  <td data-label="Start">{formatDateLong(s.start_date)}</td>
                  <td data-label="Created by">{s.created_by}</td>
                  <td data-label="Status"><Badge>{s.is_active ? 'Active' : 'Inactive'}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="section-head">Payment history</h2>
      {payments.length === 0 ? <Empty>No payments recorded for this customer yet.</Empty> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Payment ID</th><th>Week</th><th className="right">Amount</th><th>Method</th><th>Status</th></tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.payment_id}>
                  <td data-label="Payment ID">{p.payment_id}</td>
                  <td data-label="Week">{p.week_group}</td>
                  <td className="right" data-label="Amount">{formatPHP(p.amount_php)}</td>
                  <td data-label="Method">{p.payment_method}</td>
                  <td data-label="Status"><Badge>{p.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EditCustomerModal customer={c} onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); reload(); setMsg('Customer details updated.'); }}
          onError={setMsg} />
      )}
    </div>
  );
}

function EditCustomerModal({ customer, onClose, onSaved, onError }) {
  const [form, setForm] = useState({ ...customer });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (f, v) => setForm((s) => ({ ...s, [f]: v }));

  async function save() {
    setBusy(true); setError('');
    const res = await call('updateCustomer', {
      customer_id: customer.customer_id,
      customer_name: form.customer_name, customer_address: form.customer_address,
      customer_phone: form.customer_phone, allergy_concerns: form.allergy_concerns, food_requests: form.food_requests,
    });
    setBusy(false);
    if (res.ok) onSaved(); else { setError(res.error); onError?.(res.error); }
  }

  return (
    <Modal title={`Edit ${customer.customer_id}`} onClose={onClose}
      footer={<>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
      </>}>
      <Alert tone="error" onClose={() => setError('')}>{error}</Alert>
      <p className="muted small">Editing the master record updates this client going forward. Past subscriptions keep the details they were created with.</p>
      <Field label="Customer name"><input value={form.customer_name} onChange={(e) => set('customer_name', e.target.value)} /></Field>
      <Field label="Address"><input value={form.customer_address} onChange={(e) => set('customer_address', e.target.value)} /></Field>
      <Field label="Phone"><input value={form.customer_phone} onChange={(e) => set('customer_phone', e.target.value)} /></Field>
      <Field label="Allergy concerns"><textarea rows="2" value={form.allergy_concerns} onChange={(e) => set('allergy_concerns', e.target.value)} /></Field>
      <Field label="Food requests"><textarea rows="2" value={form.food_requests} onChange={(e) => set('food_requests', e.target.value)} /></Field>
    </Modal>
  );
}
