# OrderFlow — MVP Backlog (derived from EPICS.md)

Status legend against the **current build**:
- ✅ **HAVE** — already built, little/no change
- 🔧 **CHANGE** — built, but the epic changes its behavior
- ➕ **NEW** — not built yet
- ➖ **DROP** — built, but we're cutting it for this MVP

> **✅ Decisions locked (PO):**
> - **Fraud model = B** — reps create/edit their *own* subscriptions, but **recording AND verifying
>   payments stays owner-only**. Strongest anti-fraud control preserved. (Overrides epic 3.1's
>   "Rep/Owner record payment" → **owner-only**.)
> - **Delete = soft-delete** — deleted rows are hidden everywhere but retained for the audit trail.
> - **Admin is a separate person from the owner.** Admin = system administrator (manages *who can
>   access* + *how the system behaves*). Owner = business operator (subscriptions, payments, products,
>   money). Admin does **not** touch business/financial data; owner does **not** manage users/system config.
> - **Invoice (Epic 5) is BUILT** — invoice settings + generate-from-subscription + printable doc.

---

## EPIC 1 — Administration (Users, Roles & System Config)

| # | Story | Status | Notes vs current build |
|---|---|---|---|
| 1.1 | 3 roles: **sales rep, owner, admin** | 🔧 CHANGE | We have owner + sales_rep only. **Admin is new** and is a separate person from the owner. |
| 1.2 | Admin assigns roles to users by gmail | ➕ NEW | Today roles are hardcoded in `Config.gs` / `config.js` allowlists. Needs a **USERS data store** + an admin screen. |
| 1.3 | User signs in with their email | ✅ HAVE | Email-based login already works. |
| 1.4 | Admin sets **system configurations** | ➕ NEW | Admin-only settings screen for how the system behaves (see list below). Today these are hardcoded constants. |
| 1.5 | Admin **creates custom roles** + assigns feature permissions (CRUD + key actions), then assigns roles to users | ➕ NEW | Pivots roles from hardcoded → data-driven. The 3 roles become **built-in defaults**; admin can add custom roles. **Prerequisite for 1.2.** See spec below. |

**Acceptance (1.2):**
- Admin opens a "Users" screen and sees all users with their role.
- Admin enters a gmail + picks a role → saved; that user gets that role on next login.
- Roles come from the USERS store, not a hardcoded list.
- A non-admin cannot open or call the user-management actions (server-enforced).
- **Bootstrap:** the first admin email is seeded in config so you can log in to create the rest.

**Acceptance (1.4) — system configuration:**
- Admin can view & edit app-level settings:
  - **Overdue threshold** (days before an unpaid payment is flagged overdue; today hardcoded = 3)
  - **Allowed payment methods** (today hardcoded: GCash, Bank Transfer, COD, Card)
  - **Business name / app title** (shown in header)
  - **Timezone & currency label** (today: Asia/Manila, PHP)
- Changes take effect across the app without a redeploy.
- Settings are **admin-only**; owner and reps cannot view or edit them.
- Admin **cannot** see or edit subscriptions, payments, products, or dashboards.

**Data delta:**
- new `USERS` sheet → `email, role, assigned_by, assigned_at, active`
- new `SETTINGS` sheet → key/value pairs (`overdue_days`, `payment_methods`, `business_name`, `timezone`, `currency`)

> **Boundary note:** *Products/pricing stay with the OWNER* (a business/money decision), not admin.
> Admin config is structural (access, thresholds, enums, branding) — never the catalog or its prices.

### Story 1.5 — Custom Roles & Permissions (RBAC configuration)

**As an** admin, **I want to** create roles, assign feature-level permissions (CRUD + key actions),
and assign roles to users, **so that** I control who can do what without a developer changing code.

> **Scope decisions (PO, locked):**
> - **Extends** the model — `sales rep`, `owner`, `admin` ship as **built-in default roles**,
>   pre-seeded to match the RBAC matrix below. Admin can create *additional* custom roles.
> - Permissions = **CRUD + key domain actions** (not pure CRUD).
> - **Guardrails ON** — system blocks role configs that break locked anti-fraud / separation rules.
> - Supersedes the assumption that the 3 roles are hardcoded. **Prerequisite for Story 1.2.**

**Permissionable features & actions**

