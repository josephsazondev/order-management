# OrderFlow: Master Prompt for Claude Code

Copy and paste this entire prompt into Claude Code to start building the system.

---

## PROJECT BRIEF

Build **OrderFlow**, a dual-role web application for managing weekly meal plan subscriptions with fraud prevention. The app separates Sales Rep (order entry) from Owner (payment verification) to prevent reps from pocketing payments.

**Business Model:** Customers subscribe to weekly meal plans (recurring, not one-time). Each subscription auto-generates weekly billings. Owner verifies payments independently.

**Key Constraint:** Sales reps NEVER see pricing, payments, or amounts. Only owner can verify payments.

---

## CORE REQUIREMENTS

### 1. User Roles & Access Control

**SALES REP Role:**
- Can CREATE subscriptions from FB Messenger inquiries
- Can VIEW only their own subscriptions
- Can VIEW: customer name, address, phone, meal plan, quantity, allergies, food requests, start date, status
- CANNOT view: pricing, amounts, payment status, other reps' customers, financial data
- CANNOT edit, delete, or verify payments

**OWNER Role:**
- Can VIEW and MANAGE all subscriptions
- Can VERIFY payments independently (sales rep cannot)
- Can RUN financial reports and reconciliation
- Can CONFIGURE meal plan pricing
- Can VIEW audit log

### 2. Customer Data Collection

Sales rep gathers these fields from customer (via FB Messenger):
```
- Name (text)
- Address (text)
- Contact Number (text)
- Meal Plan (dropdown: Keto Plan, Standard Plan, Protein+ Plan)
- Quantity (number)
- Allergy Concerns (text)
- Food Requests (text)
```

### 3. Data Model

**SUBSCRIPTIONS Sheet:**
- subscription_id (auto: SUB-20250616-001)
- customer_name, address, phone
- meal_plan (enum), quantity
- allergy_concerns, food_requests
- start_date (YYYY-MM-DD)
- is_active (boolean)
- created_by (sales_rep_id), created_at (timestamp)
- internal_notes (owner only)
- **IMMUTABLE AFTER CREATION** (rep cannot edit/delete)

**WEEKLY_BILLINGS Sheet:**
- billing_id (auto: BILL-2025-W1-001)
- subscription_id (FK)
- billing_week (format: 2025-07-W1)
- billing_month (format: 2025-07)
- week_start_date, week_end_date (dates)
- amount_php (auto-calculated from PRICING_CONFIG × quantity)
- status (enum: Pending Payment, Verified, Overdue, Cancelled)
- customer_name, meal_plan, created_by
- created_at (timestamp)
- **Auto-generated every Sunday for all active subscriptions**

