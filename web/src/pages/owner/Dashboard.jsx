import { useEffect, useState } from 'react';
import { call } from '../../api/client.js';
import { useApi } from '../../lib/useApi.js';
import { StatCard, Table, Badge, Spinner, Alert } from '../../components/ui.jsx';
import { formatPHP, pct } from '../../lib/format.js';

export default function Dashboard() {
  const { data: weekData } = useApi('weekOptions');
  const [week, setWeek] = useState('');
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const weeks = (weekData && weekData.weeks) || [];
  useEffect(() => {
    if (!week && weekData) setWeek(weekData.current);
  }, [weekData, week]);

  useEffect(() => {
    if (!week) return;
    setLoading(true);
    call('weeklyDashboard', { week_group: week }).then((res) => {
      if (res.ok) setBoard(res.data); else setError(res.error);
      setLoading(false);
    });
  }, [week]);

  const productRows = board ? Object.entries(board.byProduct).map(([product, v]) => ({ product, ...v })) : [];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Collection status for a billing week. Active subscriptions are expected to pay each week.</p>
        </div>
        <select className="period-select" value={week} onChange={(e) => setWeek(e.target.value)}>
          {weeks.length === 0 && <option>{week || '—'}</option>}
          {weeks.map((w) => <option key={w} value={w}>{w}</option>)}
        </select>
      </div>

      <Alert tone="error">{error}</Alert>

      {loading || !board ? <Spinner /> : (
        <>
          <div className="stat-row">
            <StatCard label="Active subscriptions" value={board.activeCount} />
            <StatCard label="Expected this week" value={formatPHP(board.expectedTotal)} />
            <StatCard label="Collected" value={formatPHP(board.collected)} tone="ok" sub={pct(board.collected, board.expectedTotal) + ' collected'} />
            <StatCard label="Outstanding" value={formatPHP(board.outstanding)} tone={board.outstanding > 0 ? 'danger' : 'ok'} />
          </div>

          <h2 className="section-title">Unpaid / uncollected ({board.unpaid.length})</h2>
          <Table
            columns={[
              { key: 'customer_name', header: 'Customer' },
              { key: 'customer_phone', header: 'Phone' },
              { key: 'product', header: 'Product' },
              { key: 'expected_amount', header: 'Expected', align: 'right', render: (r) => formatPHP(r.expected_amount) },
              { key: 'payment_status', header: 'Payment', render: (r) => <Badge tone={r.payment_status === 'No payment' ? 'muted' : 'warn'}>{r.payment_status}</Badge> },
            ]}
            rows={board.unpaid}
            rowKey={(r) => r.subscription_id}
            empty="Everyone has paid for this week. 🎉"
          />

          <h2 className="section-title">Expected revenue by product</h2>
          <Table
            columns={[
              { key: 'product', header: 'Product' },
              { key: 'count', header: 'Active subs', align: 'right' },
              { key: 'amount', header: 'Expected', align: 'right', render: (r) => formatPHP(r.amount) },
            ]}
            rows={productRows}
            rowKey={(r) => r.product}
            empty="No active subscriptions."
          />
        </>
      )}
    </div>
  );
}
