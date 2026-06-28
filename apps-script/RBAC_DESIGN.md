# RBAC Design — Custom Roles & Permissions (Story 1.5)

Source story: [BACKLOG.md](../BACKLOG.md) → EPIC 1 → Story 1.5.
Status: **Approved for build.** Architecture by Solutions Architect role.

## Core decision

Authorization moves from **role-name checks** to **permission checks**, resolved per request:

```
email → role_id (USERS sheet) → permission set (ROLES sheet) → requirePermission_(user, feature, action)
```

The three roles (`admin`, `owner`, `sales_rep`) become **seed rows** in a new `ROLES` sheet.
Their `role_id` values equal today's role strings, so **existing USERS rows need no migration**.

## Schema

### New `ROLES` sheet — add to `Config.gs` `HEADERS.ROLES`
| Column | Type | Notes |
|---|---|---|
| `role_id` | string | slug, PK. Built-ins: `admin` / `owner` / `sales_rep` |
| `name` | string | display name |
| `is_builtin` | boolean | built-ins cannot be renamed or deleted |
| `permissions_json` | string (text) | JSON array of `feature:action` grants |
| `created_by` | string | email |
| `created_at` | string | `YYYY-MM-DD HH:mm:ss` |
| `active` | boolean | |

Add `permissions_json`, `created_at` to `TEXT_COLUMNS`.

### `USERS` sheet
Columns unchanged. `role` now holds a `role_id` (FK → `ROLES.role_id`). No migration (built-in ids match).

### Permission storage format
Flat string grants in `permissions_json`; read scope encoded inline:
```json
["subscriptions:create","subscriptions:read:all","subscriptions:update",
 "subscriptions:delete","payments:record","payments:verify","payments:revert",
 "products:read","users:read","users:assign","settings:update","audit:read"]
```
- `read` scope = `:read:own` vs `:read:all` (subscriptions & payments).
- Absent grant = deny.

### Permission catalog — single source of truth
Add `PERMISSIONS` to `Config.gs`: the canonical list of every valid `feature:action`.
The guardrail validator (backend) and the Roles editor (frontend `config.js`) both render from it — no drift.

Features & actions (from Story 1.5):
| Feature | Actions |
|---|---|
| subscriptions | create, read (own/all), update, delete |
| payments | record, read (own/all), update, verify, revert |
| customers | create, read, update, lookup |
| products | create, read, update, delete |
| dashboard | read |
| invoices | read, create, delete, configure |
| users | create, read, update, delete, assign |
| settings | read, update |
| audit | read |

### Permission semantics (granular — all grants are enforced)
- **users** — `read` = view users + roles; `create` = add a NEW user; `assign` = change an
  EXISTING user's role/status; `delete` = deactivate a user; `update` = manage role *definitions*
  (the Roles screen: create/edit/delete roles). This lets you build, e.g., an "assigner" role
  (read+assign) separate from a "role designer" (read+update).
- **settings** — `update` gates saving system settings; `read` gates *viewing* the System Settings
  screen. NB: the lightweight `getSettings` fetch is intentionally **ungated** — every role needs
  branding / currency / payment-method values for the UI to function; it is app infrastructure, not
  an admin-only read.
- **customers** — `lookup` = the subscription-form contact picker (contact fields only, no prices);
  `read` = the owner Customers directory + per-client history.
- **invoices** — `configure` = invoice branding + payment accounts; `create`/`read`/`delete` as named.
- **No-lockout "manager"** = a grant set holding `users:assign` OR `users:create` (can repair access).

## Backend changes

### `Auth.gs` (core refactor)
- `permsFor_(user)` — load the user's `ROLES` row → `Set` of grants; **memoize per request**.
- `requirePermission_(user, feature, action)` — throws `AuthError` if grant absent.
- `hasScope_(user, feature, 'all'|'own')` — for list filtering.
- **Delete `requireRole_`**; migrate all ~24 call sites (mechanical mapping below).
- Bootstrap admin: `roleFor_` still resolves bootstrap emails to `admin`; `permsFor_` must return the built-in `admin` grant set even before `ROLES` has rows.

