/**
 * Payments.gs — OWNER ONLY. Payments are tagged to a week_group; amount is derived from the
 * product price × quantity, never hand-entered.
 */

function listPayments_(payload, user) {
  requirePermission_(user, 'payments', 'read');
  var rows = readObjects(CONFIG.SHEETS.PAYMENTS);
  // Scope: read:all sees every payment; read:own only payments the user recorded.
  if (!hasScope_(user, 'payments', 'all')) {
    rows = rows.filter(function (p) { return String(p.recorded_by).toLowerCase() === String(user.email).toLowerCase(); });
  }
  if (payload && payload.week_group) rows = rows.filter(function (p) { return p.week_group === payload.week_group; });
  if (payload && payload.subscription_id) rows = rows.filter(function (p) { return p.subscription_id === payload.subscription_id; });
  // Newest first (by week, then id) — handy for the per-subscription panel.
  rows.sort(function (a, b) {
    if (a.week_group !== b.week_group) return a.week_group < b.week_group ? 1 : -1;
    return a.payment_id < b.payment_id ? 1 : -1;
  });
  return rows;
}

function recordPayment_(payload, user) {
  requirePermission_(user, 'payments', 'record');
  if (!payload.payment_method) throw new Error('payment_method is required');
  if (!payload.customer_reference) throw new Error('customer_reference is required');
  return withLock_(function () {
    var sub = liveSubs_().filter(function (s) { return s.subscription_id === payload.subscription_id; })[0];
    if (!sub) throw new Error('Subscription not found: ' + payload.subscription_id);
    var week = payload.week_group || getWeekIdentifier(todayISO_());
    var amount = priceFor_(sub.product) * Number(sub.quantity);
    var seq = readObjects(CONFIG.SHEETS.PAYMENTS).filter(function (p) { return String(p.payment_id).indexOf('PAY-' + week + '-') === 0; }).length + 1;
    var payment = {
      payment_id: 'PAY-' + week + '-' + pad3_(seq), subscription_id: sub.subscription_id, week_group: week,
      amount_php: amount, payment_method: payload.payment_method, customer_reference: payload.customer_reference,
      proof_of_payment: payload.proof_of_payment || '', recorded_date: todayISO_(), recorded_by: user.email,
      verified_by: '', verified_at: '', status: 'Pending Verification',
    };
    appendObject(CONFIG.SHEETS.PAYMENTS, payment);
    logAction_(user, 'Recorded Payment', payment.payment_id, 'PAYMENT', { subscription_id: sub.subscription_id, week_group: week, amount_php: amount });
    return payment;
  });
}

function verifyPayment_(payload, user) {
  requirePermission_(user, 'payments', 'verify');
  // A single owner records AND verifies (PO: the app must support a one-owner operation),
  // so there is no verify-vs-record separation here — the `payments:verify` grant is the
  // control. verified_by records who verified for the audit trail.
  var merged = withLock_(function () {
    return updateByKey(CONFIG.SHEETS.PAYMENTS, 'payment_id', payload.payment_id,
      { status: 'Verified', verified_by: user.email, verified_at: nowTimestamp_() });
  });
  if (!merged) throw new Error('Payment not found');
  logAction_(user, 'Verified Payment', payload.payment_id, 'PAYMENT', { subscription_id: merged.subscription_id });
  return merged;
}

function revertPayment_(payload, user) {
  requirePermission_(user, 'payments', 'revert');
  var merged = withLock_(function () {
    return updateByKey(CONFIG.SHEETS.PAYMENTS, 'payment_id', payload.payment_id,
      { status: 'Pending Verification', verified_by: '', verified_at: '' });
  });
  if (!merged) throw new Error('Payment not found');
  logAction_(user, 'Reverted Payment', payload.payment_id, 'PAYMENT', { to: 'Pending Verification' });
  return merged;
}

function disputePayment_(payload, user) {
  requirePermission_(user, 'payments', 'update');
  var merged = withLock_(function () { return updateByKey(CONFIG.SHEETS.PAYMENTS, 'payment_id', payload.payment_id, { status: 'Disputed' }); });
  if (!merged) throw new Error('Payment not found');
  logAction_(user, 'Disputed Payment', payload.payment_id, 'PAYMENT', { reason: payload.reason || '' });
  return merged;
}

function refundPayment_(payload, user) {
  requirePermission_(user, 'payments', 'update');
  var merged = withLock_(function () { return updateByKey(CONFIG.SHEETS.PAYMENTS, 'payment_id', payload.payment_id, { status: 'Refunded' }); });
  if (!merged) throw new Error('Payment not found');
  logAction_(user, 'Refunded Payment', payload.payment_id, 'PAYMENT', { reason: payload.reason || '' });
  return merged;
}