| Feature | Create | Read | Update | Delete | Extra actions |
|---|---|---|---|---|---|
| Subscriptions | ✅ | ✅ (own / all) | ✅ | ✅ (soft) | — |
| Payments | ✅ (record) | ✅ | ✅ | — | **Verify**, **Revert** |
| Products | ✅ | ✅ | ✅ | ✅ (deactivate) | — |
| Dashboard | — | ✅ | — | — | — |
| Users | ✅ | ✅ | ✅ | ✅ | **Assign role** |
| System Settings | — | ✅ | ✅ | — | — |
| Audit Log | — | ✅ | — | — | — |

`Read` on Subscriptions/Payments supports an **own-only vs all** scope (preserves "rep sees own, no amounts").

**Acceptance — create/edit a role**
- Admin opens a **Roles** screen; sees all roles (3 built-in + custom) with a permission summary.
- Admin creates a role with a unique name and toggles permissions per feature.
- Editing a custom role takes effect on affected users' **next action/login**, no redeploy.
- Built-in roles **cannot be deleted/renamed**; their protective permissions can't be edited to break guardrails.

**Acceptance — assign role to user**
- From the Users screen, admin assigns any role to a user by gmail.
- On next action, the user's effective permissions reflect the role — **server-enforced**, not UI-only.
- A user has exactly one role at a time.

**Acceptance — guardrails (enforced on save; reject with clear message)**
- **Separation of duties:** no single role holds both Subscription-Create/Update *and* Payment-Record/Verify.
- **No lockout:** reject any save leaving **zero active users** able to manage Users/Roles.
- ~~Verify ≠ self-record~~ — **dropped (PO):** a single owner must be able to record *and* verify
  their own payments. The `payments:verify` grant is the control; `verified_by` is still logged.

**Acceptance — data integrity (Sheets backend)**
- Roles+permissions persist to a new **ROLES** sheet; user→role to **USERS**; both reload after refresh/reopen.
- Every role create/edit/delete and assignment writes an **audit entry** (who, when, before→after).
- Blocked guardrail / failed save shows a **visible error** — nothing silent.
- Verified against the **real Sheets backend**, not mock data.

**Data delta:**
- new `ROLES` sheet → `role_id, name, is_builtin, permissions_json, created_by, created_at, active`
- `USERS.role` now references a `role_id` (built-in or custom)

**Out of scope:** per-user overrides, multiple roles per user, field-level perms beyond own/all read scope.

**Technical design:** see [apps-script/RBAC_DESIGN.md](apps-script/RBAC_DESIGN.md) (schema, API contracts, guardrails, risks).

---

## EPIC 2 — Subscription Management

| # | Story | Status | Notes vs current build |
|---|---|---|---|
| 2.1 | Rep/Owner create subscription | ✅ HAVE | Done. (Owner also has the "activate immediately" option we added.) |
| 2.2 | Rep/Owner see *their* created entries | ✅ HAVE | Rep sees own; owner sees all. |
| 2.3 | Rep/Owner **update their own** subscription | 🔧 CHANGE | Today subscriptions are **immutable for reps** (only owner edits). Epic wants reps to edit **their own**. Relaxes immutability. |
| 2.4 | Owner **delete** wrong entries | 🔧 CHANGE | Today we only soft-cancel (`is_active=false`). **Locked: soft-delete** via `is_deleted` flag — hidden everywhere, retained for audit. |

**Acceptance (2.3):**
- A rep can edit a subscription **they created**; cannot edit another rep's.
- Owner can edit any.
- Each edit writes an audit entry (who, when, before→after).

**Acceptance (2.4):**
- Owner clicks Delete → confirm → row is removed from all normal views.
- Deleted subscription no longer appears in lists, totals, or payment screens.
- Audit log keeps the record of the deletion.

---

## EPIC 3 — Payment Confirmation *(this REPLACES auto-billing + reconciliation)*

| # | Story | Status | Notes vs current build |
|---|---|---|---|
| 3.1 | **Owner** records a payment; group by week (default = current week) | 🔧 CHANGE | Decision B: **owner-only** (not reps). Today the system auto-generates a WEEKLY_BILLINGS row per active sub every Sunday. New model: **no auto-generation** — owner records a payment directly on a subscription and tags it to a **week group** (defaults to current week). |
| 3.2 | Owner transitions payment → **Verified** | ✅ HAVE | Done. |
| 3.3 | Owner modify / **revert** payment status | 🔧 CHANGE | We have Verified/Disputed/Refunded; **revert (e.g. Verified→Pending)** needs adding. |

