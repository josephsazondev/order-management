/**
 * Settings.gs — system configuration (key/value). Read by any authed user; edited by admin only.
 */

function readSettings_() {
  var rows = readObjects(CONFIG.SHEETS.SETTINGS);
  var out = {};
  rows.forEach(function (r) {
    if (JSON_SETTINGS_KEYS.indexOf(r.key) >= 0) {
      try {
        out[r.key] = JSON.parse(r.value);
      } catch (e) {
        // Legacy comma-separated fallback (only meaningful for payment_methods).
        out[r.key] = String(r.value || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      }
    } else if (r.key === 'overdue_days' || r.key === 'invoice_start_number') {
      out[r.key] = Number(r.value);
    } else {
      out[r.key] = r.value;
    }
  });
  // Fill any missing keys from defaults.
  Object.keys(DEFAULT_SETTINGS).forEach(function (k) { if (out[k] === undefined) out[k] = DEFAULT_SETTINGS[k]; });
  return out;
}

// Persist one settings key/value, JSON-encoding the keys in JSON_SETTINGS_KEYS.
function writeSettingValue_(key, value) {
  var stored = (JSON_SETTINGS_KEYS.indexOf(key) >= 0) ? JSON.stringify(value) : value;
  var existing = readObjects(CONFIG.SHEETS.SETTINGS).filter(function (r) { return r.key === key; })[0];
  if (existing) updateByKey(CONFIG.SHEETS.SETTINGS, 'key', key, { value: stored });
  else appendObject(CONFIG.SHEETS.SETTINGS, { key: key, value: stored });
}

function getSettings_(payload, user) {
  return readSettings_();
}

function updateSettings_(payload, user) {
  requirePermission_(user, 'settings', 'update');
  var allowed = ['business_name', 'currency', 'timezone', 'overdue_days', 'payment_methods'];
  return withLock_(function () {
    var before = readSettings_();
    allowed.forEach(function (k) {
      if (payload[k] === undefined) return;
      writeSettingValue_(k, payload[k]);
    });
    var after = readSettings_();
    logAction_(user, 'Updated Settings', 'SETTINGS', 'SETTINGS', { before: before, after: after });
    return after;
  });
}

// Invoice branding + payment accounts — owner-managed (invoices:configure), kept separate
// from admin's System Settings so the owner can brand their own invoices.
function updateInvoiceSettings_(payload, user) {
  requirePermission_(user, 'invoices', 'configure');
  var allowed = ['business_name', 'business_logo', 'business_phone', 'invoice_start_number', 'payment_accounts'];
  return withLock_(function () {
    var before = readSettings_();
    allowed.forEach(function (k) {
      if (payload[k] === undefined) return;
      var value = payload[k];
      if (k === 'invoice_start_number') {
        value = Math.max(1, Math.floor(Number(payload[k]) || 1));
      } else if (k === 'payment_accounts') {
        var list = Array.isArray(value) ? value : [];
        value = list.map(function (a) {
          return {
            method: String((a && a.method) || '').trim(),
            account_name: String((a && a.account_name) || '').trim(),
            account_number: String((a && a.account_number) || '').trim(),
          };
        }).filter(function (a) { return a.method || a.account_name || a.account_number; });
      }
      writeSettingValue_(k, value);
    });
    var after = readSettings_();
    logAction_(user, 'Updated Invoice Settings', 'SETTINGS', 'SETTINGS', { before: before, after: after });
    return after;
  });
}
