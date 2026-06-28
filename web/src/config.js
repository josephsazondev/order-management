// Shared frontend constants.
//
// Roles now live in a USERS data store (managed by the admin), NOT a hardcoded allowlist.
// The only hardcoded identity is the BOOTSTRAP ADMIN — the first admin who can log in to
// assign everyone else. Mirrors apps-script/Config.gs.

export const ROLES = { ADMIN: 'admin', OWNER: 'owner', REP: 'sales_rep' };

// Fallback display names for the built-in role_ids. The Roles screen and any list
// derived from `listRoles` should prefer the live `name` field; ROLE_LABELS is only a
// last-resort label when a role row isn't loaded yet.
export const ROLE_LABELS = {
  admin: 'Admin',
  owner: 'Owner',
  sales_rep: 'Sales Rep',
};

// ---------------------------------------------------------------------------
// PERMISSIONS — mirrors apps-script/Config.gs. Single source of truth for the
// Roles permission-matrix editor and for `can()` checks. Keep in sync with backend.
// `read` on subscriptions & payments is scoped (own/all), encoded inline as
// `feature:read:own` / `feature:read:all`.
// ---------------------------------------------------------------------------
export const PERMISSIONS = {
  subscriptions: { label: 'Subscriptions', actions: ['create', 'read', 'update', 'delete'], scopedRead: true },
  payments: { label: 'Payments', actions: ['record', 'read', 'update', 'verify', 'revert'], scopedRead: true },
  // `lookup` = rep+owner subscription-form picker (contact only); `read` = owner-only directory.
  customers: { label: 'Customers', actions: ['create', 'read', 'update', 'lookup'], scopedRead: false },
  products: { label: 'Products', actions: ['create', 'read', 'update', 'delete'], scopedRead: false },
  dashboard: { label: 'Dashboard', actions: ['read'], scopedRead: false },
  // `read` = view/list generated invoices; `create` = generate from a subscription;
  // `configure` = edit invoice branding + payment accounts (Invoice Settings screen).
  invoices: { label: 'Invoices', actions: ['read', 'create', 'delete', 'configure'], scopedRead: false },
  users: { label: 'Users & Roles', actions: ['create', 'read', 'update', 'delete', 'assign'], scopedRead: false },
  settings: { label: 'System Settings', actions: ['read', 'update'], scopedRead: false },
  audit: { label: 'Audit Log', actions: ['read'], scopedRead: false },
};

// Friendly labels for actions in the matrix editor.
export const ACTION_LABELS = {
  create: 'Create', read: 'Read', update: 'Update', delete: 'Delete',
  record: 'Record', verify: 'Verify', revert: 'Revert', assign: 'Assign', lookup: 'Look up',
  configure: 'Configure',
};

// Expand the catalog into every legal grant string (matches allPermissionStrings_).
export function allPermissionStrings() {
  const out = [];
  Object.keys(PERMISSIONS).forEach((feature) => {
    const spec = PERMISSIONS[feature];
    spec.actions.forEach((action) => {
      if (action === 'read' && spec.scopedRead) {
        out.push(`${feature}:read:own`);
        out.push(`${feature}:read:all`);
      } else {
        out.push(`${feature}:${action}`);
      }
    });
  });
  return out;
}

// Built-in role grant sets — mirrors BUILTIN_ROLE_PERMISSIONS in apps-script/Config.gs.
// Used by the mock adapter to seed roles and resolve bootstrap-admin permissions.
export const BUILTIN_ROLE_PERMISSIONS = {
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

export const BUILTIN_ROLE_META = {
  admin: { name: 'Admin' },
  owner: { name: 'Owner' },
  sales_rep: { name: 'Sales Rep' },
};

// Bootstrap admin(s): always resolve to admin even before the USERS store exists.
export const ADMIN_BOOTSTRAP_EMAILS = ['admin@ketolab.com'];

// Demo accounts shown as quick-pick buttons on the login screen (mock mode only).
export const DEMO_ACCOUNTS = [
  { email: 'admin@ketolab.com', role: 'admin' },
  { email: 'owner@ketolab.com', role: 'owner' },
  { email: 'maria@ketolab.com', role: 'sales_rep' },
  { email: 'carlos@ketolab.com', role: 'sales_rep' },
];

export const PAYMENT_STATUS = ['Pending Verification', 'Verified', 'Disputed', 'Refunded'];

// Default settings — the SETTINGS store seeds from these; admin can change them in-app.
export const DEFAULT_SETTINGS = {
  business_name: 'Ketolab Order Management',
  currency: 'PHP',
  timezone: 'Asia/Manila',
  overdue_days: 3,
  payment_methods: ['GCash', 'Bank Transfer', 'COD', 'Card'],
  // Invoice branding + payment accounts (Invoice Settings screen).
  business_logo: '',
  business_phone: '',
  payment_accounts: [], // [{ method, account_name, account_number }]
  // Owner-set starting invoice number (continues from a previous generator). The next
  // invoice number is max(invoice_start_number, highest existing + 1).
  invoice_start_number: 1,
};

export const API_MODE = import.meta.env.VITE_API_MODE || 'mock';
export const APPSCRIPT_URL = import.meta.env.VITE_APPSCRIPT_URL || '';

// Which mock dataset to seed (mock mode only):
//   full  -> the full demo dataset (subscriptions, payments, invoices, audit)
//   empty -> only the scaffolding needed to operate (users, roles, settings,
//            products) and zero transactional records — a clean slate.
export const MOCK_SEED = (import.meta.env.VITE_MOCK_SEED || 'full').toLowerCase() === 'empty' ? 'empty' : 'full';