**PAYMENTS Sheet:**
- payment_id (auto: PAY-2025-W1-001)
- billing_id (FK), subscription_id (FK)
- amount_php, payment_method (enum: GCash, Bank Transfer, COD, Card)
- customer_reference (GCash ref, bank slip #, etc.)
- proof_of_payment (file path)
- recorded_date, verified_by (owner email), verified_at (timestamp)
- status (enum: Pending Verification, Verified, Disputed, Refunded)
- **OWNER ONLY** (sales rep has zero access)

**PRICING_CONFIG Sheet:**
- meal_plan_name (primary key)
- price_per_week (currency)
- num_days (usually 7)
- active (boolean)
- **OWNER ONLY** (hidden from sales rep)

**AUDIT_LOG Sheet:**
- log_id (auto-increment)
- timestamp, user_id, user_role, action, record_id, details
- **Append-only** (immutable for fraud detection)

### 4. Week Numbering Format

**Rule:** When a week spans two months, use the NEW MONTH.

Format: `YYYY-MM-WN`
- YYYY = year
- MM = month that the week ENDS in
- WN = week number within that month (W1, W2, W3, W4)

Examples:
- Week June 29 - July 5 → `2025-07-W1` (ends in July)
- Week July 28 - Aug 3 → `2025-08-W1` (ends in August)

### 5. Workflows

**Workflow A: Subscription Creation (Sales Rep)**
1. Rep opens form and enters customer details + meal plan
2. System generates subscription_id (SUB-20250616-001)
3. Rep provides ID to customer
4. Rep does NOT see pricing

**Workflow B: Weekly Billing (Automated)**
1. Every Sunday at 11 PM (or manual trigger):
   - For each active subscription, create WEEKLY_BILLINGS record
   - amount_php = PRICING_CONFIG[meal_plan].price_per_week × quantity
   - Status = "Pending Payment"
2. Owner reviews unpaid billings from last week

**Workflow C: Payment Verification (Owner)**
1. Customer sends payment proof (GCash screenshot, bank slip)
2. Owner creates PAYMENT record:
   - Enters amount, payment_method, customer_reference, proof
   - Verifies against actual bank/GCash deposits
3. Owner marks PAYMENT status = "Verified"
4. System updates WEEKLY_BILLINGS status = "Verified"

**Workflow D: Weekly Reconciliation (Owner)**
1. Every Monday morning:
   - Verify auto-generated billings (no duplicates)
   - Cross-check verified payments against actual deposits
   - Identify unpaid billings (send reminders after 3 days)
   - Check rep performance (low verification rates = flag)
   - Export verified billings to fulfillment team

**Workflow E: Subscription Cancellation (Owner)**
1. Owner marks is_active = FALSE
2. System stops generating billings after current week
3. Audit log records cancellation

### 6. Dashboards & Views

**Sales Rep Dashboard:**
- List of own subscriptions (no amounts shown)
- Subscription count
- Status: Active/Inactive
- Filter by date

**Owner - Weekly Overview (e.g., 2025-07-W1):**
- Active subscriptions count & revenue by meal plan
- Total due, verified payments, pending, overdue
- Collection rate (%)
- [RECONCILE] [EXPORT TO KITCHEN] [SEND REMINDERS] buttons

**Owner - Weekly Billings Detail:**
- Table: billing_id, customer_name, meal_plan, amount, status, rep
- Filter by: status, rep, meal_plan
- [PAY] [VERIFY] buttons

**Owner - Payment Reconciliation:**
- Total billings vs total verified payments
- Actual deposits (GCash, bank) vs system records
- Flag discrepancies
- Pending customer follow-ups
- Rep performance (orders created vs verified payments)

**Owner - Monthly Summary:**
- Total billings & verified payments
- Revenue by meal plan
- Revenue by rep
- Subscription health (active, new, cancelled, churn rate)

### 7. Anti-Fraud Controls

**Scenario 1:** Rep pockets cash, doesn't record
- **Detection:** Subscription doesn't exist in system; customer has no record
- **Prevention:** Timestamp subscription creation; if customer claims enrolled, fraud is evident

**Scenario 2:** Rep creates fake subscription
- **Detection:** Fulfillment team rejects invalid address/allergies; billing has no payment
- **Prevention:** Kitchen validates customer details before prepping

**Scenario 3:** Rep edits subscription after creation
- **Detection:** Immutable record prevents edits; audit log shows creator
- **Prevention:** Only owner can edit (special form with audit trail)

**Scenario 4:** Rep claims payment verified but customer didn't pay
- **Detection:** Rep has zero access to PAYMENTS sheet; owner verifies manually
- **Prevention:** Only owner can verify payments against actual deposits

**Scenario 5:** Rep records partial payment or wrong amount
- **Detection:** Amount auto-calculated by system; bank reconciliation catches mismatches
- **Prevention:** Owner enters payment amount based on billing; rep cannot touch amounts

**Scenario 6:** Rep gives wrong address
- **Detection:** Owner verifies before confirming; fulfillment team validates
- **Prevention:** Address is immutable after creation (unless owner edits with audit trail)

### 8. Success Metrics

- **Payment Collection Rate:** 95%+ verified within 3 days
- **Rep Accuracy:** Subscriptions created = billings generated = payments verified
- **Zero Fraud:** No discrepancies between billings and verified payments
- **Customer Retention:** Track weekly subscription renewals
- **Rep Compensation:** Tied to verified payments, not claimed orders

---

## TECHNICAL STACK

- **Frontend:** React 18 (simple, no external UI libraries, mobile-responsive)
- **Backend:** Google Apps Script (serverless)
- **Database:** Google Sheets (with proper schema)
- **Auth:** Google Sign-In (owner & rep @gmail)
- **Hosting:** GitHub Pages (frontend) + Apps Script (backend)
- **Local State:** localStorage for UI preferences only

---

## DEVELOPMENT PHASES

### Phase 1 (MVP)
- [ ] Sales rep subscription creation form
- [ ] Subscription list (own only)
- [ ] Owner subscription approval workflow
- [ ] Manual weekly billing generation
- [ ] Owner payment verification form
- [ ] Basic weekly reconciliation dashboard

### Phase 2
- [ ] Auto-weekly billing generation (Sunday trigger)
- [ ] Monthly summary reports
- [ ] Sales rep performance metrics
- [ ] Advanced filtering

### Phase 3 (Future)
- [ ] FB Messenger integration
- [ ] GCash API auto-confirmation
- [ ] Email/SMS reminders

---

## IMPLEMENTATION PRIORITY

1. **FIRST:** Sales rep can create subscriptions + owner can view all subscriptions
2. **SECOND:** Owner can configure pricing + system generates weekly billings
3. **THIRD:** Owner payment verification form + payment status tracking
4. **FOURTH:** Weekly reconciliation dashboard with bank deposit cross-check
5. **FIFTH:** Reports and analytics

---

## IMPORTANT RULES

1. **Data Immutability:** Once sales rep creates subscription, only owner can modify (rep cannot edit/delete)
2. **Payment Access:** Sales rep has ZERO visibility into PAYMENTS sheet
3. **Amount Hiding:** Sales rep never sees pricing or total amounts
4. **Audit Trail:** Every action logged with user, timestamp, before/after values
5. **Week Format:** Always use YYYY-MM-WN (month is where week ENDS, not starts)
6. **Bank Reconciliation:** Owner must verify each payment against actual deposits
7. **Auto-Generation:** Weekly billings generated automatically every Sunday (no manual entry by rep)
8. **Rep Performance:** Track % of billings with verified payments (expose low performers)

---

## REFERENCE DOCUMENTS

See attached:
- `SYSTEM_SPEC.md` - Full system specification, workflows, dashboards, reports
- `DATA_SCHEMA.md` - Detailed Google Sheets structure, column definitions, relationships

---

## START BUILDING

Build the frontend (React) and backend (Apps Script) based on these requirements.

Key questions to resolve as you build:
1. How will you handle auto-weekly billing generation? (Google Apps Script time-based trigger? Or manual owner button?)
2. How will you store files (proof_of_payment)? (Google Drive folder? Base64 in sheet?)
3. How will you implement week calculation logic? (What programming language/library?)
4. How will you secure the Google Sheets connection? (OAuth for owner account only)
5. How will you prevent sales rep from accessing PAYMENTS sheet? (Backend validation)

Build iteratively:
- Get Phase 1 working first
- Test role-based access control extensively
- Verify audit logging works
- Then add Phase 2 features

Good luck! 🚀
