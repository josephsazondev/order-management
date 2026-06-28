import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../lib/useApi.js';
import { Spinner, Alert, Empty, StatCard, Badge, Pagination } from '../../components/ui.jsx';
import { formatDateLong } from '../../lib/format.js';

// Owner-only Customers directory (Story 7.2). Searchable, paginated list of master client
// records with per-client subscription aggregates; row → per-client history.
export default function CustomersList() {
  const navigate = useNavigate();
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Debounce the search box; snap back to page 1 on a new query.
  useEffect(() => {
    const t = setTimeout(() => { setQ(qInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const { data, loading, error } = useApi('listCustomers', { q, page, pageSize });
  const rows = data?.rows || [];
  const total = data?.counts?.total || 0;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Customers</h1>
          <p className="muted">Every saved client. Open one to see their details and full history.</p>
        </div>
      </div>

      <div className="stat-row">
        <StatCard label="Customers" value={total} />
      </div>

      <Alert tone="error">{error}</Alert>

      <div className="toolbar">
        <input className="search" placeholder="Search name, phone, ID…" value={qInput} onChange={(e) => setQInput(e.target.value)} />
      </div>

      {loading ? <Spinner /> : rows.length === 0 ? (
        <Empty>{q ? `No customers match “${q}”.` : 'No customers yet — they’re created when you add a subscription.'}</Empty>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th className="right">Subscriptions</th>
                <th>Last product</th>
                <th>Last start</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.customer_id} className="clickable" onClick={() => navigate(`/customers/${c.customer_id}`)}>
                  <td data-label="Customer">
                    <div>{c.customer_name}</div>
                    <div className="muted small">{c.customer_id}</div>
                  </td>
                  <td data-label="Phone">{c.customer_phone || '—'}</td>
                  <td className="right" data-label="Subscriptions">
                    {c.subscription_count}
                    {c.active_count > 0 && <> <Badge tone="ok">{c.active_count} active</Badge></>}
                  </td>
                  <td data-label="Last product">{c.last_product || '—'}</td>
                  <td data-label="Last start">{c.last_start_date ? formatDateLong(c.last_start_date) : '—'}</td>
                  <td className="right"><span className="muted">›</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={data?.page || page} pageSize={data?.pageSize || pageSize} total={data?.total || 0}
        pages={data?.pages} onPage={setPage} onPageSize={(v) => { setPageSize(v); setPage(1); }} />
    </div>
  );
}
