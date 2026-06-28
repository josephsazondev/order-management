/**
 * Auth.gs — identity & role resolution.
 *
 * Identity comes from the Google session (Session.getActiveUser), NOT client input.
 * Role is resolved from the USERS sheet, plus the bootstrap admin from Config.
 * Deploy "Execute as: User accessing the web app" so getActiveUser() is the signed-in user.
 */

function roleFor_(email) {
  var e = String(email || '').trim().toLowerCase();
  if (!e) return null;
  if (CONFIG.ADMIN_BOOTSTRAP_EMAILS.map(function (x) { return x.toLowerCase(); }).indexOf(e) >= 0) {
    return ROLES.ADMIN;
  }
  var users = readObjects(CONFIG.SHEETS.USERS);
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].email).toLowerCase() === e && isTrue_(users[i].active)) {
      return users[i].role;
    }
  }
  return null;
}

function getCurrentUser_() {
  var email = Session.getActiveUser().getEmail();
  var role = roleFor_(email);
  if (!email || !role) {
    throw new AuthError('Unauthorized: ' + (email || 'unknown user') + ' is not assigned a role.');
  }
  return { email: email, role: role };
}

// ---------------------------------------------------------------------------
// Permission resolution. The authorization model is now grant-based:
//   email → role_id (USERS) → permission grant set (ROLES) → requirePermission_
// permsFor_ is memoized per request (per role_id) to avoid repeated Sheets reads.
// ---------------------------------------------------------------------------
var PERMS_CACHE_ = {};

// Returns an array of grant strings (e.g. "payments:verify", "subscriptions:read:all")
// for the user's role. Bootstrap admin emails and built-in role_ids source from
// BUILTIN_ROLE_PERMISSIONS so they work even before the ROLES sheet has rows.
function permsFor_(user) {
  if (!user) return [];
  var roleId = user.role;
  // Bootstrap admin always gets the built-in admin grant set.
  if (CONFIG.ADMIN_BOOTSTRAP_EMAILS.map(function (x) { return x.toLowerCase(); }).indexOf(String(user.email || '').toLowerCase()) >= 0) {
    roleId = ROLES.ADMIN;
  }
  if (PERMS_CACHE_.hasOwnProperty(roleId)) return PERMS_CACHE_[roleId];

  var grants;
  if (BUILTIN_ROLE_PERMISSIONS.hasOwnProperty(roleId)) {
    grants = BUILTIN_ROLE_PERMISSIONS[roleId].slice();
  } else {
    grants = [];
    var roles = readObjects(CONFIG.SHEETS.ROLES);
    for (var i = 0; i < roles.length; i++) {
      if (String(roles[i].role_id) === String(roleId) && isTrue_(roles[i].active)) {
        try { grants = JSON.parse(roles[i].permissions_json) || []; } catch (e) { grants = []; }
        break;
      }
    }
  }
  PERMS_CACHE_[roleId] = grants;
  return grants;
}

// True if the user holds `feature:action`. For scoped-read features the grant is stored
// as `feature:read:own` / `feature:read:all`, so a plain `read` check is satisfied by
// either scope; use hasScope_ when you need to distinguish own vs all.
function hasPermission_(user, feature, action) {
  var grants = permsFor_(user);
  if (grants.indexOf(feature + ':' + action) >= 0) return true;
  if (action === 'read') {
    return grants.indexOf(feature + ':read:own') >= 0 || grants.indexOf(feature + ':read:all') >= 0;
  }
  return false;
}

// requirePermission_(user, 'payments', 'verify') — throws AuthError if grant absent.
function requirePermission_(user, feature, action) {
  if (!hasPermission_(user, feature, action)) {
    throw new AuthError('Forbidden: this action requires the ' + feature + ':' + action + ' permission.');
  }
}

// hasScope_(user, 'subscriptions', 'all') — true if the user holds the read:all
// (or read:own) scope for a scoped-read feature.
function hasScope_(user, feature, scope) {
  return permsFor_(user).indexOf(feature + ':read:' + scope) >= 0;
}

function isTrue_(v) { return v === true || v === 'TRUE' || v === 'true'; }

function AuthError(message) { this.name = 'AuthError'; this.message = message; }
AuthError.prototype = Object.create(Error.prototype);
