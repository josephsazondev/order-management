// Small hand-rolled UI primitives (no external UI library, per spec).

export function StatCard({ label, value, sub, tone }) {
  return (
    <div className={`stat-card ${tone || ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

const STATUS_TONE = {
  'Verified': 'ok',
  'Pending Payment': 'warn',
  'Pending Verification': 'warn',
  'Overdue': 'danger',
  'Cancelled': 'muted',
  'Disputed': 'danger',
  'Refunded': 'muted',
  'Active': 'ok',
  'Inactive': 'muted',
};

export function Badge({ children, tone }) {
  const t = tone || STATUS_TONE[children] || 'muted';
  return <span className={`badge ${t}`}>{children}</span>;
}

export function Field({ label, hint, children, required }) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <em className="req"> *</em>}
      </span>
      {children}
      {hint && <small className="hint">{hint}</small>}
    </label>
  );
}

export function Alert({ tone = 'info', children, onClose }) {
  if (!children) return null;
  return (
    <div className={`alert ${tone}`}>
      <span>{children}</span>
      {onClose && (
        <button className="alert-close" onClick={onClose} aria-label="Dismiss">×</button>
      )}
    </div>
  );
}

export function Modal({ title, children, onClose, footer }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="alert-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

export function Spinner({ label }) {
  return <div className="spinner-row"><span className="spinner" /> {label || 'Loading…'}</div>;
}

export function Pagination({ page, pageSize, total, pages, pageSizeOptions, onPage, onPageSize }) {
  if (!total) return null;
  const totalPages = pages || Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="pagination">
      <span className="muted small">{from}–{to} of {total}</span>
      <div className="pager-controls">
        {onPageSize && (
          <select className="page-size" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
            {(pageSizeOptions || [5, 10, 25, 50]).map((n) => <option key={n} value={n}>{n} / page</option>)}
          </select>
        )}
        <button className="btn ghost small" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Prev</button>
        <span className="small">Page {page} / {totalPages}</span>
        <button className="btn ghost small" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next →</button>
      </div>
    </div>
  );
}

export function Table({ columns, rows, rowKey, empty }) {
  if (!rows || rows.length === 0) {
    return <Empty>{empty || 'Nothing here yet.'}</Empty>;
  }
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} className={c.align}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey ? rowKey(row) : i}>
              {columns.map((c) => (
                <td key={c.key} className={c.align} data-label={c.header}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
