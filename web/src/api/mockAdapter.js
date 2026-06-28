// In-browser mock backend. Mirrors the Apps Script API surface AND its security model:
// role is resolved server-side from the caller's email (via the USERS store + bootstrap
// admin), then expanded to a permission grant set (via the ROLES store). Authorization is
// grant-based — requirePermission(user, feature, action) — never the role string.
//
// Built-in roles (admin/owner/sales_rep) seed the ROLES store; admins may add custom roles
// with any combination of CRUD + key-action grants, subject to the same guardrails the
// real backend enforces (Roles.gs / Users.gs).

import { seedData } from './mockData.js';
import { getWeekInfo } from '../lib/week.js';
import { ADMIN_BOOTSTRAP_EMAILS, BUILTIN_ROLE_PERMISSIONS, allPermissionStrings, MOCK_SEED } from '../config.js';

// Key the store by seed mode so the empty/full datasets never share state: toggling
// VITE_MOCK_SEED gives a clean slate for that mode without a manual reset.
const STORE_KEY = `orderflow_mock_db_v8${MOCK_SEED === 'empty' ? '_empty' : ''}`; // v8: customer key = name; only name required

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  const fresh = seedData(MOCK_SEED);
  save(fresh);
  return fresh;
}
function save(db) { localStorage.setItem(STORE_KEY, JSON.stringify(db)); }
export function resetMockDb() { const fresh = seedData(MOCK_SEED); save(fresh); return fresh; }

// ---- helpers -------------------------------------------------------------
class ApiError extends Error {}

function nowTimestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function pad3(n) { return String(n).padStart(3, '0'); }
function currentWeekGroup() { return getWeekInfo(todayISO()).weekId; }

function resolveRole(db, email) {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return null;
  if (ADMIN_BOOTSTRAP_EMAILS.map((x) => x.toLowerCase()).includes(e)) return 'admin';
  const u = (db.users || []).find((u) => u.email.toLowerCase() === e && u.active);
  return u ? u.role : null;
}

// Resolve a role_id to its grant set: built-in → from config; else the active ROLES row.
function grantsForRoleId(db, roleId) {
  if (Object.prototype.hasOwnProperty.call(BUILTIN_ROLE_PERMISSIONS, roleId)) {
    return BUILTIN_ROLE_PERMISSIONS[roleId].slice();
  }
  const r = (db.roles || []).find((x) => String(x.role_id) === String(roleId) && x.active);
  return r ? (r.permissions || []).slice() : [];
}

// The grant set for a signed-in user. Bootstrap admin always gets the built-in admin set.
function permsFor(db, user) {
  if (!user) return [];
  if (ADMIN_BOOTSTRAP_EMAILS.map((x) => x.toLowerCase()).includes(String(user.email || '').toLowerCase())) {
    return BUILTIN_ROLE_PERMISSIONS.admin.slice();
  }
  return grantsForRoleId(db, user.role);
}

// A plain `read` check is satisfied by either read scope (own/all); use hasScope to
// distinguish them. All other actions match the exact grant.
const can = (user, feature, action) => {
  const g = user.permissions || [];
  if (g.includes(`${feature}:${action}`)) return true;
  if (action === 'read') return g.includes(`${feature}:read:own`) || g.includes(`${feature}:read:all`);
  return false;
};
const hasScope = (user, feature, scope) => (user.permissions || []).includes(`${feature}:read:${scope}`);
function requirePermission(user, feature, action) {
  if (!can(user, feature, action)) {
    throw new ApiError(`Forbidden: this action requires the ${feature}:${action} permission.`);
  }
}

// ---- guardrails (mirror Roles.gs / Users.gs) -----------------------------
function checkSeparationOfDuties(grants) {
  const hasSubWrite = grants.includes('subscriptions:create') || grants.includes('subscriptions:update');
  const hasPayAct = grants.includes('payments:record') || grants.includes('payments:verify');
  if (hasSubWrite && hasPayAct) {
    return 'Separation of duties: a role cannot hold both subscription create/update and payment record/verify.';
  }
  return '';
}
// Can "manage user access" for the no-lockout guardrail: assign roles to existing users or
// create new users (can repair access). Editing role DEFINITIONS (users:update) alone is not enough.
const grantsManageUsers = (grants) => grants.includes('users:assign') || grants.includes('users:create');

// No-lockout at the ROLE level: after this role's grants/active change, at least one active
// user must still be able to manage users/roles.
function noLockoutAfterRoleChange(db, roleId, newGrants, newActive) {
  const bootstrap = ADMIN_BOOTSTRAP_EMAILS.map((x) => x.toLowerCase());
  let managers = 0;
  (db.users || []).forEach((u) => {
    if (!u.active) return;
    const e = String(u.email).toLowerCase();
    if (bootstrap.includes(e)) { managers++; return; }
    const grants = String(u.role) === String(roleId)
      ? (newActive ? newGrants : [])
      : grantsForRoleId(db, u.role);
    if (grantsManageUsers(grants)) managers++;
  });
  return managers > 0 ? '' : 'This change would leave no active user able to manage users/roles.';
}