Call-site mapping examples:
- `Payments.gs` verify: `requireRole_(user, OWNER)` → `requirePermission_(user,'payments','verify')`
- `Subscriptions.gs` list: filter by `hasScope_(user,'subscriptions','all')` else own-only by `created_by`
- `Settings.gs` update: → `requirePermission_(user,'settings','update')`
- `Dashboard.gs`: → `requirePermission_(user,'dashboard','read')`
- `Audit.gs`: → `requirePermission_(user,'audit','read')`
- `Users.gs` list/upsert/deactivate: → `users:read` / `users:update` / `users:update`

### `Roles.gs` (new) + register in `Code.gs` `ACTIONS`
- `listRoles_` (perm `users:read`)
- `upsertRole_` (perm `users:update`) — runs guardrail validator inside `withLock_`, writes via
  `appendObject`/`updateByKey`, `logAction_(user, ..., 'ROLE', ...)`.
- `deleteRole_` (perm `users:update`) — reject if `is_builtin` or any USERS row references it.

### `Users.gs`
`upsertUser_` role validity: change from the hardcoded 3-enum to *"role_id exists in active ROLES"*.
Add the no-lockout guardrail to `upsertUser_`/`deactivateUser_` too (not only `upsertRole_`).

### `Setup.gs`
Create + seed `ROLES` with the three built-ins from the RBAC matrix in [BACKLOG.md](../BACKLOG.md).

## API contracts
```
listRoles            → { ok, data: Role[] }                              perm: users:read
upsertRole
  role_id?  string   (omit = create)
  name      string   required
  permissions string[] required
  active    boolean  optional
  → { ok, data: Role } | { ok:false, error }    perm: users:update; guardrail-validated
deleteRole
  role_id   string   required
  → { ok } | { ok:false, error:"built-in"/"in use" }
getSession → { email, role, permissions: string[] }   // permissions[] is NEW
```

## Guardrails (validated in `upsertRole_`; return `{ok:false,error}` with a clear message)
1. **Separation of duties** — reject a role holding *both* `subscriptions:create|update` *and*
   `payments:record|verify`.
2. **No lockout** — reject if the change leaves **zero active users** able to manage access, i.e.
   holding `users:assign` or `users:create` (evaluate across all roles after the hypothetical
   change). Also enforced in `upsertUser_`/`deactivateUser_`.
3. **Built-in protection** — `is_builtin` roles: `name`/`is_builtin` immutable; reject permission
   edits that would violate #1.
4. ~~**Verify ≠ self-record**~~ — **DROPPED (PO, post-QA).** A single owner must be able to
   record *and* verify their own payments (one-owner operation). The `payments:verify` grant is
   the only control on verification; `verified_by` is still recorded for the audit trail. The
   separation that remains is guardrail #1 (a role can't hold both subscription-write and
   payment record/verify).

## Frontend changes
- `getSession` returns `permissions[]` → store in `AuthContext`; expose `can(feature, action)` and
  `canScope(feature,'all')`.
- Replace role-string UI gates (`user.role === 'owner'`) with `can(...)`. UI gating is convenience
  only — the server enforces via `requirePermission_`.
- New `pages/admin/Roles.jsx`: role list + permission-matrix editor driven by the `PERMISSIONS`
  catalog; surface guardrail errors inline. `ROLE_LABELS` becomes data-driven from `listRoles`.

## Risks & mitigations
| Risk | Mitigation |
|---|---|
| Per-request Sheets read for perms adds latency | Memoize `permsFor_` per request; optional `CacheService` 60s keyed by role_id, invalidated on `upsertRole_` |
| Guardrail rejections must be visible | `appsScriptCall` already `await res.json()` → `{ok:false,error}` surfaces. Role saves use `call()` + render error; do **not** use the optimistic fire-and-forget mutation pattern |
| New `ROLES` columns not auto-created on a deployed sheet | `Setup.gs` creates sheet + header row; document in `DEPLOY.md`; requires manual **New Version** redeploy |
| Last user-manager deactivated → lockout | No-lockout guardrail also fires in `upsertUser_`/`deactivateUser_` |
| Bootstrap admin bypasses ROLES | `permsFor_` returns built-in `admin` grant set for bootstrap emails before ROLES has rows |
| Orphaned `role_id` (role deleted while assigned) | `deleteRole_` rejects if any USERS row references it (deactivate instead) |
