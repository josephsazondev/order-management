import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { call } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useApi } from '../../lib/useApi.js';
import { Badge, Spinner, Alert, Modal, Field, StatCard, Empty, Pagination } from '../../components/ui.jsx';
import { formatPHP, todayISO } from '../../lib/format.js';
import { getWeekInfo } from '../../lib/week.js';

const COLSPAN = 11;

export default function OwnerSubscriptions() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const canInvoice = can('invoices', 'create');
  const [invoicing, setInvoicing] = useState(null);
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [rep, setRep] = useState('all');
  const [status, setStatus] = useState('all');
  const [week, setWeek] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [expanded, setExpanded] = useState(null);
  const [paymentRefresh, setPaymentRefresh] = useState(0);
  const [editing, setEditing] = useState(null);
  const [paying, setPaying] = useState(null);
  const [msg, setMsg] = useState('');

  // Debounce the search box, and snap back to page 1 whenever a filter changes.
  useEffect(() => {
    const t = setTimeout(() => { setQ(qInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const { data, loading, error, reload } = useApi('listSubscriptions', { page, pageSize, q, rep, status, week });
  const { data: products } = useApi('listProducts');

  const rows = data?.rows || [];
  const counts = data?.counts || { total: 0, active: 0, inactive: 0 };
  const reps = data?.reps || [];
  const weeks = data?.weeks || [];

  const priceMap = useMemo(() => {
    const m = {};
    (products || []).forEach((p) => { m[p.product_name] = Number(p.price_per_week); });
    return m;
  }, [products]);
  const productNames = (products || []).filter((p) => p.active).map((p) => p.product_name);

  function changeRep(v) { setRep(v); setPage(1); }
  function changeStatus(v) { setStatus(v); setPage(1); }
  function changeWeek(v) { setWeek(v); setPage(1); }
  function changePageSize(v) { setPageSize(v); setPage(1); }
  function toggle(id) { setExpanded((cur) => (cur === id ? null : id)); }

  async function toggleActive(s) {
    const activate = !s.is_active;
    const note = activate ? '' : (prompt('Reason for deactivating (optional):') || '');
    const res = await call('setSubscriptionActive', { subscription_id: s.subscription_id, is_active: activate, note });
    if (res.ok) { setMsg(`${s.subscription_id} ${activate ? 'activated' : 'deactivated'}.`); reload(); } else setMsg(res.error);
  }

  async function del(s) {
    if (!confirm(`Delete ${s.subscription_id} (${s.customer_name})? It will be hidden everywhere but kept in the audit log.`)) return;
    const reason = prompt('Reason for deletion (optional):') || '';
    const res = await call('deleteSubscription', { subscription_id: s.subscription_id, reason });
    if (res.ok) { setMsg(`${s.subscription_id} deleted.`); if (expanded === s.subscription_id) setExpanded(null); reload(); } else setMsg(res.error);
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Subscriptions</h1>
          <p className="muted">All subscriptions across every rep. Expand a row to see and record its payments.</p>
        </div>
        <Link className="btn primary" to="/new">+ New Subscription</Link>
      </div>

      <div className="stat-row">
        <StatCard label="Total" value={counts.total} />
        <StatCard label="Active" value={counts.active} tone="ok" />
        <StatCard label="Inactive" value={counts.inactive} tone="muted" />
      </div>

      <Alert tone={msg.includes('Forbidden') ? 'error' : 'info'} onClose={() => setMsg('')}>{msg}</Alert>
      <Alert tone="error">{error}</Alert>

      <div className="toolbar">
        <input className="search" placeholder="Search name, ID, product…" value={qInput} onChange={(e) => setQInput(e.target.value)} />
        <select value={rep} onChange={(e) => changeRep(e.target.value)}>
          <option value="all">All reps</option>
          {reps.map((r) => <option key={r}>{r}</option>)}
        </select>
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

      {loading ? <Spinner /> : rows.length === 0 ? (
        <Empty>No subscriptions match.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="expand-col" aria-label="expand" />
                <th>ID</th>
                <th>Customer</th>
                <th>Rep</th>
                <th>Product</th>
                <th className="right">Qty</th>
                <th className="right">Weekly</th>
                <th>Allergies</th>
                <th>Food requests</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const open = expanded === r.subscription_id;
                const amount = (priceMap[r.product] || 0) * r.quantity;
                return (
                  <Fragment key={r.subscription_id}>
                    <tr className={open ? 'expanded' : ''}>
                      <td className="cell-expand">
                        <button className="expand-btn" aria-expanded={open} aria-label="Toggle payments"
                          onClick={() => toggle(r.subscription_id)}>{open ? '▾' : '▸'}</button>
                      </td>
                      <td data-label="ID">{r.subscription_id}</td>
                      <td data-label="Customer">{r.customer_name}</td>
                      <td data-label="Rep">{r.created_by}</td>
                      <td data-label="Product">{r.product}</td>
                      <td className="right" data-label="Qty">{r.quantity}</td>
                      <td className="right" data-label="Weekly">{formatPHP(amount)}</td>
                      <td data-label="Allergies">{r.allergy_concerns || '—'}</td>
                      <td data-label="Food requests">{r.food_requests || '—'}</td>
                      <td data-label="Status"><Badge>{r.is_active ? 'Active' : 'Inactive'}</Badge></td>
                      <td className="cell-actions">
                        <div className="row-actions">
                          <button className="link-btn" onClick={() => setEditing(r)}>Edit</button>
                          {canInvoice && <button className="link-btn" onClick={() => setInvoicing(r)}>Invoice</button>}
                          <button className="link-btn" onClick={() => toggleActive(r)}>{r.is_active ? 'Deactivate' : 'Activate'}</button>
                          <button className="link-btn danger" onClick={() => del(r)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                    {open && (
                      <tr className="panel-row">
                        <td colSpan={COLSPAN}>
                          <SubPaymentsPanel
                            sub={r}
                            amount={amount}
                            refreshKey={paymentRefresh}
                            canRecord={r.is_active}
                            onRecord={() => setPaying(r)}
                            onMsg={setMsg}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={data?.page || page} pageSize={data?.pageSize || pageSize} total={data?.total || 0}
        pages={data?.pages} onPage={setPage} onPageSize={changePageSize} />

      {editing && (
        <EditModal sub={editing} productNames={productNames} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); setMsg('Subscription updated.'); }} />
      )}
      {paying && (
        <RecordPaymentModal sub={paying} amount={(priceMap[paying.product] || 0) * paying.quantity}
          onClose={() => setPaying(null)}
          onSaved={(pid) => {
            setPaying(null);
            setExpanded(paying.subscription_id);
            setPaymentRefresh((n) => n + 1);
            setMsg(`Payment ${pid} recorded (Pending Verification).`);
          }} />
      )}
      {invoicing && (
        <GenerateInvoiceModal sub={invoicing} defaultRate={priceMap[invoicing.product] || 0}
          onClose={() => setInvoicing(null)}
          onSaved={(id) => { setInvoicing(null); navigate(`/invoices/${id}`); }} />
      )}
    </div>
  );
}

function GenerateInvoiceModal({ sub, defaultRate, onClose, onSaved }) {
  const [form, setForm] = useState({
    invoice_date: todayISO(),
    description: sub.product,
    line_note: '',
    quantity: sub.quantity,
    rate: defaultRate,
    notes: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (f, v) => setForm((s) => ({ ...s, [f]: v }));
  const amount = (Number(form.quantity) || 0) * (Number(form.rate) || 0);

  async function save() {
    setBusy(true); setError('');
    const res = await call('createInvoice', { subscription_id: sub.subscription_id, ...form });
    setBusy(false);
    if (res.ok) onSaved(res.data.invoice_id); else setError(res.error);
  }

  return (
    <Modal title={`Generate invoice — ${sub.customer_name}`} onClose={onClose}
      footer={<>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Generating…' : 'Generate invoice'}</button>
      </>}>
      <Alert tone="error" onClose={() => setError('')}>{error}</Alert>
      <p className="muted small">Prefilled from {sub.subscription_id}. Edit any field before generating.</p>
      <Field label="Invoice date" required>
        <input type="date" value={form.invoice_date} onChange={(e) => set('invoice_date', e.target.value)} />
      </Field>
      <Field label="Description" required hint="Line-item label, e.g. TMAD 1 30+5 LCHP (REM BALANCE)">
        <input value={form.description} onChange={(e) => set('description', e.target.value)} />
      </Field>
      <Field label="Line note" hint="Sub-text under the description, e.g. 25 days remaining/ 35">
        <input value={form.line_note} onChange={(e) => set('line_note', e.target.value)} />
      </Field>
      <div className="grid-2">
        <Field label="Quantity" required>
          <input type="number" min="0" step="0.01" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
        </Field>
        <Field label="Rate (₱)" required>
          <input type="number" min="0" step="0.01" value={form.rate} onChange={(e) => set('rate', e.target.value)} />
        </Field>
      </div>
      <p className="muted small">Amount: <strong>{formatPHP(amount)}</strong></p>
      <Field label="Notes" hint="Optional, shown at the bottom of the invoice">
        <textarea rows="2" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      </Field>
    </Modal>
  );
}

// Lazy-loaded payment history for one subscription. Only mounts when its row is expanded,
// so we never pull every payment up front.
function SubPaymentsPanel({ sub, amount, refreshKey, canRecord, onRecord, onMsg }) {
  const { data, loading, error, reload } = useApi('listPayments', { subscription_id: sub.subscription_id }, [refreshKey]);
  const payments = data || [];

  async function act(action, p, extra) {
    const res = await call(action, { payment_id: p.payment_id, ...extra });
    if (res.ok) { reload(); onMsg(`${p.payment_id}: ${res.data.status}.`); } else onMsg(res.error);
  }

  const verifiedTotal = payments.filter((p) => p.status === 'Verified').reduce((s, p) => s + p.amount_php, 0);

  return (
    <div className="sub-panel">
      <div className="sub-panel-head">
        <div>
          <strong>Payments</strong>
          <span className="muted small"> · {sub.customer_name} · weekly {formatPHP(amount)} · {payments.length} recorded · {formatPHP(verifiedTotal)} verified</span>
        </div>
        {canRecord
          ? <button className="btn primary small" onClick={onRecord}>+ Record payment</button>
          : <span className="muted small">Activate this subscription to record payments.</span>}
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {loading ? <Spinner /> : payments.length === 0 ? (
        <div className="sub-panel-empty">No payments recorded for this subscription yet.</div>
      ) : (
        <table className="data-table inner">
          <thead>
            <tr>
              <th>Payment ID</th><th>Week</th><th className="right">Amount</th>
              <th>Method</th><th>Reference</th><th>Proof</th><th>Status</th><th />
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.payment_id}>
                <td data-label="Payment ID">{p.payment_id}</td>
                <td data-label="Week">{p.week_group}</td>
                <td className="right" data-label="Amount">{formatPHP(p.amount_php)}</td>
                <td data-label="Method">{p.payment_method}</td>
                <td data-label="Reference">{p.customer_reference}</td>
                <td data-label="Proof">{p.proof_of_payment ? <a href={p.proof_of_payment} target="_blank" rel="noreferrer">view</a> : '—'}</td>
                <td data-label="Status"><Badge>{p.status}</Badge></td>
                <td className="cell-actions">
                  <div className="row-actions">
                    {p.status === 'Pending Verification' && (
                      <>
                        <button className="link-btn ok" onClick={() => act('verifyPayment', p)}>Verify</button>
                        <button className="link-btn danger" onClick={() => act('disputePayment', p, { reason: prompt('Dispute reason:') || '' })}>Dispute</button>
                      </>
                    )}
                    {p.status === 'Verified' && (
                      <>
                        <button className="link-btn" onClick={() => act('revertPayment', p)}>Revert</button>
                        <button className="link-btn" onClick={() => act('refundPayment', p, { reason: prompt('Refund reason:') || '' })}>Refund</button>
                      </>
                    )}
                    {(p.status === 'Disputed' || p.status === 'Refunded') && (
                      <button className="link-btn" onClick={() => act('revertPayment', p)}>Revert to pending</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function EditModal({ sub, productNames, onClose, onSaved }) {
  const [form, setForm] = useState({ ...sub });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (f, v) => setForm((s) => ({ ...s, [f]: v }));

  async function save() {
    setBusy(true); setError('');
    const res = await call('updateSubscription', form);
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
            {[form.product, ...productNames.filter((n) => n !== form.product)].map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Quantity"><input type="number" min="1" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} /></Field>
      </div>
      <Field label="Allergy concerns"><textarea rows="2" value={form.allergy_concerns} onChange={(e) => set('allergy_concerns', e.target.value)} /></Field>
      <Field label="Food requests"><textarea rows="2" value={form.food_requests} onChange={(e) => set('food_requests', e.target.value)} /></Field>
      <Field label="Internal notes" hint="Owner only — never visible to reps">
        <textarea rows="2" value={form.internal_notes} onChange={(e) => set('internal_notes', e.target.value)} />
      </Field>
    </Modal>
  );
}

function RecordPaymentModal({ sub, amount, onClose, onSaved }) {
  const { settings } = useAuth();
  const methods = settings.payment_methods || ['GCash', 'Bank Transfer', 'COD', 'Card'];
  const currentWeek = getWeekInfo(new Date()).weekId;
  const [form, setForm] = useState({ week_group: currentWeek, payment_method: methods[0], customer_reference: '', proof_of_payment: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (f, v) => setForm((s) => ({ ...s, [f]: v }));

  async function save() {
    setBusy(true); setError('');
    const res = await call('recordPayment', { subscription_id: sub.subscription_id, ...form });
    setBusy(false);
    if (res.ok) onSaved(res.data.payment_id); else setError(res.error);
  }

  return (
    <Modal title={`Record payment — ${sub.customer_name}`} onClose={onClose}
      footer={<>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Record payment'}</button>
      </>}>
      <Alert tone="error" onClose={() => setError('')}>{error}</Alert>
      <p className="muted small">
        {sub.product} × {sub.quantity} — amount <strong>{formatPHP(amount)}</strong> is derived from the product price and cannot be hand-entered.
      </p>
      <div className="grid-2">
        <Field label="Week group" required hint="Defaults to the current week">
          <input value={form.week_group} onChange={(e) => set('week_group', e.target.value)} />
        </Field>
        <Field label="Payment method" required>
          <select value={form.payment_method} onChange={(e) => set('payment_method', e.target.value)}>
            {methods.map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Customer reference" required hint="GCash ref / bank slip #">
        <input value={form.customer_reference} onChange={(e) => set('customer_reference', e.target.value)} />
      </Field>
      <Field label="Proof of payment URL" hint="Optional">
        <input value={form.proof_of_payment} onChange={(e) => set('proof_of_payment', e.target.value)} />
      </Field>
    </Modal>
  );
}