// No-lockout at the USER-assignment level: simulate one user's new role/active.
function noLockoutAfterUserChange(db, email, newRole, newActive) {
  const bootstrap = ADMIN_BOOTSTRAP_EMAILS.map((x) => x.toLowerCase());
  email = String(email || '').toLowerCase();
  let managers = 0;
  let found = false;
  (db.users || []).forEach((u) => {
    const e = String(u.email).toLowerCase();
    let active = u.active;
    let role = u.role;
    if (e === email) {
      found = true;
      active = newActive;
      if (newRole !== null && newRole !== undefined) role = newRole;
    }
    if (!active) return;
    if (bootstrap.includes(e) || grantsManageUsers(grantsForRoleId(db, role))) managers++;
  });
  if (!found && email && newActive) {
    if (bootstrap.includes(email) || grantsManageUsers(grantsForRoleId(db, newRole))) managers++;
  }
  return managers > 0 ? '' : 'This change would leave no active user able to manage users/roles.';
}

function roleIdIsValid(db, roleId) {
  if (!roleId) return false;
  if (Object.prototype.hasOwnProperty.call(BUILTIN_ROLE_PERMISSIONS, roleId)) return true;
  return (db.roles || []).some((r) => String(r.role_id) === String(roleId) && r.active);
}

function slugifyRoleId(name, roles) {
  const base = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'role';
  const taken = new Set((roles || []).map((r) => String(r.role_id)));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

function roleView(r) {
  return {
    role_id: r.role_id, name: r.name, is_builtin: !!r.is_builtin,
    permissions: (r.permissions || []).slice(), created_by: r.created_by, created_at: r.created_at, active: !!r.active,
  };
}

function logAction(db, user, action, recordId, recordType, details) {
  const nextId = db.audit.reduce((m, r) => Math.max(m, r.log_id), 0) + 1;
  db.audit.push({
    log_id: nextId, timestamp: nowTimestamp(), user_id: user.email, user_role: user.role,
    action, record_id: recordId, record_type: recordType,
    details: typeof details === 'string' ? details : JSON.stringify(details), ip_address: '',
  });
}

function priceFor(db, product) {
  const row = db.products.find((p) => p.product_name === product);
  return row ? Number(row.price_per_week) : 0;
}

function repSubscriptionView(s) {
  return {
    subscription_id: s.subscription_id, customer_id: s.customer_id, customer_name: s.customer_name,
    customer_address: s.customer_address, customer_phone: s.customer_phone,
    allergy_concerns: s.allergy_concerns, food_requests: s.food_requests,
    product: s.product, quantity: s.quantity, start_date: s.start_date,
    is_active: s.is_active, created_at: s.created_at,
  };
}

const liveSubs = (db) => db.subscriptions.filter((s) => !s.is_deleted);
const liveCustomers = (db) => (db.customers || []).filter((c) => !c.is_deleted);

// Contact-only projection for the rep-facing picker.
function customerContactView(c) {
  return {
    customer_id: c.customer_id, customer_name: c.customer_name, customer_address: c.customer_address,
    customer_phone: c.customer_phone, allergy_concerns: c.allergy_concerns, food_requests: c.food_requests,
  };
}

// Create a CUSTOMERS row from contact fields. Caller has checked customers:create.
function createCustomerRow(db, contact, user) {
  const datePart = todayISO().replace(/-/g, '');
  const seq = (db.customers || []).length + 1;
  const row = {
    customer_id: `CUST-${datePart}-${pad3(seq)}`, customer_name: contact.customer_name,
    customer_address: contact.customer_address, customer_phone: contact.customer_phone,
    allergy_concerns: contact.allergy_concerns || '', food_requests: contact.food_requests || '',
    created_by: user.email, created_at: nowTimestamp(), updated_at: nowTimestamp(), is_deleted: false,
  };
  db.customers = db.customers || [];
  db.customers.push(row);
  logAction(db, user, 'Created Customer', row.customer_id, 'CUSTOMER', { customer_name: row.customer_name, customer_phone: row.customer_phone });
  return row;
}

// ---- handlers ------------------------------------------------------------
const handlers = {
  // auth & settings ----------------------------------------------------
  getSession(db, p, user) { return { email: user.email, role: user.role, permissions: user.permissions }; },

  getSettings(db, p, user) {
    // Any authenticated user may read settings (branding, payment methods, etc.).
    return db.settings;
  },
  updateSettings(db, p, user) {
    requirePermission(user, 'settings', 'update');
    const allowed = ['business_name', 'currency', 'timezone', 'overdue_days', 'payment_methods'];
    const before = { ...db.settings };
    allowed.forEach((k) => {
      if (p[k] !== undefined) db.settings[k] = k === 'overdue_days' ? Number(p[k]) : p[k];
    });
    logAction(db, user, 'Updated Settings', 'SETTINGS', 'SETTINGS', { before, after: { ...db.settings } });
    save(db);
    return db.settings;
  },

  // Invoice branding + payment accounts — owner-managed (invoices:configure), kept
  // separate from admin's System Settings so the owner can brand their own invoices.
  updateInvoiceSettings(db, p, user) {
    requirePermission(user, 'invoices', 'configure');
    const allowed = ['business_name', 'business_logo', 'business_phone', 'invoice_start_number', 'payment_accounts'];
    const before = { ...db.settings };
    allowed.forEach((k) => {
      if (p[k] === undefined) return;
      if (k === 'invoice_start_number') {
        db.settings.invoice_start_number = Math.max(1, Math.floor(Number(p[k]) || 1));
      } else if (k === 'payment_accounts') {
        const list = Array.isArray(p[k]) ? p[k] : [];
        db.settings.payment_accounts = list
          .map((a) => ({
            method: String(a.method || '').trim(),
            account_name: String(a.account_name || '').trim(),
            account_number: String(a.account_number || '').trim(),
          }))
          .filter((a) => a.method || a.account_name || a.account_number);
      } else {
        db.settings[k] = p[k];
      }
    });
    logAction(db, user, 'Updated Invoice Settings', 'SETTINGS', 'SETTINGS', { before, after: { ...db.settings } });
    save(db);
    return db.settings;
  },

  // users ---------------------------------------------------------------
  listUsers(db, p, user) { requirePermission(user, 'users', 'read'); return db.users.slice(); },
  upsertUser(db, p, user) {
    const email = String(p.email || '').trim().toLowerCase();
    if (!email) throw new ApiError('email is required');
    if (!roleIdIsValid(db, p.role)) throw new ApiError('Invalid role: ' + p.role);
    let u = db.users.find((x) => x.email.toLowerCase() === email);
    // New user = users:create; re-assigning an existing one = users:assign.
    requirePermission(user, 'users', u ? 'assign' : 'create');
    const before = u ? { ...u } : null;
    const active = p.active !== undefined ? !!p.active : (u ? u.active : true);
    const lockErr = noLockoutAfterUserChange(db, email, p.role, active);
    if (lockErr) throw new ApiError(lockErr);
    if (!u) {
      u = { email, role: p.role, assigned_by: user.email, assigned_at: nowTimestamp(), active };
      db.users.push(u);
    } else {
      u.role = p.role;
      u.active = active;
      u.assigned_by = user.email;
      u.assigned_at = nowTimestamp();
    }
    logAction(db, user, before ? 'Updated User Role' : 'Created User', email, 'USER', { before, after: { ...u } });
    save(db);
    return u;
  },
  deactivateUser(db, p, user) {
    requirePermission(user, 'users', 'delete');
    const email = String(p.email || '').trim().toLowerCase();
    if (ADMIN_BOOTSTRAP_EMAILS.map((x) => x.toLowerCase()).includes(email)) {
      throw new ApiError('Cannot deactivate the bootstrap admin.');
    }
    const u = db.users.find((x) => x.email.toLowerCase() === email);
    if (!u) throw new ApiError('User not found');
    const lockErr = noLockoutAfterUserChange(db, email, null, false);
    if (lockErr) throw new ApiError(lockErr);
    u.active = false;
    logAction(db, user, 'Deactivated User', email, 'USER', {});
    save(db);
    return u;
  },

  // roles (Story 1.5) ---------------------------------------------------
  listRoles(db, p, user) {
    requirePermission(user, 'users', 'read');
    return (db.roles || []).map(roleView);
  },
  upsertRole(db, p, user) {
    requirePermission(user, 'users', 'update');
    const name = String(p.name || '').trim();
    const perms = p.permissions || [];
    if (!Array.isArray(perms)) throw new ApiError('permissions must be an array');

    db.roles = db.roles || [];
    const existing = p.role_id ? db.roles.find((r) => String(r.role_id) === String(p.role_id)) : null;
    const isCreate = !existing;
    const isBuiltin = existing ? !!existing.is_builtin : false;

    if (isCreate && !name) throw new ApiError('Role name is required.');

    // Validate every grant against the catalog (no drift / typos).
    const legal = allPermissionStrings();
    for (const g of perms) {
      if (!legal.includes(g)) throw new ApiError('Unknown permission: ' + g + '.');
    }

    // Guardrail #3 — built-in protection: name & is_builtin immutable.
    if (existing && isBuiltin && name && name !== existing.name) {
      throw new ApiError('Built-in roles cannot be renamed.');
    }

    // Guardrail #1 — separation of duties (applies to built-ins too).
    const sodErr = checkSeparationOfDuties(perms);
    if (sodErr) throw new ApiError(sodErr);

    // Unique display name (case-insensitive).
    if (name) {
      const clash = db.roles.find((r) => String(r.name).toLowerCase() === name.toLowerCase()
        && (!existing || String(r.role_id) !== String(existing.role_id)));
      if (clash) throw new ApiError(`A role named "${name}" already exists.`);
    }

    const roleId = existing ? existing.role_id : slugifyRoleId(name, db.roles);
    const finalName = existing ? (isBuiltin ? existing.name : (name || existing.name)) : name;
    const finalBuiltin = existing ? isBuiltin : false;
    const finalActive = p.active !== undefined ? !!p.active : (existing ? existing.active : true);

    // Guardrail #2 — no lockout.
    const lockErr = noLockoutAfterRoleChange(db, roleId, perms, finalActive);
    if (lockErr) throw new ApiError(lockErr);

    const row = {
      role_id: roleId, name: finalName, is_builtin: finalBuiltin, permissions: perms.slice(),
      created_by: existing ? existing.created_by : user.email,
      created_at: existing ? existing.created_at : nowTimestamp(),
      active: finalActive,
    };
    if (existing) Object.assign(existing, row); else db.roles.push(row);
    logAction(db, user, isCreate ? 'Created Role' : 'Updated Role', roleId, 'ROLE',
      { name: finalName, permissions: perms, active: finalActive });
    save(db);
    return roleView(row);
  },
  deleteRole(db, p, user) {
    requirePermission(user, 'users', 'update');
    const roleId = String(p.role_id || '');
    if (!roleId) throw new ApiError('role_id is required.');
    const role = (db.roles || []).find((r) => String(r.role_id) === roleId);
    if (!role) throw new ApiError('Role not found.');
    if (role.is_builtin) throw new ApiError('Built-in roles cannot be deleted.');
    const inUse = (db.users || []).some((u) => String(u.role) === roleId);
    if (inUse) throw new ApiError('Role is assigned to one or more users; reassign them first.');
    db.roles = db.roles.filter((r) => String(r.role_id) !== roleId);
    logAction(db, user, 'Deleted Role', roleId, 'ROLE', { name: role.name });
    save(db);
    return { deleted: true, role_id: roleId };
  },

  // products ------------------------------------------------------------
  listProductNames(db, p, user) {
    // Names only (no prices) — needed to author a subscription, so gated on subscription
    // create/update rather than products:read (keeps prices hidden from reps).
    if (!can(user, 'subscriptions', 'create') && !can(user, 'subscriptions', 'update')) {
      requirePermission(user, 'subscriptions', 'create');
    }
    return db.products.filter((x) => x.active).map((x) => x.product_name); // names only, no prices
  },
  listProducts(db, p, user) { requirePermission(user, 'products', 'read'); return db.products.slice(); },
  upsertProduct(db, p, user) {
    requirePermission(user, 'products', p.product_name && db.products.some((x) => x.product_name === p.product_name) ? 'update' : 'create');
    if (!p.product_name) throw new ApiError('product_name is required');
    let row = db.products.find((x) => x.product_name === p.product_name);
    const before = row ? { ...row } : null;
    if (!row) { row = { product_name: p.product_name, price_per_week: 0, num_days: 7, active: true }; db.products.push(row); }
    if (p.price_per_week !== undefined) row.price_per_week = Number(p.price_per_week);
    if (p.num_days !== undefined) row.num_days = Number(p.num_days);
    if (p.active !== undefined) row.active = !!p.active;
    logAction(db, user, before ? 'Updated Product' : 'Created Product', row.product_name, 'PRODUCT', { before, after: { ...row } });
    save(db);
    return row;
  },
  deleteProduct(db, p, user) {
    // Soft delete = deactivate, to protect subscriptions that reference it.
    requirePermission(user, 'products', 'delete');
    const row = db.products.find((x) => x.product_name === p.product_name);
    if (!row) throw new ApiError('Product not found');
    row.active = false;
    logAction(db, user, 'Deactivated Product', row.product_name, 'PRODUCT', {});
    save(db);
    return row;
  },

  // customers (EPIC 7) --------------------------------------------------
  lookupCustomers(db, p, user) {
    requirePermission(user, 'customers', 'lookup');
    const q = String((p && p.q) || '').trim().toLowerCase();
    const limit = Math.max(1, Math.min(25, Number(p && p.limit) || 8));
    let rows = liveCustomers(db);
    if (q) rows = rows.filter((c) => `${c.customer_name} ${c.customer_phone} ${c.customer_id}`.toLowerCase().includes(q));
    rows.sort((a, b) => (a.customer_name < b.customer_name ? -1 : a.customer_name > b.customer_name ? 1 : 0));
    return rows.slice(0, limit).map(customerContactView);
  },

  listCustomers(db, p, user) {
    requirePermission(user, 'customers', 'read');
    const subs = liveSubs(db);
    const byCust = {};
    subs.forEach((s) => {
      if (!s.customer_id) return;
      const agg = byCust[s.customer_id] || (byCust[s.customer_id] = { count: 0, active: 0, last_product: '', last_start_date: '' });
      agg.count += 1;
      if (s.is_active) agg.active += 1;
      if (!agg.last_start_date || String(s.start_date) > String(agg.last_start_date)) {
        agg.last_start_date = s.start_date;
        agg.last_product = s.product;
      }
    });
    const all = liveCustomers(db);
    const q = String((p && p.q) || '').trim().toLowerCase();
    let filtered = q
      ? all.filter((c) => `${c.customer_name} ${c.customer_phone} ${c.customer_id}`.toLowerCase().includes(q))
      : all.slice();
    filtered.sort((a, b) => (a.customer_name < b.customer_name ? -1 : a.customer_name > b.customer_name ? 1 : 0));
    const rows = filtered.map((c) => {
      const agg = byCust[c.customer_id] || { count: 0, active: 0, last_product: '', last_start_date: '' };
      return {
        customer_id: c.customer_id, customer_name: c.customer_name, customer_phone: c.customer_phone,
        customer_address: c.customer_address, subscription_count: agg.count, active_count: agg.active,
        last_product: agg.last_product, last_start_date: agg.last_start_date, created_at: c.created_at,
      };
    });
    const pageSize = Math.max(1, Number((p && p.pageSize)) || 10);
    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(1, Number((p && p.page)) || 1), pages);
    return {
      rows: rows.slice((page - 1) * pageSize, page * pageSize),
      page, pageSize, total, pages, counts: { total: all.length },
    };
  },

  getCustomer(db, p, user) {
    requirePermission(user, 'customers', 'read');
    const cust = liveCustomers(db).find((c) => c.customer_id === p.customer_id);
    if (!cust) throw new ApiError('Customer not found');
    const subs = liveSubs(db)
      .filter((s) => s.customer_id === cust.customer_id)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
    const subIds = new Set(subs.map((s) => s.subscription_id));
    const payments = db.payments
      .filter((x) => subIds.has(x.subscription_id))
      .sort((a, b) => (a.week_group < b.week_group ? 1 : a.week_group > b.week_group ? -1 : 0));
    return { customer: cust, subscriptions: subs, payments };
  },

  updateCustomer(db, p, user) {
    requirePermission(user, 'customers', 'update');
    const cust = liveCustomers(db).find((c) => c.customer_id === p.customer_id);
    if (!cust) throw new ApiError('Customer not found');
    const editable = ['customer_name', 'customer_address', 'customer_phone', 'allergy_concerns', 'food_requests'];
    const before = {}, after = {};
    editable.forEach((f) => {
      if (p[f] !== undefined && p[f] !== cust[f]) { before[f] = cust[f]; after[f] = p[f]; cust[f] = p[f]; }
    });
    cust.updated_at = nowTimestamp();
    logAction(db, user, 'Updated Customer', cust.customer_id, 'CUSTOMER', { before, after });
    save(db);
    return cust;
  },

  // subscriptions -------------------------------------------------------
  createSubscription(db, p, user) {
    requirePermission(user, 'subscriptions', 'create');
    const allScope = hasScope(user, 'subscriptions', 'all');
    // Only the customer name is required; address/phone and the rest are optional.
    const required = ['customer_name', 'product', 'quantity', 'start_date'];
    for (const f of required) if (p[f] === undefined || p[f] === '' || p[f] === null) throw new ApiError('Missing required field: ' + f);
    const prod = db.products.find((x) => x.product_name === p.product);
    if (!prod || !prod.active) throw new ApiError('Unknown or inactive product: ' + p.product);
    // Link to an existing client (picker) or create a new master record (manual id — no silent
    // merge-by-phone). The subscription keeps its own contact snapshot either way.
    let customerId = p.customer_id;
    if (customerId) {
      if (!liveCustomers(db).find((c) => c.customer_id === customerId)) throw new ApiError('Customer not found: ' + customerId);
    } else {
      requirePermission(user, 'customers', 'create');
      customerId = createCustomerRow(db, {
        customer_name: p.customer_name, customer_address: p.customer_address, customer_phone: p.customer_phone,
        allergy_concerns: p.allergy_concerns, food_requests: p.food_requests,
      }, user).customer_id;
    }
    const datePart = todayISO().replace(/-/g, '');
    const seq = db.subscriptions.filter((s) => s.subscription_id.startsWith('SUB-' + datePart + '-')).length + 1;
    const id = `SUB-${datePart}-${pad3(seq)}`;
    const sub = {
      subscription_id: id, customer_id: customerId, customer_name: p.customer_name, customer_address: p.customer_address,
      customer_phone: p.customer_phone, allergy_concerns: p.allergy_concerns || '', food_requests: p.food_requests || '',
      product: p.product, quantity: Number(p.quantity), start_date: p.start_date,
      is_active: allScope && !!p.activate, is_deleted: false,
      created_by: user.email, created_at: nowTimestamp(), internal_notes: '',
    };
    db.subscriptions.push(sub);
    logAction(db, user, 'Created Subscription', id, 'SUBSCRIPTION', { customer_name: sub.customer_name, product: sub.product, quantity: sub.quantity });
    save(db);
    return allScope ? sub : repSubscriptionView(sub);
  },

  listSubscriptions(db, p, user) {
    requirePermission(user, 'subscriptions', 'read');
    const allScope = hasScope(user, 'subscriptions', 'all');
    // Scope-visible set (all: all live; own: own live), used for stat-card counts.
    const visible = liveSubs(db).filter((s) => allScope || s.created_by === user.email);
    const counts = {
      total: visible.length,
      active: visible.filter((s) => s.is_active).length,
      inactive: visible.filter((s) => !s.is_active).length,
    };
    const reps = allScope
      ? Array.from(new Set(visible.map((s) => s.created_by))).sort()
      : [];
    // Weeks a subscription was started on (derived from start_date), newest first.
    const weeks = Array.from(new Set(visible.map((s) => getWeekInfo(s.start_date).weekId)))
      .sort()
      .reverse();

    // Server-side filtering so pagination operates on the filtered set.
    const q = String(p.q || '').trim().toLowerCase();
    const status = p.status || 'all';
    const repFilter = p.rep && p.rep !== 'all' ? p.rep : null;
    const weekFilter = p.week && p.week !== 'all' ? p.week : null;
    const filtered = visible.filter((s) => {
      if (status === 'active' && !s.is_active) return false;
      if (status === 'inactive' && s.is_active) return false;
      if (repFilter && s.created_by !== repFilter) return false;
      if (weekFilter && getWeekInfo(s.start_date).weekId !== weekFilter) return false;
      if (q && !`${s.customer_name} ${s.subscription_id} ${s.product}`.toLowerCase().includes(q)) return false;
      return true;
    });

    // Pagination.
    const pageSize = Math.max(1, Number(p.pageSize) || 10);
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(1, Number(p.page) || 1), pages);
    const slice = filtered.slice((page - 1) * pageSize, page * pageSize);
    const rows = allScope ? slice : slice.map(repSubscriptionView);
    return { rows, page, pageSize, total, pages, counts, reps, weeks };
  },

  getSubscription(db, p, user) {
    requirePermission(user, 'subscriptions', 'read');
    const allScope = hasScope(user, 'subscriptions', 'all');
    const sub = liveSubs(db).find((s) => s.subscription_id === p.subscription_id);
    if (!sub) throw new ApiError('Subscription not found');
    if (allScope) return sub;
    if (sub.created_by !== user.email) throw new ApiError('Forbidden: not your subscription');
    return repSubscriptionView(sub);
  },

  updateSubscription(db, p, user) {
    requirePermission(user, 'subscriptions', 'update');
    const allScope = hasScope(user, 'subscriptions', 'all');
    const sub = liveSubs(db).find((s) => s.subscription_id === p.subscription_id);
    if (!sub) throw new ApiError('Subscription not found');
    if (!allScope && sub.created_by !== user.email) throw new ApiError('Forbidden: you can only edit your own subscriptions.');
    // Own-scope users may edit content fields, but NOT internal_notes (all-scope only).
    const repEditable = ['customer_name', 'customer_address', 'customer_phone', 'allergy_concerns', 'food_requests', 'product', 'quantity', 'start_date'];
    const editable = allScope ? repEditable.concat(['internal_notes']) : repEditable;
    if (p.product !== undefined) {
      const prod = db.products.find((x) => x.product_name === p.product);
      if (!prod || !prod.active) throw new ApiError('Unknown or inactive product: ' + p.product);
    }
    const before = {}, after = {};
    editable.forEach((f) => {
      if (p[f] !== undefined && p[f] !== sub[f]) {
        before[f] = sub[f];
        after[f] = f === 'quantity' ? Number(p[f]) : p[f];
        sub[f] = after[f];
      }
    });
    logAction(db, user, 'Updated Subscription', sub.subscription_id, 'SUBSCRIPTION', { before, after });
    save(db);
    return allScope ? sub : repSubscriptionView(sub);
  },

  setSubscriptionActive(db, p, user) {
    requirePermission(user, 'subscriptions', 'update');
    const sub = liveSubs(db).find((s) => s.subscription_id === p.subscription_id);
    if (!sub) throw new ApiError('Subscription not found');
    sub.is_active = !!p.is_active;
    if (p.note) sub.internal_notes = (sub.internal_notes ? sub.internal_notes + ' | ' : '') + p.note;
    logAction(db, user, p.is_active ? 'Activated Subscription' : 'Deactivated Subscription', sub.subscription_id, 'SUBSCRIPTION', { is_active: sub.is_active, note: p.note || '' });
    save(db);
    return sub;
  },

  deleteSubscription(db, p, user) {
    requirePermission(user, 'subscriptions', 'delete');
    const sub = liveSubs(db).find((s) => s.subscription_id === p.subscription_id);
    if (!sub) throw new ApiError('Subscription not found');
    sub.is_deleted = true;
    sub.is_active = false;
    logAction(db, user, 'Deleted Subscription', sub.subscription_id, 'SUBSCRIPTION', { reason: p.reason || '', customer_name: sub.customer_name });
    save(db);
    return { deleted: true, subscription_id: sub.subscription_id };
  },

  // payments ------------------------------------------------------------
  listPayments(db, p, user) {
    requirePermission(user, 'payments', 'read');
    let rows = db.payments.slice();
    if (!hasScope(user, 'payments', 'all')) {
      rows = rows.filter((x) => String(x.recorded_by).toLowerCase() === String(user.email).toLowerCase());
    }
    if (p && p.week_group) rows = rows.filter((x) => x.week_group === p.week_group);
    if (p && p.subscription_id) rows = rows.filter((x) => x.subscription_id === p.subscription_id);
    // Newest first (by week, then id) — handy for the per-subscription panel.
    rows.sort((a, b) => (a.week_group < b.week_group ? 1 : a.week_group > b.week_group ? -1 : (a.payment_id < b.payment_id ? 1 : -1)));
    return rows;
  },

  recordPayment(db, p, user) {
    requirePermission(user, 'payments', 'record');
    const sub = liveSubs(db).find((s) => s.subscription_id === p.subscription_id);
    if (!sub) throw new ApiError('Subscription not found: ' + p.subscription_id);
    if (!p.payment_method) throw new ApiError('payment_method is required');
    if (!p.customer_reference) throw new ApiError('customer_reference is required');
    const week = p.week_group || currentWeekGroup();
    const amount = priceFor(db, sub.product) * Number(sub.quantity); // amount derived, not hand-entered
    const seq = db.payments.filter((x) => x.payment_id.startsWith('PAY-' + week + '-')).length + 1;
    const payment = {
      payment_id: `PAY-${week}-${pad3(seq)}`, subscription_id: sub.subscription_id, week_group: week,
      amount_php: amount, payment_method: p.payment_method, customer_reference: p.customer_reference,
      proof_of_payment: p.proof_of_payment || '', recorded_date: todayISO(), recorded_by: user.email,
      verified_by: '', verified_at: '', status: 'Pending Verification',
    };
    db.payments.push(payment);
    logAction(db, user, 'Recorded Payment', payment.payment_id, 'PAYMENT', { subscription_id: sub.subscription_id, week_group: week, amount_php: amount });
    save(db);
    return payment;
  },

  verifyPayment(db, p, user) {
    requirePermission(user, 'payments', 'verify');
    const pay = db.payments.find((x) => x.payment_id === p.payment_id);
    if (!pay) throw new ApiError('Payment not found');
    // A single owner records AND verifies (PO: must support one-owner operation), so there
    // is no verify-vs-record separation — the payments:verify grant is the control.
    pay.status = 'Verified'; pay.verified_by = user.email; pay.verified_at = nowTimestamp();
    logAction(db, user, 'Verified Payment', pay.payment_id, 'PAYMENT', { subscription_id: pay.subscription_id });
    save(db);
    return pay;
  },

  revertPayment(db, p, user) {
    requirePermission(user, 'payments', 'revert');
    const pay = db.payments.find((x) => x.payment_id === p.payment_id);
    if (!pay) throw new ApiError('Payment not found');
    const prev = pay.status;
    pay.status = 'Pending Verification'; pay.verified_by = ''; pay.verified_at = '';
    logAction(db, user, 'Reverted Payment', pay.payment_id, 'PAYMENT', { from: prev, to: 'Pending Verification' });
    save(db);
    return pay;
  },

  disputePayment(db, p, user) {
    requirePermission(user, 'payments', 'update');
    const pay = db.payments.find((x) => x.payment_id === p.payment_id);
    if (!pay) throw new ApiError('Payment not found');
    pay.status = 'Disputed';
    logAction(db, user, 'Disputed Payment', pay.payment_id, 'PAYMENT', { reason: p.reason || '' });
    save(db);
    return pay;
  },

  refundPayment(db, p, user) {
    requirePermission(user, 'payments', 'update');
    const pay = db.payments.find((x) => x.payment_id === p.payment_id);
    if (!pay) throw new ApiError('Payment not found');
    pay.status = 'Refunded';
    logAction(db, user, 'Refunded Payment', pay.payment_id, 'PAYMENT', { reason: p.reason || '' });
    save(db);
    return pay;
  },

  // dashboard -----------------------------------------------------------
  weekOptions(db, p, user) {
    requirePermission(user, 'dashboard', 'read');
    const set = new Set(db.payments.map((x) => x.week_group));
    set.add(currentWeekGroup());
    return { weeks: Array.from(set).sort().reverse(), current: currentWeekGroup() };
  },

  weeklyDashboard(db, p, user) {
    requirePermission(user, 'dashboard', 'read');
    const week = p.week_group || currentWeekGroup();
    const overdueDays = Number(db.settings.overdue_days) || 3;
    const active = liveSubs(db).filter((s) => s.is_active);
    const paysThisWeek = db.payments.filter((x) => x.week_group === week);
    const verifiedBySub = {};
    paysThisWeek.forEach((x) => { if (x.status === 'Verified') verifiedBySub[x.subscription_id] = x; });

    let expectedTotal = 0, collected = 0;
    const byProduct = {};
    const unpaid = [];
    active.forEach((s) => {
      const amt = priceFor(db, s.product) * Number(s.quantity);
      expectedTotal += amt;
      byProduct[s.product] = byProduct[s.product] || { count: 0, amount: 0 };
      byProduct[s.product].count += 1;
      byProduct[s.product].amount += amt;
      if (verifiedBySub[s.subscription_id]) {
        collected += verifiedBySub[s.subscription_id].amount_php;
      } else {
        const recorded = paysThisWeek.find((x) => x.subscription_id === s.subscription_id);
        unpaid.push({
          subscription_id: s.subscription_id, customer_name: s.customer_name, customer_phone: s.customer_phone,
          product: s.product, expected_amount: amt,
          payment_status: recorded ? recorded.status : 'No payment',
        });
      }
    });
    return {
      week_group: week, activeCount: active.length, expectedTotal, collected,
      outstanding: expectedTotal - collected, byProduct, unpaid, overdueDays,
    };
  },

  // invoices (EPIC 5) ---------------------------------------------------
  listInvoices(db, p, user) {
    requirePermission(user, 'invoices', 'read');
    let rows = (db.invoices || []).filter((x) => !x.is_deleted);
    if (p && p.subscription_id) rows = rows.filter((x) => x.subscription_id === p.subscription_id);
    const q = String((p && p.q) || '').trim().toLowerCase();
    if (q) rows = rows.filter((x) => `${x.invoice_id} ${x.customer_name}`.toLowerCase().includes(q));
    // Newest first by id (ids are zero-padded so string sort == numeric sort).
    rows.sort((a, b) => (a.invoice_id < b.invoice_id ? 1 : a.invoice_id > b.invoice_id ? -1 : 0));
    return rows;
  },

  getInvoice(db, p, user) {
    requirePermission(user, 'invoices', 'read');
    const inv = (db.invoices || []).find((x) => x.invoice_id === p.invoice_id && !x.is_deleted);
    if (!inv) throw new ApiError('Invoice not found');
    return inv;
  },

  createInvoice(db, p, user) {
    requirePermission(user, 'invoices', 'create');
    const sub = liveSubs(db).find((s) => s.subscription_id === p.subscription_id);
    if (!sub) throw new ApiError('Subscription not found: ' + p.subscription_id);
    const description = String(p.description || '').trim();
    if (!description) throw new ApiError('description is required');
    const quantity = Number(p.quantity);
    const rate = Number(p.rate);
    if (!(quantity > 0)) throw new ApiError('quantity must be greater than 0');
    if (!(rate >= 0)) throw new ApiError('rate must be 0 or more');
    const amount = quantity * rate;
    db.invoices = db.invoices || [];
    // Continue from the owner's starting number, or 1 past the highest existing — whichever
    // is greater. Lets an owner resume numbering from a previous invoice generator.
    const startNum = Math.max(1, Math.floor(Number(db.settings.invoice_start_number) || 1));
    let highest = 0;
    db.invoices.forEach((x) => {
      const m = String(x.invoice_id).match(/(\d+)\s*$/);
      if (m) highest = Math.max(highest, Number(m[1]));
    });
    const seq = Math.max(startNum, highest + 1);
    const invoice = {
      invoice_id: `INV-${String(seq).padStart(6, '0')}`,
      invoice_date: p.invoice_date || todayISO(),
      subscription_id: sub.subscription_id, customer_id: sub.customer_id || '',
      customer_name: sub.customer_name, customer_address: sub.customer_address,
      description, line_note: String(p.line_note || ''),
      quantity, rate, amount,
      currency: db.settings.currency || 'PHP', notes: String(p.notes || ''),
      created_by: user.email, created_at: nowTimestamp(), is_deleted: false,
    };
    db.invoices.push(invoice);
    logAction(db, user, 'Created Invoice', invoice.invoice_id, 'INVOICE',
      { subscription_id: sub.subscription_id, customer_name: sub.customer_name, amount });
    save(db);
    return invoice;
  },

  deleteInvoice(db, p, user) {
    requirePermission(user, 'invoices', 'delete');
    // Soft delete: keep the row so the invoice number is never reused and the audit trail holds.
    const inv = (db.invoices || []).find((x) => x.invoice_id === p.invoice_id && !x.is_deleted);
    if (!inv) throw new ApiError('Invoice not found');
    inv.is_deleted = true;
    logAction(db, user, 'Deleted Invoice', inv.invoice_id, 'INVOICE',
      { customer_name: inv.customer_name, amount: inv.amount, reason: p.reason || '' });
    save(db);
    return { deleted: true, invoice_id: inv.invoice_id };
  },

  // audit ---------------------------------------------------------------
  listAudit(db, p, user) {
    requirePermission(user, 'audit', 'read');
    return db.audit.slice().sort((a, b) => b.log_id - a.log_id);
  },

  // dev utility --------------------------------------------------------
  resetDemoData(db, p, user) {
    requirePermission(user, 'audit', 'read'); // owner + admin both hold audit:read
    return { reset: true, db: resetMockDb() };
  },
};

// ---- public entry --------------------------------------------------------
export async function mockCall(action, payload, ctx) {
  await new Promise((r) => setTimeout(r, 60));
  const db = load();
  const email = ctx && ctx.email;
  const role = resolveRole(db, email);
  if (!role) return { ok: false, error: 'Unauthorized: email not assigned a role.' };
  const user = { email, role, permissions: permsFor(db, { email, role }) };
  const handler = handlers[action];
  if (!handler) return { ok: false, error: 'Unknown action: ' + action };
  try {
    return { ok: true, data: handler(db, payload || {}, user) };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}
