/**
 * Roles.gs — custom role + permission management (Story 1.5).
 *
 * Roles live in the ROLES sheet. Built-ins (admin/owner/sales_rep) are seeded by Setup
 * and protected: name/is_builtin immutable, undeletable, and their permission edits must
 * not break the separation-of-duties guardrail.
 *
 * Grants are stored as a JSON array of `feature:action` strings in `permissions_json`
 * (a TEXT_COLUMN, so Sheets won't mangle it).
 */

function listRoles_(payload, user) {
  requirePermission_(user, 'users', 'read');
  return readObjects(CONFIG.SHEETS.ROLES).map(roleView_);
}

// Normalize a ROLES row into a clean API object (permissions as an array, booleans real).
function roleView_(r) {
  var perms = [];
  try { perms = JSON.parse(r.permissions_json) || []; } catch (e) { perms = []; }
  return {
    role_id: r.role_id, name: r.name, is_builtin: isTrue_(r.is_builtin),
    permissions: perms, created_by: r.created_by, created_at: r.created_at, active: isTrue_(r.active),
  };
}

function upsertRole_(payload, user) {
  requirePermission_(user, 'users', 'update');
  var name = String(payload.name || '').trim();
  var perms = payload.permissions || [];
  if (!Array.isArray(perms)) throw new Error('permissions must be an array');

  return withLock_(function () {
    var roles = readObjects(CONFIG.SHEETS.ROLES);
    var existing = payload.role_id
      ? roles.filter(function (r) { return String(r.role_id) === String(payload.role_id); })[0]
      : null;
    var isCreate = !existing;
    var isBuiltin = existing ? isTrue_(existing.is_builtin) : false;

    if (isCreate && !name) throw new Error('Role name is required.');

    // Validate every grant against the catalog (no drift / typos).
    var legal = allPermissionStrings_();
    for (var i = 0; i < perms.length; i++) {
      if (legal.indexOf(perms[i]) < 0) throw new Error('Unknown permission: ' + perms[i] + '.');
    }

    // Guardrail #3 — built-in protection: name & is_builtin are immutable.
    if (existing && isBuiltin) {
      if (name && name !== existing.name) throw new Error('Built-in roles cannot be renamed.');
    }

    // Guardrail #1 — separation of duties: no role holds BOTH subscription create/update
    // AND payment record/verify. Applies to built-ins too (covers guardrail #3's "can't
    // edit a built-in's perms to break #1").
    var sodErr = checkSeparationOfDuties_(perms);
    if (sodErr) throw new Error(sodErr);

    // Unique, non-empty display name across roles (case-insensitive).
    if (name) {
      var clash = roles.filter(function (r) {
        return String(r.name).toLowerCase() === name.toLowerCase()
          && (!existing || String(r.role_id) !== String(existing.role_id));
      })[0];
      if (clash) throw new Error('A role named "' + name + '" already exists.');
    }

    // Build the prospective row.
    var roleId, finalName, finalBuiltin, finalActive;
    if (existing) {
      roleId = existing.role_id;
      finalName = isBuiltin ? existing.name : (name || existing.name);
      finalBuiltin = isBuiltin;
      finalActive = payload.active !== undefined ? !!payload.active : isTrue_(existing.active);
    } else {
      roleId = slugifyRoleId_(name, roles);
      finalName = name;
      finalBuiltin = false;
      finalActive = payload.active !== undefined ? !!payload.active : true;
    }

    // Guardrail #2 — no lockout: the change must not leave zero active users able to
    // manage users/roles. Evaluate across all roles with this role's new grant set.
    var lockErr = checkNoLockoutAfterRoleChange_(roleId, perms, finalActive, roles);
    if (lockErr) throw new Error(lockErr);

    var row = {
      role_id: roleId, name: finalName, is_builtin: finalBuiltin,
      permissions_json: JSON.stringify(perms),
      created_by: existing ? existing.created_by : user.email,
      created_at: existing ? existing.created_at : nowTimestamp_(),
      active: finalActive,
    };
    if (existing) updateByKey(CONFIG.SHEETS.ROLES, 'role_id', roleId, row);
    else appendObject(CONFIG.SHEETS.ROLES, row);

    logAction_(user, isCreate ? 'Created Role' : 'Updated Role', roleId, 'ROLE',
      { name: finalName, permissions: perms, active: finalActive });
    return roleView_(row);
  });
}

