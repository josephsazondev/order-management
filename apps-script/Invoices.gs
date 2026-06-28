/**
 * Invoices.gs — generate and read invoices created from subscriptions (EPIC 5).
 * One editable line item per invoice. Branding + payment accounts are rendered live
 * from SETTINGS at view time (see Invoice Settings), not snapshotted onto the row.
 */

function invoiceView_(r) {
  return {
    invoice_id: r.invoice_id, invoice_date: r.invoice_date,
    subscription_id: r.subscription_id, customer_id: r.customer_id,
    customer_name: r.customer_name, customer_address: r.customer_address,
    description: r.description, line_note: r.line_note,
    quantity: Number(r.quantity), rate: Number(r.rate), amount: Number(r.amount),
    currency: r.currency, notes: r.notes,
    created_by: r.created_by, created_at: r.created_at,
  };
}

function liveInvoices_() {
  return readObjects(CONFIG.SHEETS.INVOICES).filter(function (x) { return !isTrue_(x.is_deleted); });
}

function listInvoices_(payload, user) {
  requirePermission_(user, 'invoices', 'read');
  payload = payload || {};
  var rows = liveInvoices_();
  if (payload.subscription_id) {
    rows = rows.filter(function (x) { return x.subscription_id === payload.subscription_id; });
  }
  var q = String(payload.q || '').trim().toLowerCase();
  if (q) {
    rows = rows.filter(function (x) {
      return (String(x.invoice_id) + ' ' + String(x.customer_name)).toLowerCase().indexOf(q) >= 0;
    });
  }
  // Newest first by id (zero-padded ids sort lexically == numerically).
  rows.sort(function (a, b) { return a.invoice_id < b.invoice_id ? 1 : a.invoice_id > b.invoice_id ? -1 : 0; });
  return rows.map(invoiceView_);
}

function getInvoice_(payload, user) {
  requirePermission_(user, 'invoices', 'read');
  var inv = liveInvoices_().filter(function (x) { return x.invoice_id === payload.invoice_id; })[0];
  if (!inv) throw new Error('Invoice not found');
  return invoiceView_(inv);
}

function createInvoice_(payload, user) {
  requirePermission_(user, 'invoices', 'create');
  var sub = liveSubs_().filter(function (s) { return s.subscription_id === payload.subscription_id; })[0];
  if (!sub) throw new Error('Subscription not found: ' + payload.subscription_id);
  var description = String(payload.description || '').trim();
  if (!description) throw new Error('description is required');
  var quantity = Number(payload.quantity);
  var rate = Number(payload.rate);
  if (!(quantity > 0)) throw new Error('quantity must be greater than 0');
  if (!(rate >= 0)) throw new Error('rate must be 0 or more');
  var amount = quantity * rate;
  var settings = readSettings_();

  return withLock_(function () {
    var existing = readObjects(CONFIG.SHEETS.INVOICES);
    // Continue from the owner's starting number, or 1 past the highest existing — whichever
    // is greater. Lets an owner resume numbering from a previous invoice generator.
    var startNum = Math.max(1, Math.floor(Number(settings.invoice_start_number) || 1));
    var highest = 0;
    existing.forEach(function (x) {
      var m = String(x.invoice_id).match(/(\d+)\s*$/);
      if (m) highest = Math.max(highest, Number(m[1]));
    });
    var seq = Math.max(startNum, highest + 1);
    var seqStr = String(seq);
    while (seqStr.length < 6) seqStr = '0' + seqStr; // pad to >= 6 digits, never truncate
    var invoice = {
      invoice_id: 'INV-' + seqStr,
      invoice_date: payload.invoice_date || todayISO_(),
      subscription_id: sub.subscription_id, customer_id: sub.customer_id || '',
      customer_name: sub.customer_name, customer_address: sub.customer_address,
      description: description, line_note: String(payload.line_note || ''),
      quantity: quantity, rate: rate, amount: amount,
      currency: settings.currency || 'PHP', notes: String(payload.notes || ''),
      created_by: user.email, created_at: nowTimestamp_(), is_deleted: false,
    };
    appendObject(CONFIG.SHEETS.INVOICES, invoice);
    logAction_(user, 'Created Invoice', invoice.invoice_id, 'INVOICE',
      { subscription_id: sub.subscription_id, customer_name: sub.customer_name, amount: amount });
    return invoiceView_(invoice);
  });
}

function deleteInvoice_(payload, user) {
  requirePermission_(user, 'invoices', 'delete');
  // Soft delete: keep the row so the invoice number is never reused and the audit trail holds.
  var merged = withLock_(function () {
    return updateByKey(CONFIG.SHEETS.INVOICES, 'invoice_id', payload.invoice_id, { is_deleted: true });
  });
  if (!merged) throw new Error('Invoice not found');
  logAction_(user, 'Deleted Invoice', payload.invoice_id, 'INVOICE',
    { customer_name: merged.customer_name, amount: Number(merged.amount), reason: payload.reason || '' });
  return { deleted: true, invoice_id: payload.invoice_id };
}
