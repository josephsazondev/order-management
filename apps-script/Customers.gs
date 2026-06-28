/**
 * Customers.gs — first-class customer records (EPIC 7).
 *
 * Model B (PO-locked): a master CUSTOMERS sheet, manual customer_id (no silent merge-by-phone).
 * Subscriptions carry a `customer_id` FK plus a point-in-time SNAPSHOT of the contact fields
 * (the address/notes used for THAT order). Editing a customer's master record does NOT rewrite
 * historical subscription snapshots — that's intentional.
 *
 *   lookup  (rep + owner) — subscription-form picker; contact fields only, spans all customers.
 *   read    (owner)       — directory list + per-client subscription/payment history.
 *   create  (rep + owner) — a new client, created on subscription save.
 *   update  (owner)       — edit the master contact record.
 */

// Normalize a customer name (trim, lowercase, collapse inner whitespace) for best-effort dedup
// during the one-time backfill. NOT used to merge live records — the manual customer_id is the key.
function normalizeName_(raw) {
  return String(raw == null ? '' : raw).trim().toLowerCase().replace(/\s+/g, ' ');
}

function liveCustomers_() {
  return readObjects(CONFIG.SHEETS.CUSTOMERS).filter(function (c) { return !isTrue_(c.is_deleted); });
}

// Contact-only projection for the rep-facing picker (no created_by / audit metadata).
function customerContactView_(c) {
  return {
    customer_id: c.customer_id, customer_name: c.customer_name, customer_address: c.customer_address,
    customer_phone: c.customer_phone, allergy_concerns: c.allergy_concerns, food_requests: c.food_requests,
  };
}

// Create a CUSTOMERS row from contact fields. Caller holds the lock + has checked customers:create.
function createCustomerRow_(contact, user) {
  var datePart = todayISO_().replace(/-/g, '');
  var custs = readObjects(CONFIG.SHEETS.CUSTOMERS);
  var seq = custs.length + 1;
  var id = 'CUST-' + datePart + '-' + pad3_(seq);
  var row = {
    customer_id: id, customer_name: contact.customer_name, customer_address: contact.customer_address,
    customer_phone: contact.customer_phone, allergy_concerns: contact.allergy_concerns || '',
    food_requests: contact.food_requests || '', created_by: user.email,
    created_at: nowTimestamp_(), updated_at: nowTimestamp_(), is_deleted: false,
  };
  appendObject(CONFIG.SHEETS.CUSTOMERS, row);
  logAction_(user, 'Created Customer', id, 'CUSTOMER', { customer_name: row.customer_name, customer_phone: row.customer_phone });
  return row;
}

