import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { call } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { Field, Alert, Spinner } from '../../components/ui.jsx';
import { todayISO } from '../../lib/format.js';

const baseForm = () => ({
  customer_id: '', customer_name: '', customer_address: '', customer_phone: '',
  product: '', quantity: 1, allergy_concerns: '', food_requests: '',
  start_date: todayISO(), activate: true,
});

export default function NewSubscription() {
  const { canScope, can } = useAuth();
  // "All" scope = owner-class: gets the full record view and the activate-immediately option.
  const isOwner = canScope('subscriptions', 'all');
  const canLookup = can('customers', 'lookup');
  const location = useLocation();
  const [products, setProducts] = useState(null);
  const [form, setForm] = useState(baseForm());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);

  useEffect(() => {
    call('listProductNames').then((res) => {
      if (res.ok) {
        setProducts(res.data);
        setForm((f) => ({ ...f, product: f.product || res.data[0] || '' }));
      } else setError(res.error);
    });
  }, []);

  // Prefilled + pre-linked when arriving from a customer's detail page.
  useEffect(() => {
    const c = location.state?.customer;
    if (c) setForm((f) => ({ ...f, ...pickContact(c), customer_id: c.customer_id }));
  }, []);

  function update(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  function pickCustomer(c) {
    setForm((f) => ({ ...f, ...pickContact(c), customer_id: c.customer_id }));
  }
  function unlink() {
    setForm((f) => ({ ...f, customer_id: '' }));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    const res = await call('createSubscription', form);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setCreated(res.data);
    setForm({ ...baseForm(), product: (products && products[0]) || '' });
  }

  if (created) {
    return (
      <div className="page narrow">
        <div className="success-card">
          <div className="success-mark">✓</div>
          <h2>Subscription created</h2>
          <p className="muted">Give this reference ID to the customer:</p>
          <div className="ref-id">{created.subscription_id}</div>
          <p className="muted small">
            {isOwner
              ? (created.is_active
                  ? 'It’s active and included in weekly collection.'
                  : 'Saved as inactive — activate it from Subscriptions when ready.')
              : 'It’s now pending owner activation. You won’t see pricing or payment details — that’s by design.'}
          </p>
          <div className="row gap">
            <button className="btn primary" onClick={() => setCreated(null)}>Create another</button>
            <Link className="btn ghost" to={isOwner ? '/subscriptions' : '/'}>{isOwner ? 'Back to subscriptions' : 'Back to my subscriptions'}</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!products) return <div className="page narrow"><Spinner /></div>;

  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <h1>New Subscription</h1>
          <p className="muted">Enter customer details from the FB Messenger inquiry.</p>
        </div>
      </div>

      <Alert tone="error" onClose={() => setError('')}>{error}</Alert>

      <form className="card form" onSubmit={submit}>
        {canLookup && (
          form.customer_id ? (
            <div className="linked-banner">
              <span>Linked to existing client <strong>{form.customer_id}</strong>. Fields below are this order’s details and stay editable.</span>
              <button type="button" className="link-btn" onClick={unlink}>Use a new client instead</button>
            </div>
          ) : (
            <CustomerPicker onPick={pickCustomer} />
          )
        )}

        <Field label="Customer name" required><input value={form.customer_name} onChange={(e) => update('customer_name', e.target.value)} required /></Field>
        <Field label="Delivery address" hint="Optional"><input value={form.customer_address} onChange={(e) => update('customer_address', e.target.value)} /></Field>
        <Field label="Contact number" hint="Optional"><input value={form.customer_phone} onChange={(e) => update('customer_phone', e.target.value)} /></Field>

        <div className="grid-2">
          <Field label="Product" required>
            <select value={form.product} onChange={(e) => update('product', e.target.value)}>
              {products.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Quantity" required><input type="number" min="1" value={form.quantity} onChange={(e) => update('quantity', e.target.value)} required /></Field>
        </div>

        <Field label="Start date" required><input type="date" value={form.start_date} onChange={(e) => update('start_date', e.target.value)} required /></Field>
        <Field label="Allergy concerns" hint="Optional"><textarea rows="2" value={form.allergy_concerns} onChange={(e) => update('allergy_concerns', e.target.value)} /></Field>
        <Field label="Food requests" hint="Optional"><textarea rows="2" value={form.food_requests} onChange={(e) => update('food_requests', e.target.value)} /></Field>

        {isOwner && (
          <label className="check-row">
            <input type="checkbox" checked={form.activate} onChange={(e) => update('activate', e.target.checked)} />
            <span>Activate immediately <small className="muted">(include in weekly collection right away)</small></span>
          </label>
        )}

        <div className="row gap">
          <button className="btn primary" disabled={busy} type="submit">{busy ? 'Saving…' : 'Create subscription'}</button>
          <Link className="btn ghost" to="/">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

function pickContact(c) {
  return {
    customer_name: c.customer_name || '', customer_address: c.customer_address || '',
    customer_phone: c.customer_phone || '', allergy_concerns: c.allergy_concerns || '',
    food_requests: c.food_requests || '',
  };
}

// Typeahead over existing clients (lookup-only). Non-blocking: any failure is silent so the
// rep can always fall through to typing a new client manually.
function CustomerPicker({ onPick }) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const q = term.trim();
    if (!q) { setResults(null); setOpen(false); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await call('lookupCustomers', { q });
      setLoading(false);
      if (res.ok) { setResults(res.data); setOpen(true); }
    }, 300);
    return () => clearTimeout(t);
  }, [term]);

  return (
    <div className="customer-picker">
      <Field label="Returning client?" hint="Search a saved client to autofill — or just type a new one below">
        <input
          placeholder="Search name, phone, or ID…"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onFocus={() => results && setOpen(true)}
        />
      </Field>
      {open && (
        <div className="picker-dropdown">
          {loading && <div className="picker-item muted">Searching…</div>}
          {!loading && results && results.length === 0 && (
            <div className="picker-item muted">No saved client — a new one will be created on save.</div>
          )}
          {!loading && results && results.map((c) => (
            <button type="button" key={c.customer_id} className="picker-item"
              onClick={() => { onPick(c); setTerm(''); setOpen(false); }}>
              <strong>{c.customer_name}</strong>
              <span className="muted small"> · {c.customer_phone || 'no phone'} · {c.customer_id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
