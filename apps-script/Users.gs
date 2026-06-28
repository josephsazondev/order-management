/**
 * Users.gs — user accounts & role assignment. Granular `users` grants:
 *   users:read   — view the users list (+ roles)
 *   users:create — add a NEW user (and set their initial role)
 *   users:assign — change an EXISTING user's role / status
 *   users:delete — deactivate a user
 * (Role-DEFINITION management — create/edit/delete roles — is gated separately on
 *  users:update in Roles.gs.)
 */

function listUsers_(payload, user) {
  requirePermission_(user, 'users', 'read');
  return readObjects(CONFIG.SHEETS.USERS);
}

function upsertUser_(payload, user) {
  var email = String(payload.email || '').trim().toLowerCase();
  if (!email) throw new Error('email is required');
  // Role validity: role_id must exist in active ROLES (built-ins are always valid).
  if (!roleIdIsValid_(payload.role)) throw new Error('Invalid role: ' + payload.role);
  var existing = readObjects(CONFIG.SHEETS.USERS).filter(function (u) { return String(u.email).toLowerCase() === email; })[0];
  // Adding a new user requires users:create; re-assigning an existing one requires users:assign.
  requirePermission_(user, 'users', existing ? 'assign' : 'create');
  return withLock_(function () {
    var current = readObjects(CONFIG.SHEETS.USERS).filter(function (u) { return String(u.email).toLowerCase() === email; })[0];
    var active = payload.active !== undefined ? !!payload.active : (current ? isTrue_(current.active) : true);
    var row = {
      email: email, role: payload.role, assigned_by: user.email, assigned_at: nowTimestamp_(), active: active,
    };
    // No-lockout guardrail: the change must not leave zero active user-managers.
    var err = noLockoutAfterUserChange_(email, payload.role, active);
    if (err) throw new Error(err);
    if (current) updateByKey(CONFIG.SHEETS.USERS, 'email', current.email, row);
    else appendObject(CONFIG.SHEETS.USERS, row);
    logAction_(user, current ? 'Updated User Role' : 'Created User', email, 'USER', { role: row.role, active: row.active });
    return row;
  });
}

function deactivateUser_(payload, user) {
  requirePermission_(user, 'users', 'delete');
  var email = String(payload.email || '').trim().toLowerCase();
  if (CONFIG.ADMIN_BOOTSTRAP_EMAILS.map(function (x) { return x.toLowerCase(); }).indexOf(email) >= 0) {
    throw new Error('Cannot deactivate the bootstrap admin.');
  }
  var merged = withLock_(function () {
    // No-lockout guardrail: deactivating must not remove the last user-manager.
    var err = noLockoutAfterUserChange_(email, null, false);
    if (err) throw new Error(err);
    return updateByKey(CONFIG.SHEETS.USERS, 'email', email, { active: false });
  });
  if (!merged) throw new Error('User not found');
  logAction_(user, 'Deactivated User', email, 'USER', {});
  return merged;
}

// True if role_id is a built-in or an active row in the ROLES sheet.
function roleIdIsValid_(roleId) {
  if (!roleId) return false;
  if (BUILTIN_ROLE_PERMISSIONS.hasOwnProperty(roleId)) return true;
  var roles = readObjects(CONFIG.SHEETS.ROLES);
  for (var i = 0; i < roles.length; i++) {
    if (String(roles[i].role_id) === String(roleId) && isTrue_(roles[i].active)) return true;
  }
  return false;
}

// Resolve a role_id to its grant set (built-in or ROLES sheet). Inactive/unknown → [].
function grantsForRoleId_(roleId, rolesRows) {
  if (BUILTIN_ROLE_PERMISSIONS.hasOwnProperty(roleId)) return BUILTIN_ROLE_PERMISSIONS[roleId].slice();
  rolesRows = rolesRows || readObjects(CONFIG.SHEETS.ROLES);
  for (var i = 0; i < rolesRows.length; i++) {
    if (String(rolesRows[i].role_id) === String(roleId) && isTrue_(rolesRows[i].active)) {
      try { return JSON.parse(rolesRows[i].permissions_json) || []; } catch (e) { return []; }
    }
  }
  return [];
}

// A grant set can "manage user access" (for the no-lockout guardrail) if it can assign
// roles to existing users or create new users — i.e. it can repair access. Editing role
// DEFINITIONS (users:update) alone does not count: it can't get a privileged user in.
function grantsManageUsers_(grants) {
  return grants.indexOf('users:assign') >= 0 || grants.indexOf('users:create') >= 0;
}

/**
 * No-lockout check at the USER-assignment level. Simulates the proposed change to
 * one user (email → newRole / newActive; pass newRole=null to leave role unchanged)
 * and returns an error string if it would leave ZERO active users able to manage
 * users/roles. Bootstrap admins always count as active managers. Returns '' if safe.
 */
function noLockoutAfterUserChange_(email, newRole, newActive) {
  var rolesRows = readObjects(CONFIG.SHEETS.ROLES);
  var users = readObjects(CONFIG.SHEETS.USERS);
  var bootstrap = CONFIG.ADMIN_BOOTSTRAP_EMAILS.map(function (x) { return x.toLowerCase(); });
  var managers = 0;
  var found = false;
  email = String(email || '').toLowerCase();
  users.forEach(function (u) {
    var e = String(u.email).toLowerCase();
    var active = isTrue_(u.active);
    var role = u.role;
    if (e === email) {
      found = true;
      active = newActive;
      if (newRole !== null && newRole !== undefined) role = newRole;
    }
    if (!active) return;
    if (bootstrap.indexOf(e) >= 0 || grantsManageUsers_(grantsForRoleId_(role, rolesRows))) managers++;
  });
  // A brand-new user being added (not yet in sheet) — count them too.
  if (!found && email && newActive) {
    if (bootstrap.indexOf(email) >= 0 || grantsManageUsers_(grantsForRoleId_(newRole, rolesRows))) managers++;
  }
  return managers > 0 ? '' : 'This change would leave no active user able to manage users/roles.';
}
