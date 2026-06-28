import { useState } from 'react';
import { useApi } from '../../lib/useApi.js';
import { Table, Badge, Spinner, Alert } from '../../components/ui.jsx';

export default function AuditLog() {
  const { data, loading, error } = useApi('listAudit');
  const [q, setQ] = useState('');
  const rows = (data || []).filter((r) =>
    !q || `${r.user_id} ${r.action} ${r.record_id} ${r.record_type}`.toLowerCase().includes(q.toLowerCase())
  );

  const columns = [
    { key: 'log_id', header: '#', align: 'right' },
    { key: 'timestamp', header: 'Timestamp' },
    { key: 'user_id', header: 'User' },
    { key: 'user_role', header: 'Role', render: (r) => <Badge tone={r.user_role === 'owner' ? 'ok' : 'muted'}>{r.user_role}</Badge> },
    { key: 'action', header: 'Action' },
    { key: 'record_id', header: 'Record' },
    { key: 'details', header: 'Details', render: (r) => <code className="details">{r.details}</code> },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Audit Log</h1>
          <p className="muted">Append-only record of every action, for fraud detection. Read-only.</p>
        </div>
      </div>

      <Alert tone="error">{error}</Alert>

      <div className="toolbar">
        <input className="search" placeholder="Search user, action, record…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading ? <Spinner /> : <Table columns={columns} rows={rows} rowKey={(r) => r.log_id} empty="No log entries." />}
    </div>
  );
}