**Acceptance (3.1):**
- From a subscription, the **owner** clicks "Record payment" (reps have no access to this action).
- Captures amount, method, reference, (optional) proof.
- The payment is tagged with a **week group**, prefilled to the current week (`YYYY-MM-WN`), editable.
- New payment starts as **Pending Verification**.

**Acceptance (3.3):**
- Owner can move a payment back to Pending (revert) or to Disputed/Refunded, with audit.

**Data delta:** `WEEKLY_BILLINGS` (auto-generated) is **retired**. `PAYMENTS` keeps a
`week_group` field. The week-numbering util we already wrote/tested stays — it just computes
the default week group instead of driving billing generation.

---

## EPIC 4 — Product Details

| # | Story | Status | Notes vs current build |
|---|---|---|---|
| 4.1 | Owner create/update/**delete** products used in subscriptions | 🔧 CHANGE | We have `PRICING_CONFIG` (meal plans) with create/update. **Rename concept to "Products"** and **add delete** (recommend: deactivate to protect historical references). |

**Acceptance (4.1):**
- Owner adds a product (name, price, active).
- Owner edits price/active.
- Owner can remove a product; a product referenced by existing subscriptions is **deactivated** (hidden from new subscriptions) rather than hard-deleted.

---

## EPIC 5 — Invoice ✅ BUILT

| # | Story | Status | Notes vs current build |
|---|---|---|---|
| 5.1 | Owner configures invoice branding + payment accounts | ✅ DONE | **Invoice Settings** screen (`/invoice-settings`, `invoices:configure`): business name, logo URL, phone, **starting invoice number**, and multiple payment accounts (method / account name / account number, add-remove rows). Stored in SETTINGS (`business_logo`, `business_phone`, `invoice_start_number`, `payment_accounts` JSON). Logo accepts a plain image URL **or a Google Drive share link** (auto-rewritten to the `drive.google.com/thumbnail?id=…` endpoint; file must be shared "Anyone with the link"). |
| 5.2 | Owner generates an invoice from a subscription | ✅ DONE | **Invoice** action on each subscription row → prefilled modal (description = product, qty, rate = product price; all editable + line note/date/notes) → `createInvoice` writes a numbered row to the new **INVOICES** sheet. Number = `max(invoice_start_number, highest existing + 1)`, so an owner can resume numbering from a previous generator (e.g. `INV-003222`). |
| 5.3 | Owner views / prints / exports a generated invoice | ✅ DONE | `/invoices` list + `/invoices/:id` printable document mirroring the reference layout (green header, totals, Payment Info). **Print / Save as PDF** via `window.print()` + print CSS, and **Download image (PNG)** via a dependency-free DOM→PNG rasterizer (`lib/exportImage.js`: clone + inline computed styles → SVG `foreignObject` → canvas). Default filename = `"<invoice#> - <customer>.png"`. Branding rendered live from settings. |
| 5.4 | Owner deletes an invoice | ✅ DONE | **Delete** action on the invoices list row and the invoice document (`invoices:delete`). **Soft delete** (`is_deleted` column), matching subscriptions/products: hidden from list + view, kept in the audit log, and the invoice number is **never reused** (numbering reads all rows incl. deleted). |

**Permission:** new `invoices` feature (`read` / `create` / `delete` / `configure`); granted to **owner** built-in. Mirrored in `web/src/config.js` + `apps-script/Config.gs`, so the Roles editor manages it automatically.

**Backend deploy note:** re-run `setupSheets` once to create/extend the `INVOICES` sheet — it now includes an `is_deleted` column (append it to the header row of an existing sheet manually, per the column-add rule). Settings keys are key/value rows — no migration needed.

**Deferred:** multi-line invoices (one editable line item per invoice today), logo *file upload* (URL / Drive link only, to respect Sheets cell limits), branding snapshot per invoice (rendered live).

---

## EPIC 6 — Dashboard

| # | Story | Status | Notes vs current build |
|---|---|---|---|
| 6.1 | Owner sees totals for subscriptions / payments | ✅ HAVE | Weekly Overview already shows totals; trim to match new model. |
| 6.2 | Owner sees unpaid customers / uncollected totals | ✅ HAVE | Reconciliation's "outstanding" list covers this; **keep this, drop the deposit cross-check**. |
| 6.3 | Owner sees all subscriptions + search by customer or product | ✅ HAVE | Search already supports name/plan; add product to the filter. |

---

## EPIC 7 — Customer Management ➕ NEW

> **Why:** Today customer details (`customer_name`, `customer_address`, `customer_phone`,
> `allergy_concerns`, `food_requests`) are **denormalized into every `SUBSCRIPTIONS` row** — a
> returning client is re-typed from scratch every time, and there is no way to see one client's
> history. This epic introduces **Customer** as a first-class record.

> **✅ Scope decisions (PO, locked):**
> - **Identity = manual customer ID.** No silent merge for live records. On the subscription form the
>   user explicitly **picks an existing client or creates a new one**; each client has an explicit `customer_id`.
> - **Only the customer name is required.** Address, phone, allergies and food requests are all
>   optional on both the customer record and the subscription.
> - **Backfill/dedup key = normalized customer name** (phone may be blank, so it can't be the key).
> - **Storage = hybrid master `CUSTOMERS` sheet**, auto-upserted from subscription activity + a
>   **one-time backfill** of existing subscriptions.
> - **Directory screen = owner-only.** Reps do **not** get the browse/manage screen — but they **do**
>   get the **customer picker/autofill on the New Subscription form** (lookup-only).
> - **Rep lookup spans all customers** (returns contact fields only) so manual selection actually
>   dedups across reps. Accepted privacy trade-off for a small shared-client business.
> - Editing a client's **master contact record is owner-only**; reps attach/create from the form only.

| # | Story | Status | Notes |
|---|---|---|---|
| 7.1 | Saved customer record + lookup/autofill on the subscription form | ➕ NEW | New `CUSTOMERS` sheet; `SUBSCRIPTIONS` gains a `customer_id` FK. Picker prefills contact fields. |
| 7.2 | Owner-only **Customers** screen: directory + per-client subscription (and payment) history | ➕ NEW | New owner route + page. Joins `SUBSCRIPTIONS`/`PAYMENTS` on `customer_id`. |

### Story 7.1 — Saved customer + autofill

**As a** rep/owner, **I want to** look up and attach an existing client (or create a new one) when
creating a subscription, **so that** their saved details prefill and I don't re-type returning clients.

**Acceptance — lookup & attach**
- The New Subscription form has a **customer picker** that searches existing clients by name/phone/id.
- Selecting a client **prefills** name, address, phone, allergies, food requests; the subscription is
  linked to that `customer_id`.
- Choosing **"New client"** generates a new `customer_id` and creates a `CUSTOMERS` record on save.
- The picker is available to **rep and owner**; returns contact fields only (no payment data).

**Acceptance — data integrity (Sheets backend)**
- New `CUSTOMERS` row persists and reloads after refresh/reopen; the subscription stores `customer_id`.
- Creating/editing a subscription keeps the linked customer record consistent (no separate data entry).
- A **one-time backfill** creates a `CUSTOMERS` record per distinct existing client (best-effort dedup
  by **normalized name**; oldest sub's details win, owner can correct) and stamps `customer_id` onto existing subs.
- Errors are **visible** — nothing fails silently. Verified against the **real Sheets backend**, not mock.

### Story 7.2 — Owner Customers screen (directory + history)

**As an** owner, **I want** a Customers screen listing all clients with each client's full history,
**so that** I can pull a returning client's details and see everything they've subscribed to.

**Acceptance**
- Owner opens a **Customers** screen: searchable list (name/phone), shows client count.
- Opening a client shows **contact details** + **subscription history** (all subs incl. inactive:
  product, quantity, start date, status) + **payment history** (week group, amount, status).
- Owner can **edit** the client's master contact record; edits persist and reload.
- Screen is **owner-only** (server-enforced); reps cannot open it or call its actions.
- Same data-integrity checklist as 7.1 (persists, reloads, visible errors, real backend).

**Out of scope (this epic):** merging two existing client records, customer-facing portal,
loyalty/preferred-delivery fields (schema leaves room; no UI now), rep-visible directory.

**Data delta:**
- new `CUSTOMERS` sheet → `customer_id, customer_name, customer_address, customer_phone,
  allergy_concerns, food_requests, created_by, created_at, updated_at, is_deleted`
- `SUBSCRIPTIONS` gains `customer_id` (FK → CUSTOMERS)
- new permissionable feature **`customers`** (see RBAC summary). Key action: **lookup** (form picker,
  rep+owner) distinct from directory **read** (owner). Add to the `PERMISSIONS` catalog in
  `Config.gs` + `web/src/config.js`.

**Technical design (resolved — Solutions Architect):**
- **New `CUSTOMERS` sheet** (`apps-script/Customers.gs`): `customer_id, customer_name,
  customer_address, customer_phone, allergy_concerns, food_requests, created_by, created_at,
  updated_at, is_deleted`. `customer_id` format `CUST-YYYYMMDD-NNN`.
- **`SUBSCRIPTIONS.customer_id`** appended as the LAST column (so adding it to the existing
  sheet leaves columns 1–14 aligned). Denormalized customer fields **stay on subscriptions** as a
  point-in-time **snapshot** of the contact used for that order; editing the master record does
  **not** rewrite historical subscriptions.
- **Creation:** folded into `createSubscription` — link an existing `customer_id` (picker) or, when
  none is supplied, create a new master record (`customers:create`). Manual id, no silent
  merge-by-phone.
- **Backfill:** `backfillCustomers()` in `Customers.gs` — run once from the editor. Idempotent;
  groups subs without a `customer_id` by **normalized name**, oldest sub seeds each record.
- **Required fields:** only `customer_name`. Address/phone/allergies/food requests are optional
  (`createSubscription` validates name + product + quantity + start_date only).
- **API:** `lookupCustomers` (rep+owner, contact-only), `listCustomers` / `getCustomer` /
  `updateCustomer` (owner). Registered in `Code.gs`; mirrored in `web/src/api/mockAdapter.js`.
- **Permission encoding:** flat `customers:{create|read|update|lookup}` (no own/all scope).
- **Frontend:** owner pages `web/src/pages/customers/CustomersList.jsx` + `CustomerDetail.jsx`
  (routes `/customers`, `/customers/:customerId`); picker/autofill added to `NewSubscription.jsx`.

> ⚠️ **Deploy note (real Sheets backend):** `customer_id` is a new column — Apps Script does not
> auto-add columns to populated sheets. Run `setupSheets` (creates the `CUSTOMERS` sheet + the new
> header cell) then `backfillCustomers()` once, and redeploy as a **New Version**.

---

## What we DROP for this MVP ➖
- **Invoice (Epic 5)** — built (settings + generate from subscription + printable doc).
- **Auto weekly-billing generation** (`Triggers.gs`, Sunday trigger) — replaced by on-record week grouping (3.1).
- **Heavy reconciliation** (system-vs-bank-deposit cross-check, payment-method distribution report).
- **Rep performance / verification-rate report** — depended on the auto-billing model; revisit later.
- **Monthly summary report** — defer; dashboard totals cover the early-stage need.

---

## RBAC summary (resolved — Model B)

> **As of Story 1.5 this matrix is the seed definition of the 3 built-in roles.** Roles are now
> data-driven; admin may add custom roles on top, within the guardrails defined in Story 1.5.

| Capability | Sales Rep | Owner | Admin |
|---|---|---|---|
| Sign in by email | ✅ | ✅ | ✅ |
| Create subscription | ✅ | ✅ | ❌ |
| View subscriptions | own only, no amounts | all | ❌ |
| Look up / attach customer (form picker) | ✅ *(lookup-only)* | ✅ | ❌ |
| Create customer (from subscription form) | ✅ | ✅ | ❌ |
| Customers directory + edit master record | ❌ | ✅ | ❌ |
| Edit subscription | **own only** | all | ❌ |
| Delete (soft) subscription | ❌ | ✅ | ❌ |
| Record payment | ❌ | ✅ | ❌ |
| Verify / revert payment | ❌ | ✅ | ❌ |
| View products (read-only, incl. price) | ✅ *(pricing reference)* | ✅ | ❌ |
| Products create / update / delete | ❌ | ✅ | ❌ |
| Dashboard / totals | ❌ | ✅ | ❌ |
| Manage user roles | ❌ | ❌ | ✅ |
| Manage system config | ❌ | ❌ | ✅ |
| View audit log | ❌ | ✅ | ✅ |

*Admin manages access + system behavior only — never subscriptions/payments/products/financials.
Owner owns all business & money flows. The two roles are deliberately non-overlapping.*
