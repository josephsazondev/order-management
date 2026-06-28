# Deploying the OrderFlow Apps Script backend

This backend runs as a Google Apps Script **web app** backed by a Google Sheet. The React
frontend (`../web`) talks to it over HTTPS. You can develop the UI entirely in **mock mode**
first (no deployment needed) — come here when you're ready to use a real Google Sheet.

## 1. Create the Google Sheet

1. Go to <https://sheets.google.com> and create a blank spreadsheet (e.g. "OrderFlow DB").
2. Copy its **ID** from the URL: `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`.

## 2. Add the script

**Option A — container-bound (simplest):**
In the sheet, choose **Extensions → Apps Script**. This script is already attached to the sheet,
so you can leave `CONFIG.SPREADSHEET_ID = ''`. Running `setupSheets` (step 4) from the editor
records the parent sheet's ID in Script Properties, so the deployed web app keeps using this same
sheet — `getActiveSpreadsheet()` returns `null` in the web-app context, so that one-time capture is
what lets it run on its own parent sheet without a hardcoded ID.

**Option B — standalone + clasp:**
Create a standalone project at <https://script.google.com>, or use
[`clasp`](https://github.com/google/clasp): `clasp create --type standalone`, then
`clasp push` this folder. Set `CONFIG.SPREADSHEET_ID` to the sheet ID from step 1.

Either way, copy the contents of every `.gs` file in this folder into the editor (and paste
`appsscript.json` via **Project Settings → "Show appsscript.json"**).

## 3. Configure `Config.gs`

Roles now live in the **USERS sheet** (managed in-app by an admin). The only thing hardcoded is
the **bootstrap admin** — the first person who can sign in to assign everyone else. Set it to your
own email, and **keep it in sync with `web/src/config.js` (`ADMIN_BOOTSTRAP_EMAILS`)**:

```js
ADMIN_BOOTSTRAP_EMAILS: ['you@yourdomain.com'],
```

If you used Option B, also set `SPREADSHEET_ID`.

## 4. Initialize the sheets

In the editor, select **`setupSheets`** from the dropdown and click **Run**. Authorize when
prompted. This creates all sheets (USERS, SETTINGS, PRODUCTS, SUBSCRIPTIONS, PAYMENTS, AUDIT_LOG),
seeds default settings + products, and seeds your bootstrap admin into USERS.
(Optional: run `seedDemoData` once to add a demo owner, reps, and sample subscriptions.)

Then sign in as the bootstrap admin and use the **Users** screen to add your owner and reps by gmail.

## 5. Deploy as a web app

1. **Deploy → New deployment → Type: Web app**.
2. **Execute as: _User accessing the web app_** — this is important: it makes
   `Session.getActiveUser().getEmail()` return the *signed-in user's* email, which is how roles
   are enforced. Do **not** choose "Me".
3. **Who has access: _Anyone with Google account_** (or "Anyone within <your domain>").
4. Deploy and copy the **Web app URL** (ends in `/exec`).

> Each user signs in with their own Google account; the backend maps that email to a role via
> the allowlist. An email not in the allowlist is rejected.

## 6. Point the frontend at it

In `web/`, copy `.env.example` to `.env` and set:

```
VITE_API_MODE=appsscript
VITE_APPSCRIPT_URL=https://script.google.com/macros/s/AKfycb..../exec
```

Then `npm run dev` (or `npm run build` for a GitHub Pages deploy). Sign in with an allowlisted
Google account.

### CORS note
The frontend POSTs JSON with `Content-Type: text/plain` on purpose — this is a "simple" request,
so the browser sends **no preflight `OPTIONS`** (which Apps Script web apps can't answer). The
backend reads the body from `e.postData.contents`. Don't switch it to `application/json`.

## Proof-of-payment files
For the MVP, `proof_of_payment` stores a URL/reference string (e.g. a Google Drive share link).
To accept uploads directly, add a Drive step in `createPayment_`: decode a base64 payload with
`Utilities.base64Decode`, `DriveApp.getFolderById(FOLDER).createFile(blob)`, and store
`file.getUrl()`. Left out of the MVP to keep scope bounded.

## Security model recap
- Roles are derived from the Google session **server-side** (USERS sheet + bootstrap admin) — never from client input.
- Authorization is **permission-based** (Story 1.5): each user's `role_id` resolves to a grant set
  in the ROLES sheet, and handlers call `requirePermission_(user, feature, action)` /
  `hasScope_(user, feature, 'all'|'own')`. The three built-in roles (admin/owner/sales_rep) are
  seeded rows whose grants match the RBAC matrix. Admin can add custom roles within the guardrails.
- Rep (own-scope) responses are field-stripped in the backend (`repSubscriptionView_`): own-scope
  users never receive prices, amounts, payments, internal notes, or other users' rows.
- Mutations enforce the matching permission before touching data; list handlers for subscriptions
  and payments filter by `created_by`/`recorded_by` when the user lacks the `read:all` scope.
- `AUDIT_LOG` is append-only; every mutating action writes a row.