function deleteRole_(payload, user) {
  requirePermission_(user, 'users', 'update');
  var roleId = String(payload.role_id || '');
  if (!roleId) throw new Error('role_id is required.');
  return withLock_(function () {
    var role = readObjects(CONFIG.SHEETS.ROLES).filter(function (r) { return String(r.role_id) === roleId; })[0];
    if (!role) throw new Error('Role not found.');
    if (isTrue_(role.is_builtin)) throw new Error('Built-in roles cannot be deleted.');
    var inUse = readObjects(CONFIG.SHEETS.USERS).some(function (u) { return String(u.role) === roleId; });
    if (inUse) throw new Error('Role is assigned to one or more users; reassign them first.');

    // Hard-remove the row (no soft-delete column on ROLES beyond `active`).
    var sheet = getSheet_(CONFIG.SHEETS.ROLES);
    var lastRow = sheet.getLastRow();
    var headers = getHeaders_(sheet);
    var idIdx = headers.indexOf('role_id');
    var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    for (var r = 0; r < values.length; r++) {
      if (String(values[r][idIdx]) === roleId) { sheet.deleteRow(2 + r); break; }
    }
    logAction_(user, 'Deleted Role', roleId, 'ROLE', { name: role.name });
    return { deleted: true, role_id: roleId };
  });
}

// ---------------------------------------------------------------------------
// Guardrail helpers
// ---------------------------------------------------------------------------

// Guardrail #1 — separation of duties.
function checkSeparationOfDuties_(grants) {
  var hasSubWrite = grants.indexOf('subscriptions:create') >= 0 || grants.indexOf('subscriptions:update') >= 0;
  var hasPayAct = grants.indexOf('payments:record') >= 0 || grants.indexOf('payments:verify') >= 0;
  if (hasSubWrite && hasPayAct) {
    return 'Separation of duties: a role cannot hold both subscription create/update and payment record/verify.';
  }
  return '';
}

// Guardrail #2 — no lockout, evaluated at the ROLE level. Recompute, across every active
// user, whether at least one is still able to manage users/roles after this role's grants
// change to `newGrants` (and `newActive` toggles whether the role grants anything).
function checkNoLockoutAfterRoleChange_(roleId, newGrants, newActive, rolesRows) {
  rolesRows = rolesRows || readObjects(CONFIG.SHEETS.ROLES);
  var users = readObjects(CONFIG.SHEETS.USERS);
  var bootstrap = CONFIG.ADMIN_BOOTSTRAP_EMAILS.map(function (x) { return x.toLowerCase(); });
  var managers = 0;
  users.forEach(function (u) {
    if (!isTrue_(u.active)) return;
    var e = String(u.email).toLowerCase();
    if (bootstrap.indexOf(e) >= 0) { managers++; return; }
    var grants;
    if (String(u.role) === String(roleId)) {
      grants = newActive ? newGrants : [];
    } else {
      grants = grantsForRoleId_(u.role, rolesRows);
    }
    if (grantsManageUsers_(grants)) managers++;
  });
  return managers > 0 ? '' : 'This change would leave no active user able to manage users/roles.';
}

// Derive a unique slug role_id from a display name.
function slugifyRoleId_(name, roles) {
  var base = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'role';
  var taken = {};
  roles.forEach(function (r) { taken[String(r.role_id)] = true; });
  if (!taken[base]) return base;
  var n = 2;
  while (taken[base + '_' + n]) n++;
  return base + '_' + n;
}
