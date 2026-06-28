/**
 * Audit.gs — append-only action log.
 */

function logAction_(user, action, recordId, recordType, details) {
  var existing = readObjects(CONFIG.SHEETS.AUDIT);
  var nextId = existing.reduce(function (m, r) { return Math.max(m, Number(r.log_id) || 0); }, 0) + 1;
  appendObject(CONFIG.SHEETS.AUDIT, {
    log_id: nextId,
    timestamp: nowTimestamp_(),
    user_id: user.email,
    user_role: user.role,
    action: action,
    record_id: recordId,
    record_type: recordType,
    details: typeof details === 'string' ? details : JSON.stringify(details),
    ip_address: '',
  });
}

function listAudit_(payload, user) {
  requirePermission_(user, 'audit', 'read');
  return readObjects(CONFIG.SHEETS.AUDIT).sort(function (a, b) {
    return Number(b.log_id) - Number(a.log_id);
  });
}
