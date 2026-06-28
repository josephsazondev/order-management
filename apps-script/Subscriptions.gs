/**
 * Subscriptions.gs — OWNER + REP. Reps create/view/edit only their OWN; soft-delete is owner-only.
 */

function repSubscriptionView_(s) {
  return {
    subscription_id: s.subscription_id, customer_id: s.customer_id, customer_name: s.customer_name,
    customer_address: s.customer_address, customer_phone: s.customer_phone,
    allergy_concerns: s.allergy_concerns, food_requests: s.food_requests,
    product: s.product, quantity: Number(s.quantity), start_date: s.start_date,
    is_active: isTrue_(s.is_active), created_at: s.created_at,
  };
}

function liveSubs_() {
  return readObjects(CONFIG.SHEETS.SUBSCRIPTIONS).filter(function (s) { return !isTrue_(s.is_deleted); });
}

function createSubscription_(payload, user) {
  requirePermission_(user, 'subscriptions', 'create');
  // Only the customer name is required; address/phone/allergies/food requests are optional.
  var required = ['customer_name', 'product', 'quantity', 'start_date'];
  for (var i = 0; i < required.length; i++) {
    if (payload[required[i]] === undefined || payload[required[i]] === '' || payload[required[i]] === null) {
      throw new Error('Missing required field: ' + required[i]);
    }
  }
  var prod = readObjects(CONFIG.SHEETS.PRODUCTS).filter(function (p) { return p.product_name === payload.product; })[0];
  if (!prod || !isTrue_(prod.active)) throw new Error('Unknown or inactive product: ' + payload.product);

  // "All" scope marks the owner-class user: gets the full record view and the
  // option to activate a subscription immediately on creation.
  var allScope = hasScope_(user, 'subscriptions', 'all');
  return withLock_(function () {
    // Link to an existing client (picker) or create a new master record (manual id — no
    // silent merge-by-phone). The subscription stores its own contact snapshot regardless.
    var customerId = payload.customer_id;
    if (customerId) {
      var existing = liveCustomers_().filter(function (c) { return c.customer_id === customerId; })[0];
      if (!existing) throw new Error('Customer not found: ' + customerId);
    } else {
      requirePermission_(user, 'customers', 'create');
      customerId = createCustomerRow_({
        customer_name: payload.customer_name, customer_address: payload.customer_address,
        customer_phone: payload.customer_phone, allergy_concerns: payload.allergy_concerns,
        food_requests: payload.food_requests,
      }, user).customer_id;
    }
    var datePart = todayISO_().replace(/-/g, '');
    var subs = readObjects(CONFIG.SHEETS.SUBSCRIPTIONS);
    var seq = subs.filter(function (s) { return String(s.subscription_id).indexOf('SUB-' + datePart + '-') === 0; }).length + 1;
    var id = 'SUB-' + datePart + '-' + pad3_(seq);
    var sub = {
      subscription_id: id, customer_id: customerId, customer_name: payload.customer_name,
      customer_address: payload.customer_address, customer_phone: payload.customer_phone,
      allergy_concerns: payload.allergy_concerns || '', food_requests: payload.food_requests || '',
      product: payload.product, quantity: Number(payload.quantity),
      start_date: payload.start_date, is_active: allScope && !!payload.activate,
      is_deleted: false, created_by: user.email, created_at: nowTimestamp_(), internal_notes: '',
    };
    appendObject(CONFIG.SHEETS.SUBSCRIPTIONS, sub);
    logAction_(user, 'Created Subscription', id, 'SUBSCRIPTION', { customer_id: customerId, customer_name: sub.customer_name, product: sub.product, quantity: sub.quantity });
    return allScope ? sub : repSubscriptionView_(sub);
  });
}

