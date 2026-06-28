/**
 * Code.gs — web-app entry point and action router.
 *
 * Frontend POSTs JSON (as text/plain to avoid CORS preflight):
 *   { action: "createSubscription", payload: {...}, email: "advisory only" }
 * Response: { ok: true, data } or { ok: false, error }.
 */

var ACTIONS = {
  // auth & settings
  getSession: function (p, u) { return { email: u.email, role: u.role, permissions: permsFor_(u) }; },
  getSettings: getSettings_,
  updateSettings: updateSettings_,
  updateInvoiceSettings: updateInvoiceSettings_,

  // users (admin)
  listUsers: listUsers_,
  upsertUser: upsertUser_,
  deactivateUser: deactivateUser_,

  // roles (admin)
  listRoles: listRoles_,
  upsertRole: upsertRole_,
  deleteRole: deleteRole_,

  // products
  listProductNames: listProductNames_,
  listProducts: listProducts_,
  upsertProduct: upsertProduct_,
  deleteProduct: deleteProduct_,

  // customers
  lookupCustomers: lookupCustomers_,
  listCustomers: listCustomers_,
  getCustomer: getCustomer_,
  updateCustomer: updateCustomer_,

  // subscriptions
  createSubscription: createSubscription_,
  listSubscriptions: listSubscriptions_,
  getSubscription: getSubscription_,
  updateSubscription: updateSubscription_,
  setSubscriptionActive: setSubscriptionActive_,
  deleteSubscription: deleteSubscription_,

  // payments (owner)
  listPayments: listPayments_,
  recordPayment: recordPayment_,
  verifyPayment: verifyPayment_,
  revertPayment: revertPayment_,
  disputePayment: disputePayment_,
  refundPayment: refundPayment_,

  // invoices (owner)
  listInvoices: listInvoices_,
  getInvoice: getInvoice_,
  createInvoice: createInvoice_,
  deleteInvoice: deleteInvoice_,

  // dashboard (owner)
  weekOptions: weekOptions_,
  weeklyDashboard: weeklyDashboard_,

  // audit (owner + admin)
  listAudit: listAudit_,
};

function doPost(e) { return handleRequest_(e); }

function doGet(e) {
  if (e && e.parameter && e.parameter.action) return handleRequest_(e);
  return jsonOut_({ ok: true, data: { service: 'OrderFlow', status: 'up' } });
}

function handleRequest_(e) {
  try {
    var req = parseRequest_(e);
    var user = getCurrentUser_();
    var handler = ACTIONS[req.action];
    if (!handler) return jsonOut_({ ok: false, error: 'Unknown action: ' + req.action });
    return jsonOut_({ ok: true, data: handler(req.payload || {}, user) });
  } catch (err) {
    return jsonOut_({ ok: false, error: (err && err.message) ? err.message : String(err) });
  }
}

function parseRequest_(e) {
  if (e && e.postData && e.postData.contents) return JSON.parse(e.postData.contents);
  if (e && e.parameter && e.parameter.action) {
    return { action: e.parameter.action, payload: e.parameter.payload ? JSON.parse(e.parameter.payload) : {} };
  }
  throw new Error('Empty request');
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
