/**
 * Config.gs — central configuration.
 *
 * Roles now live in the USERS sheet (managed by an admin in-app). The only hardcoded
 * identity is the BOOTSTRAP ADMIN — the first admin who can sign in to assign everyone else.
 * Keep ADMIN_BOOTSTRAP_EMAILS in sync with web/src/config.js.
 */

var CONFIG = {
  // Paste the Sheet ID, or leave '' if this script is container-bound to the sheet.
  SPREADSHEET_ID: '',

  // First admin(s) — always resolve to admin even before the USERS sheet has rows.
  ADMIN_BOOTSTRAP_EMAILS: ['admin@ketolab.com'],

  SHEETS: {
    USERS: 'USERS',
    ROLES: 'ROLES',
    SETTINGS: 'SETTINGS',
    PRODUCTS: 'PRODUCTS',
    CUSTOMERS: 'CUSTOMERS',
    SUBSCRIPTIONS: 'SUBSCRIPTIONS',
    PAYMENTS: 'PAYMENTS',
    INVOICES: 'INVOICES',
    AUDIT: 'AUDIT_LOG',
  },
};

var ROLES = { ADMIN: 'admin', OWNER: 'owner', REP: 'sales_rep' };

var HEADERS = {
  USERS: ['email', 'role', 'assigned_by', 'assigned_at', 'active'],
  ROLES: ['role_id', 'name', 'is_builtin', 'permissions_json', 'created_by', 'created_at', 'active'],
  SETTINGS: ['key', 'value'],
  PRODUCTS: ['product_name', 'price_per_week', 'num_days', 'active'],
  CUSTOMERS: ['customer_id', 'customer_name', 'customer_address', 'customer_phone',
    'allergy_concerns', 'food_requests', 'created_by', 'created_at', 'updated_at', 'is_deleted'],
  // customer_id is appended LAST so adding it to an existing sheet leaves columns 1–14 aligned
  // (a mid-row insert would misalign existing data when the header row is rewritten).
  SUBSCRIPTIONS: ['subscription_id', 'customer_name', 'customer_address', 'customer_phone',
    'allergy_concerns', 'food_requests', 'product', 'quantity', 'start_date', 'is_active',
    'is_deleted', 'created_by', 'created_at', 'internal_notes', 'customer_id'],
  PAYMENTS: ['payment_id', 'subscription_id', 'week_group', 'amount_php', 'payment_method',
    'customer_reference', 'proof_of_payment', 'recorded_date', 'recorded_by', 'verified_by',
    'verified_at', 'status'],
  INVOICES: ['invoice_id', 'invoice_date', 'subscription_id', 'customer_id', 'customer_name',
    'customer_address', 'description', 'line_note', 'quantity', 'rate', 'amount', 'currency',
    'notes', 'created_by', 'created_at', 'is_deleted'],
  AUDIT: ['log_id', 'timestamp', 'user_id', 'user_role', 'action', 'record_id', 'record_type', 'details', 'ip_address'],
};

// Default system settings — seeded into the SETTINGS sheet; admin edits them in-app.
var DEFAULT_SETTINGS = {
  business_name: 'KetoLab',
  currency: 'PHP',
  timezone: 'Asia/Manila',
  overdue_days: 3,
  payment_methods: ['GCash', 'Bank Transfer', 'COD', 'Card'],
  // Invoice branding + payment accounts (Invoice Settings screen; owner-managed).
  business_logo: '',
  business_phone: '',
  payment_accounts: [], // [{ method, account_name, account_number }]
  // Owner-set starting invoice number (continues from a previous generator).
  invoice_start_number: 1,
};

// Settings keys stored as JSON-encoded text in the SETTINGS sheet's `value` column.
var JSON_SETTINGS_KEYS = ['payment_methods', 'payment_accounts'];

// Columns stored/read as plain text so Sheets doesn't auto-convert dates/IDs.
var TEXT_COLUMNS = ['start_date', 'created_at', 'updated_at', 'recorded_date', 'verified_at', 'timestamp',
  'customer_phone', 'customer_id', 'subscription_id', 'payment_id', 'week_group', 'assigned_at',
  'permissions_json', 'invoice_id', 'invoice_date'];

// ---------------------------------------------------------------------------
// PERMISSIONS — single source of truth of every valid `feature:action` grant.
// The backend guardrail validator and the frontend Roles editor (web/src/config.js)
// both render from this exact catalog — keep the two in sync.
//
// `read` on subscriptions & payments carries an own/all scope, encoded inline as
// `feature:read:own` vs `feature:read:all`. Everything else is a flat `feature:action`.
// ---------------------------------------------------------------------------
var PERMISSIONS = {
  subscriptions: { actions: ['create', 'read', 'update', 'delete'], scopedRead: true },
  payments: { actions: ['record', 'read', 'update', 'verify', 'revert'], scopedRead: true },
  // `lookup` = the rep+owner subscription-form picker (contact fields only); `read` = the
  // owner-only Customers directory + per-client history. Two distinct grants on purpose.
  customers: { actions: ['create', 'read', 'update', 'lookup'], scopedRead: false },
  products: { actions: ['create', 'read', 'update', 'delete'], scopedRead: false },
  dashboard: { actions: ['read'], scopedRead: false },
  // read = view generated invoices; create = generate from a subscription;
  // configure = edit invoice branding + payment accounts.
  invoices: { actions: ['read', 'create', 'delete', 'configure'], scopedRead: false },
  users: { actions: ['create', 'read', 'update', 'delete', 'assign'], scopedRead: false },
  settings: { actions: ['read', 'update'], scopedRead: false },
  audit: { actions: ['read'], scopedRead: false },
};

// Expand the catalog into the flat list of every legal grant string, e.g.
// "subscriptions:create", "subscriptions:read:own", "subscriptions:read:all", ...
function allPermissionStrings_() {
  var out = [];
  Object.keys(PERMISSIONS).forEach(function (feature) {
    var spec = PERMISSIONS[feature];
    spec.actions.forEach(function (action) {
      if (action === 'read' && spec.scopedRead) {
        out.push(feature + ':read:own');
        out.push(feature + ':read:all');
      } else {
        out.push(feature + ':' + action);
      }
    });
  });
  return out;
}

// Built-in role grant sets — the seed definition of the 3 default roles
// (from the RBAC matrix in BACKLOG.md). `permsFor_` also uses ADMIN here to
// resolve the bootstrap admin before the ROLES sheet has rows.
var BUILTIN_ROLE_PERMISSIONS = {
  admin: [
    'users:create', 'users:read', 'users:update', 'users:delete', 'users:assign',
    'settings:read', 'settings:update', 'audit:read',
  ],
  owner: [
    'subscriptions:create', 'subscriptions:read:all', 'subscriptions:update', 'subscriptions:delete',
    'payments:record', 'payments:read:all', 'payments:update', 'payments:verify', 'payments:revert',
    'customers:create', 'customers:read', 'customers:update', 'customers:lookup',
    'products:create', 'products:read', 'products:update', 'products:delete',
    'invoices:read', 'invoices:create', 'invoices:delete', 'invoices:configure',
    'dashboard:read', 'audit:read',
  ],
  sales_rep: [
    'subscriptions:create', 'subscriptions:read:own', 'subscriptions:update',
    'customers:create', 'customers:lookup', // attach/create clients from the form; no directory access
    'products:read', // read-only catalog: reps need prices as a quoting reference (no create/update/delete)
  ],
};

var BUILTIN_ROLE_META = {
  admin: { name: 'Admin' },
  owner: { name: 'Owner' },
  sales_rep: { name: 'Sales Rep' },
};