// Picker: search all live customers by name / phone / id. Contact fields only.
function lookupCustomers_(payload, user) {
  requirePermission_(user, 'customers', 'lookup');
  var q = String((payload && payload.q) || '').trim().toLowerCase();
  var limit = Math.max(1, Math.min(25, Number(payload && payload.limit) || 8));
  var rows = liveCustomers_();
  if (q) {
    rows = rows.filter(function (c) {
      var hay = (c.customer_name + ' ' + c.customer_phone + ' ' + c.customer_id).toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  rows.sort(function (a, b) { return a.customer_name < b.customer_name ? -1 : a.customer_name > b.customer_name ? 1 : 0; });
  return rows.slice(0, limit).map(customerContactView_);
}

// Owner directory: paginated list with per-client subscription aggregates.
function listCustomers_(payload, user) {
  requirePermission_(user, 'customers', 'read');
  payload = payload || {};
  var subs = liveSubs_();
  var byCust = {};
  subs.forEach(function (s) {
    var k = s.customer_id;
    if (!k) return;
    var agg = byCust[k] || (byCust[k] = { count: 0, active: 0, last_product: '', last_start_date: '' });
    agg.count += 1;
    if (isTrue_(s.is_active)) agg.active += 1;
    if (!agg.last_start_date || String(s.start_date) > String(agg.last_start_date)) {
      agg.last_start_date = s.start_date;
      agg.last_product = s.product;
    }
  });

  var all = liveCustomers_();
  var q = String(payload.q || '').trim().toLowerCase();
  var filtered = all.filter(function (c) {
    if (!q) return true;
    return (c.customer_name + ' ' + c.customer_phone + ' ' + c.customer_id).toLowerCase().indexOf(q) >= 0;
  });
  filtered.sort(function (a, b) { return a.customer_name < b.customer_name ? -1 : a.customer_name > b.customer_name ? 1 : 0; });

  var rows = filtered.map(function (c) {
    var agg = byCust[c.customer_id] || { count: 0, active: 0, last_product: '', last_start_date: '' };
    return {
      customer_id: c.customer_id, customer_name: c.customer_name, customer_phone: c.customer_phone,
      customer_address: c.customer_address, subscription_count: agg.count, active_count: agg.active,
      last_product: agg.last_product, last_start_date: agg.last_start_date, created_at: c.created_at,
    };
  });

  var pageSize = Math.max(1, Number(payload.pageSize) || 10);
  var total = rows.length;
  var pages = Math.max(1, Math.ceil(total / pageSize));
  var page = Math.min(Math.max(1, Number(payload.page) || 1), pages);
  return {
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    page: page, pageSize: pageSize, total: total, pages: pages, counts: { total: all.length },
  };
}

// Owner detail: master record + full subscription history + payment history.
function getCustomer_(payload, user) {
  requirePermission_(user, 'customers', 'read');
  var cust = liveCustomers_().filter(function (c) { return c.customer_id === payload.customer_id; })[0];
  if (!cust) throw new Error('Customer not found');
  var subs = liveSubs_()
    .filter(function (s) { return s.customer_id === cust.customer_id; })
    .sort(function (a, b) { return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0; });
  var subIds = {};
  subs.forEach(function (s) { subIds[s.subscription_id] = true; });
  var payments = readObjects(CONFIG.SHEETS.PAYMENTS)
    .filter(function (p) { return subIds[p.subscription_id]; })
    .sort(function (a, b) { return a.week_group < b.week_group ? 1 : a.week_group > b.week_group ? -1 : 0; });
  return { customer: cust, subscriptions: subs, payments: payments };
}

function updateCustomer_(payload, user) {
  requirePermission_(user, 'customers', 'update');
  var cust = liveCustomers_().filter(function (c) { return c.customer_id === payload.customer_id; })[0];
  if (!cust) throw new Error('Customer not found');
  var editable = ['customer_name', 'customer_address', 'customer_phone', 'allergy_concerns', 'food_requests'];
  var patch = {};
  editable.forEach(function (f) { if (payload[f] !== undefined) patch[f] = payload[f]; });
  patch.updated_at = nowTimestamp_();
  var merged = withLock_(function () {
    return updateByKey(CONFIG.SHEETS.CUSTOMERS, 'customer_id', payload.customer_id, patch);
  });
  logAction_(user, 'Updated Customer', payload.customer_id, 'CUSTOMER', { after: patch });
  return merged;
}

/**
 * One-time backfill (run manually once from the editor). Idempotent: skips subscriptions that
 * already carry a customer_id. Groups remaining subs by normalized NAME; first (oldest) sub of
 * each name seeds the master record (oldest details win — owner can correct later).
 */
function backfillCustomers() {
  return withLock_(function () {
    var subsRaw = readObjects(CONFIG.SHEETS.SUBSCRIPTIONS);
    var existing = readObjects(CONFIG.SHEETS.CUSTOMERS);
    var byName = {};
    existing.forEach(function (c) { byName[normalizeName_(c.customer_name)] = c; });

    // Oldest-first so the earliest subscription seeds the customer record + lowest id.
    var pending = subsRaw
      .filter(function (s) { return !s.customer_id && !isTrue_(s.is_deleted); })
      .sort(function (a, b) { return String(a.created_at) < String(b.created_at) ? -1 : 1; });

    var seq = existing.length;
    var created = 0, linked = 0;
    pending.forEach(function (s) {
      var key = normalizeName_(s.customer_name);
      var cust = byName[key];
      if (!cust) {
        seq += 1;
        var datePart = String(s.created_at || todayISO_()).slice(0, 10).replace(/-/g, '');
        cust = {
          customer_id: 'CUST-' + datePart + '-' + pad3_(seq),
          customer_name: s.customer_name, customer_address: s.customer_address,
          customer_phone: s.customer_phone, allergy_concerns: s.allergy_concerns || '',
          food_requests: s.food_requests || '', created_by: s.created_by,
          created_at: s.created_at, updated_at: s.created_at, is_deleted: false,
        };
        appendObject(CONFIG.SHEETS.CUSTOMERS, cust);
        byName[key] = cust;
        created += 1;
      }
      updateByKey(CONFIG.SHEETS.SUBSCRIPTIONS, 'subscription_id', s.subscription_id, { customer_id: cust.customer_id });
      linked += 1;
    });
    Logger.log('Backfill complete: ' + created + ' customers created, ' + linked + ' subscriptions linked.');
    return { created: created, linked: linked };
  });
}
