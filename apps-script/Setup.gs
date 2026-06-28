/**
 * Setup.gs — one-time initialization. Run `setupSheets` once from the editor.
 * Creates all sheets with headers, formats text columns, seeds settings/products,
 * and seeds the bootstrap admin into USERS. Safe to re-run.
 */

function setupSheets() {
  var ss = getSpreadsheet_();
  // Record the parent sheet ID so the deployed web app (where getActiveSpreadsheet()
  // is null) can still reach this same sheet without a hardcoded CONFIG.SPREADSHEET_ID.
  if (!CONFIG.SPREADSHEET_ID) {
    PropertiesService.getScriptProperties().setProperty(BOUND_SPREADSHEET_PROP_, ss.getId());
  }
  ensureSheet_(ss, CONFIG.SHEETS.USERS, HEADERS.USERS);
  ensureSheet_(ss, CONFIG.SHEETS.ROLES, HEADERS.ROLES);
  ensureSheet_(ss, CONFIG.SHEETS.SETTINGS, HEADERS.SETTINGS);
  ensureSheet_(ss, CONFIG.SHEETS.PRODUCTS, HEADERS.PRODUCTS);
  ensureSheet_(ss, CONFIG.SHEETS.CUSTOMERS, HEADERS.CUSTOMERS);
  ensureSheet_(ss, CONFIG.SHEETS.SUBSCRIPTIONS, HEADERS.SUBSCRIPTIONS);
  ensureSheet_(ss, CONFIG.SHEETS.PAYMENTS, HEADERS.PAYMENTS);
  ensureSheet_(ss, CONFIG.SHEETS.INVOICES, HEADERS.INVOICES);
  ensureSheet_(ss, CONFIG.SHEETS.AUDIT, HEADERS.AUDIT);
  seedRoles_();
  seedSettings_();
  seedProducts_();
  seedBootstrapAdmin_();
  Logger.log('Setup complete.');
}

// Seed the 3 built-in roles from BUILTIN_ROLE_PERMISSIONS / BUILTIN_ROLE_META.
// Idempotent: only appends a built-in row that isn't already present.
function seedRoles_() {
  var existing = readObjects(CONFIG.SHEETS.ROLES);
  var have = {};
  existing.forEach(function (r) { have[String(r.role_id)] = true; });
  Object.keys(BUILTIN_ROLE_PERMISSIONS).forEach(function (roleId) {
    if (have[roleId]) return;
    appendObject(CONFIG.SHEETS.ROLES, {
      role_id: roleId,
      name: (BUILTIN_ROLE_META[roleId] && BUILTIN_ROLE_META[roleId].name) || roleId,
      is_builtin: true,
      permissions_json: JSON.stringify(BUILTIN_ROLE_PERMISSIONS[roleId]),
      created_by: 'system',
      created_at: nowTimestamp_(),
      active: true,
    });
  });
}

function ensureSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  var existing = sheet.getLastColumn() > 0 ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
  if (existing.join('|') !== headers.join('|')) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  headers.forEach(function (h, i) {
    if (TEXT_COLUMNS.indexOf(h) >= 0) sheet.getRange(1, i + 1, sheet.getMaxRows(), 1).setNumberFormat('@');
  });
  return sheet;
}

function seedSettings_() {
  if (readObjects(CONFIG.SHEETS.SETTINGS).length > 0) return;
  Object.keys(DEFAULT_SETTINGS).forEach(function (k) {
    var v = DEFAULT_SETTINGS[k];
    appendObject(CONFIG.SHEETS.SETTINGS, { key: k, value: (JSON_SETTINGS_KEYS.indexOf(k) >= 0) ? JSON.stringify(v) : v });
  });
}

function seedProducts_() {
  if (readObjects(CONFIG.SHEETS.PRODUCTS).length > 0) return;
  [
    { product_name: 'Keto Plan', price_per_week: 3500, num_days: 7, active: true },
    { product_name: 'Standard Plan', price_per_week: 2800, num_days: 7, active: true },
    { product_name: 'Protein+ Plan', price_per_week: 4200, num_days: 7, active: true },
  ].forEach(function (p) { appendObject(CONFIG.SHEETS.PRODUCTS, p); });
}

function seedBootstrapAdmin_() {
  var users = readObjects(CONFIG.SHEETS.USERS);
  CONFIG.ADMIN_BOOTSTRAP_EMAILS.forEach(function (email) {
    if (!users.some(function (u) { return String(u.email).toLowerCase() === email.toLowerCase(); })) {
      appendObject(CONFIG.SHEETS.USERS, {
        email: email, role: ROLES.ADMIN, assigned_by: 'system', assigned_at: nowTimestamp_(), active: true,
      });
    }
  });
}

/** Optional demo data: a few users, subscriptions. Run manually once. */
function seedDemoData() {
  [
    ['owner@ketolab.com', ROLES.OWNER], ['maria@ketolab.com', ROLES.REP], ['carlos@ketolab.com', ROLES.REP],
  ].forEach(function (u) {
    appendObject(CONFIG.SHEETS.USERS, { email: u[0], role: u[1], assigned_by: 'system', assigned_at: nowTimestamp_(), active: true });
  });
  var demo = [
    ['Juan dela Cruz', '12 Mabini St, QC', '09171234567', 'No shellfish', 'Less oil', 'Keto Plan', 1, '2025-06-16', true, 'maria@ketolab.com'],
    ['Sofia Santos', '88 Katipunan Ave, QC', '09181112233', '', 'Extra veggies', 'Standard Plan', 2, '2025-06-16', true, 'maria@ketolab.com'],
  ];
  demo.forEach(function (d, i) {
    var datePart = d[7].replace(/-/g, '');
    appendObject(CONFIG.SHEETS.SUBSCRIPTIONS, {
      subscription_id: 'SUB-' + datePart + '-' + pad3_(i + 1), customer_name: d[0], customer_address: d[1],
      customer_phone: d[2], allergy_concerns: d[3], food_requests: d[4], product: d[5], quantity: d[6],
      start_date: d[7], is_active: d[8], is_deleted: false, created_by: d[9], created_at: nowTimestamp_(), internal_notes: '',
    });
  });
  Logger.log('Demo data added.');
}
