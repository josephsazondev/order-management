# OrderFlow — Getting Started

Dual-role weekly meal-plan subscription manager with built-in fraud prevention.
Spec lives in [`SYSTEM_SPEC.md`](SYSTEM_SPEC.md) and [`DATA_SCHEMA.md`](DATA_SCHEMA.md).

This repo has two parts:

| Folder | What it is |
|---|---|
| [`web/`](web) | React 18 + Vite frontend (no UI libraries, mobile-responsive). |
| [`apps-script/`](apps-script) | Google Apps Script + Google Sheets backend you deploy. See [`apps-script/DEPLOY.md`](apps-script/DEPLOY.md). |

The frontend has two backends behind one flag (`VITE_API_MODE`):
- **`mock`** (default) — an in-browser adapter with seeded data in `localStorage`. Runs instantly, no Google account needed. Great for trying the app and testing role-based access.
- **`appsscript`** — the live Google backend (set `VITE_APPSCRIPT_URL`).

## Run locally (mock mode)

```bash
cd web
npm install
npm run dev
```

Open the printed URL. On the login screen (mock mode) you can click a demo account:

| Account | Role | Sees |
|---|---|---|
| `admin@ketolab.com` | Admin | Users & roles, system settings, audit log. **No** business/financial data. |
| `owner@ketolab.com` | Owner | Subscriptions, payments, products, dashboard, audit log. |
| `maria@ketolab.com` / `carlos@…` | Sales Rep | Only their own subscriptions (create + edit) — **no pricing, amounts, or payments**. |

Admin/Owner → **Reset demo data** (sidebar) restores the seed dataset at any time.
The feature backlog driving this build is [`BACKLOG.md`](BACKLOG.md) (derived from [`EPICS.md`](EPICS.md)).

## Three roles, deliberately non-overlapping

- **Admin** — controls *who can access* (assign roles by email) and *how the system behaves*
  (overdue threshold, payment methods, branding). Never touches subscriptions, payments, or products.
- **Owner** — runs the business: subscriptions, recording & verifying payments, the product
  catalog/prices, and the collection dashboard.
- **Sales Rep** — creates and edits *their own* subscriptions only.

## Security model (it's real, not cosmetic)

- The user's **role is resolved on the backend** from their identity (the USERS store + a bootstrap
  admin), never from client input. In production Apps Script reads `Session.getActiveUser().getEmail()`.
- **Rep responses are field-stripped server-side** — the backend never sends a rep any pricing,
  amount, payment, internal-note, or other-rep data. Hiding columns in React is not what protects it.
- Recording/verifying payments and managing products are **owner-only**; managing users/settings is
  **admin-only** — all enforced server-side before touching data.
- `AUDIT_LOG` is append-only; every mutating action writes an entry.

## How billing works now

There is **no auto-generated billing**. Active subscriptions are simply *expected to pay each week*.
The owner records a payment against a subscription, tagged to a **week group** (defaults to the
current week, `YYYY-MM-WN`); the dashboard compares expected vs. collected per week and lists who's
unpaid. Amounts are derived from the product price × quantity — never hand-entered.

## Week numbering

A week is Sun–Sat and is labelled by the month its **Saturday** falls in: `YYYY-MM-WN`
(e.g. the week of Jun 29–Jul 5 2025 is `2025-07-W1`). This is the default **week group** for
payments. Logic lives in [`web/src/lib/week.js`](web/src/lib/week.js) and is mirrored in
[`apps-script/WeekUtils.gs`](apps-script/WeekUtils.gs).

Verify it against the spec examples:

```bash
node scripts/check-week.mjs
```

## Deploy

- **Backend:** follow [`apps-script/DEPLOY.md`](apps-script/DEPLOY.md).
- **Frontend (GitHub Pages):** `cd web && VITE_BASE=/<repo>/ npm run build`, then publish `web/dist`.
  Set `VITE_API_MODE=appsscript` and `VITE_APPSCRIPT_URL` in `web/.env` first.

## Scope

Built per [`BACKLOG.md`](BACKLOG.md): Epic 1 (admin: users/roles + system settings), Epic 2
(subscriptions — rep edit-own, owner soft-delete), Epic 3 (owner records/verifies/reverts payments
by week group), Epic 4 (products — create/update/deactivate), Epic 6 (dashboard + search).
**Deferred:** Epic 5 (invoicing). **Dropped:** auto-billing trigger, heavy reconciliation,
rep-performance/monthly reports, and Phase 3 integrations (FB Messenger, GCash API, SMS).
