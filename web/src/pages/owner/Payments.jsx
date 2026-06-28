import { useState } from 'react';
import { call } from '../../api/client.js';
import { useApi } from '../../lib/useApi.js';
import { Table, Badge, Spinner, Alert, StatCard } from '../../components/ui.jsx';
import { formatPHP, formatDateLong } from '../../lib/format.js';

export default function Payments() {
  const { data, loading, error, reload } = useApi('listPayments');
  const [status, setStatus] = useState('all');
  const [msg, setMsg] = useState('');
  const payments = data || [];
  const filtered = payments.filter((p) => status === 'all' || p.status === status);

  async function act(action, p, extra) {
    const res = await call(action, { payment_id: p.payment_id, ...extra });
    if (res.ok) { setMsg(`${p.payment_id}: ${res.data.status}.`); reload(); } else setMsg(res.error);
  }

  const columns = [
    { key: 'payment_id', header: 'Payment ID' },
    { key: 'subscription_id', header: 'Subscription' },
    { key: 'week_group', header: 'Week' },
    { key: 'amount_php', header: 'Amount', align: 'right', render: (r) => formatPHP(r.amount_php) },
    { key: 'payment_method', header: 'Method' },
    { key: 'customer_reference', header: 'Reference' },
    { key: 'proof_of_payment', header: 'Proof', render: (r) => r.proof_of_payment ? <a href={r.proof_of_payment} target="_blank" rel="noreferrer">view</a> : '—' },
    { key: 'recorded_date', header: 'Recorded', render: (r) => formatDateLong(r.recorded_date) },
    { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
    {
      key: 'actions', header: '', render: (r) => (
        <div className="row-actions">
          {r.status === 'Pending Verification' && (
            <>
              <button className="link-btn ok" onClick={() => act('verifyPayment', r)}>Verify</button>
              <button className="link-btn danger" onClick={() => act('disputePayment', r, { reason: prompt('Dispute reason:') || '' })}>Dispute</button>
            </>
          )}
          {r.status === 'Verified' && (
            <>
              <button className="link-btn" onClick={() => act('revertPayment', r)}>Revert</button>
              <button className="link-btn" onClick={() => act('refundPayment', r, { reason: prompt('Refund reason:') || '' })}>Refund</button>
            </>
          )}
          {(r.status === 'Disputed' || r.status === 'Refunded') && (
            <button className="link-btn" onClick={() => act('revertPayment', r)}>Revert to pending</button>
          )}
        </div>
      ),
    },
  ];

  const pendingCount = payments.filter((p) => p.status === 'Pending Verification').length;
  const verifiedTotal = payments.filter((p) => p.status === 'Verified').reduce((s, p) => s + p.amount_php, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Payments</h1>
          <p className="muted">Record payments from the Subscriptions page; verify each against your actual GCash / bank deposits here.</p>
        </div>
      </div>

      <div className="stat-row">
        <StatCard label="Payments" value={payments.length} />
        <StatCard label="Pending verification" value={pendingCount} tone={pendingCount ? 'warn' : 'muted'} />
        <StatCard label="Verified total" value={formatPHP(verifiedTotal)} tone="ok" />
      </div>

      <Alert tone={msg.includes('Forbidden') ? 'error' : 'info'} onClose={() => setMsg('')}>{msg}</Alert>
      <Alert tone="error">{error}</Alert>

      <div className="toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {['Pending Verification', 'Verified', 'Disputed', 'Refunded'].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {loading ? <Spinner /> : <Table columns={columns} rows={filtered} rowKey={(r) => r.payment_id} empty="No payments yet. Record one from the Subscriptions page." />}
    </div>
  );
}
