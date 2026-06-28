import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { call } from '../../api/client.js';
import { useApi } from '../../lib/useApi.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { Table, Spinner, Alert } from '../../components/ui.jsx';
import { formatPHP, formatDateLong } from '../../lib/format.js';

export default function Invoices() {
  const { can } = useAuth();
  const canDelete = can('invoices', 'delete');
  const canConfigure = can('invoices', 'configure');
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setQ(qInput), 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const { data, loading, error, reload } = useApi('listInvoices', { q });
  const rows = data || [];

  async function del(r) {
    if (!confirm(`Delete ${r.invoice_id} (${r.customer_name})? It will be hidden everywhere but kept in the audit log, and its number won't be reused.`)) return;
    const reason = prompt('Reason for deletion (optional):') || '';
    const res = await call('deleteInvoice', { invoice_id: r.invoice_id, reason });
    if (res.ok) { setMsg(`${r.invoice_id} deleted.`); reload(); } else setMsg(res.error);
  }

  const columns = [
    { key: 'invoice_id', header: 'Invoice #', render: (r) => <Link to={`/invoices/${r.invoice_id}`}>{r.invoice_id}</Link> },
    { key: 'invoice_date', header: 'Date', render: (r) => formatDateLong(r.invoice_date) },
    { key: 'customer_name', header: 'Customer' },
    { key: 'description', header: 'Description' },
    { key: 'amount', header: 'Total', align: 'right', render: (r) => formatPHP(r.amount) },
    {
      key: 'actions', header: '', render: (r) => (
        <div className="row-actions">
          {canDelete && <button className="link-btn danger" onClick={() => del(r)}>Delete</button>}
        </div>
      ),
    },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Invoices</h1>
          <p className="muted">Invoices generated from subscriptions. Open one to print or save as PDF.</p>
        </div>
        {canConfigure && <Link className="btn ghost" to="/invoice-settings">Invoice Settings</Link>}
      </div>

      <Alert tone={msg.includes('Forbidden') ? 'error' : 'info'} onClose={() => setMsg('')}>{msg}</Alert>
      <Alert tone="error">{error}</Alert>

      <div className="toolbar">
        <input className="search" placeholder="Search invoice # or customer…" value={qInput} onChange={(e) => setQInput(e.target.value)} />
      </div>

      {loading ? <Spinner /> : (
        <Table columns={columns} rows={rows} rowKey={(r) => r.invoice_id}
          empty="No invoices yet. Generate one from a subscription." />
      )}
    </div>
  );
}