function listSubscriptions_(payload, user) {
  requirePermission_(user, 'subscriptions', 'read');
  payload = payload || {};
  var allScope = hasScope_(user, 'subscriptions', 'all');
  // Scope-visible set (all-scope: all live; own-scope: own live), used for stat-card counts.
  var visible = liveSubs_().filter(function (s) { return allScope || s.created_by === user.email; });
  var counts = {
    total: visible.length,
    active: visible.filter(function (s) { return isTrue_(s.is_active); }).length,
    inactive: visible.filter(function (s) { return !isTrue_(s.is_active); }).length,
  };
  var reps = [];
  if (allScope) {
    var seen = {};
    visible.forEach(function (s) { seen[s.created_by] = true; });
    reps = Object.keys(seen).sort();
  }
  // Weeks a subscription was started on (derived from start_date), newest first.
  var weekSeen = {};
  visible.forEach(function (s) { weekSeen[getWeekIdentifier(s.start_date)] = true; });
  var weeks = Object.keys(weekSeen).sort().reverse();

  // Server-side filtering so pagination operates on the filtered set.
  var q = String(payload.q || '').trim().toLowerCase();
  var status = payload.status || 'all';
  var repFilter = (payload.rep && payload.rep !== 'all') ? payload.rep : null;
  var weekFilter = (payload.week && payload.week !== 'all') ? payload.week : null;
  var filtered = visible.filter(function (s) {
    if (status === 'active' && !isTrue_(s.is_active)) return false;
    if (status === 'inactive' && isTrue_(s.is_active)) return false;
    if (repFilter && s.created_by !== repFilter) return false;
    if (weekFilter && getWeekIdentifier(s.start_date) !== weekFilter) return false;
    if (q) {
      var hay = (s.customer_name + ' ' + s.subscription_id + ' ' + s.product).toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  });

  // Pagination.
  var pageSize = Math.max(1, Number(payload.pageSize) || 10);
  var total = filtered.length;
  var pages = Math.max(1, Math.ceil(total / pageSize));
  var page = Math.min(Math.max(1, Number(payload.page) || 1), pages);
  var slice = filtered.slice((page - 1) * pageSize, page * pageSize);
  var rows = allScope ? slice : slice.map(repSubscriptionView_);
  return { rows: rows, page: page, pageSize: pageSize, total: total, pages: pages, counts: counts, reps: reps, weeks: weeks };
}

function getSubscription_(payload, user) {
  requirePermission_(user, 'subscriptions', 'read');
  var allScope = hasScope_(user, 'subscriptions', 'all');
  var sub = liveSubs_().filter(function (s) { return s.subscription_id === payload.subscription_id; })[0];
  if (!sub) throw new Error('Subscription not found');
  if (allScope) return sub;
  if (sub.created_by !== user.email) throw new Error('Forbidden: not your subscription');
  return repSubscriptionView_(sub);
}

function updateSubscription_(payload, user) {
  requirePermission_(user, 'subscriptions', 'update');
  var allScope = hasScope_(user, 'subscriptions', 'all');
  var sub = liveSubs_().filter(function (s) { return s.subscription_id === payload.subscription_id; })[0];
  if (!sub) throw new Error('Subscription not found');
  if (!allScope && sub.created_by !== user.email) {
    throw new Error('Forbidden: you can only edit your own subscriptions.');
  }
  if (payload.product !== undefined) {
    var prod = readObjects(CONFIG.SHEETS.PRODUCTS).filter(function (p) { return p.product_name === payload.product; })[0];
    if (!prod || !isTrue_(prod.active)) throw new Error('Unknown or inactive product: ' + payload.product);
  }
  var repEditable = ['customer_name', 'customer_address', 'customer_phone', 'allergy_concerns', 'food_requests', 'product', 'quantity', 'start_date'];
  var editable = allScope ? repEditable.concat(['internal_notes']) : repEditable;
  var patch = {};
  editable.forEach(function (f) {
    if (payload[f] !== undefined) patch[f] = (f === 'quantity') ? Number(payload[f]) : payload[f];
  });
  var merged = withLock_(function () {
    return updateByKey(CONFIG.SHEETS.SUBSCRIPTIONS, 'subscription_id', payload.subscription_id, patch);
  });
  logAction_(user, 'Updated Subscription', payload.subscription_id, 'SUBSCRIPTION', { after: patch });
  return allScope ? merged : repSubscriptionView_(merged);
}

function setSubscriptionActive_(payload, user) {
  requirePermission_(user, 'subscriptions', 'update');
  var active = !!payload.is_active;
  var patch = { is_active: active };
  var merged = withLock_(function () {
    var current = liveSubs_().filter(function (s) { return s.subscription_id === payload.subscription_id; })[0];
    if (current && payload.note) patch.internal_notes = (current.internal_notes ? current.internal_notes + ' | ' : '') + payload.note;
    return updateByKey(CONFIG.SHEETS.SUBSCRIPTIONS, 'subscription_id', payload.subscription_id, patch);
  });
  if (!merged) throw new Error('Subscription not found');
  logAction_(user, active ? 'Activated Subscription' : 'Deactivated Subscription', payload.subscription_id, 'SUBSCRIPTION', { is_active: active });
  return merged;
}

function deleteSubscription_(payload, user) {
  requirePermission_(user, 'subscriptions', 'delete');
  var merged = withLock_(function () {
    return updateByKey(CONFIG.SHEETS.SUBSCRIPTIONS, 'subscription_id', payload.subscription_id, { is_deleted: true, is_active: false });
  });
  if (!merged) throw new Error('Subscription not found');
  logAction_(user, 'Deleted Subscription', payload.subscription_id, 'SUBSCRIPTION', { reason: payload.reason || '', customer_name: merged.customer_name });
  return { deleted: true, subscription_id: payload.subscription_id };
}
