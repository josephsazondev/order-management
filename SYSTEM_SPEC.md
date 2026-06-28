# OrderFlow: Weekly Meal Plan Subscription Management System

## Executive Summary

OrderFlow is a dual-role web application for managing weekly meal plan subscriptions with built-in fraud prevention. It separates the Sales Rep role (order entry) from the Owner role (payment verification and reconciliation) to prevent dishonest reps from pocketing payments or manipulating records.

**Key Business Model:** Customers subscribe to weekly meal plans (recurring, not one-time). Each subscription generates automatic weekly billing. Owner verifies payments independently from order entry.

---

## System Overview

### Core Principles
1. **Immutable Records** — Sales rep cannot edit/delete orders after creation
2. **Strict Role Separation** — Sales rep never sees amounts, payments, or financial data
3. **Independent Payment Verification** — Owner verifies all payments against bank deposits
4. **Weekly Aggregation** — All data grouped by week using format `YYYY-MM-WN` (year-month-week)
5. **Audit Trail** — Every action logged with timestamp and user ID for fraud detection

### Users & Roles

| Role | Primary Task | Access Level |
|------|--------------|--------------|
| **Sales Rep** | Enter customer details & create subscriptions via FB Messenger inquiries | View own subscriptions only, no pricing data |
| **Owner** | Verify payments, reconcile weekly billings, manage customers, generate reports | Full system access |

---

## Customer Data Collection

When a customer inquires (via FB Messenger), Sales Rep gathers:
- **Name** (text)
- **Address** (text)
- **Contact Number** (text)
- **Meal Plan** (dropdown: Keto Plan, Standard Plan, Protein+ Plan)
- **Quantity** (number)
- **Allergy Concerns** (text - long form)
- **Food Requests** (text - long form)

---

## Data Model

### SUBSCRIPTIONS Sheet
Core recurring subscription records (immutable after creation)

```
subscription_id          TEXT (auto: SUB-20250616-001)
customer_name            TEXT
customer_address         TEXT
customer_phone           TEXT
allergy_concerns         TEXT
food_requests            TEXT
meal_plan                TEXT (enum: Keto Plan, Standard Plan, Protein+ Plan)
quantity                 NUMBER
start_date               DATE (YYYY-MM-DD)
is_active                BOOLEAN
created_by               TEXT (sales_rep_user_id)
created_at               TIMESTAMP (YYYY-MM-DD HH:MM:SS)
internal_notes           TEXT (owner only)
```

**Immutability:** Sales rep CAN create, CANNOT edit or delete. Only owner can modify.

---

### WEEKLY_BILLINGS Sheet
Auto-generated weekly charges for all active subscriptions

```
billing_id               TEXT (auto: BILL-2025-W25-001)
subscription_id          TEXT (FK to SUBSCRIPTIONS)
billing_week             TEXT (format: 2025-07-W1, 2025-07-W2, etc.)
billing_month            TEXT (format: 2025-07 - the month the week ends in)
week_start_date          DATE (YYYY-MM-DD)
week_end_date            DATE (YYYY-MM-DD)
amount_php               CURRENCY (auto-calculated from pricing)
status                   TEXT (enum: Pending Payment, Verified, Overdue, Cancelled)
customer_name            TEXT (denormalized)
created_by               TEXT (which rep generated)
created_at               TIMESTAMP
```

**Auto-Generation:** Every Sunday (or manually triggered), system creates new weekly_billings for all active subscriptions if not already created.

---

### PAYMENTS Sheet
Payment records linked to weekly billings (independent from order entry)

```
payment_id               TEXT (auto: PAY-2025-W25-001)
billing_id               TEXT (FK to WEEKLY_BILLINGS)
subscription_id          TEXT (FK to SUBSCRIPTIONS)
amount_php               CURRENCY
payment_method           TEXT (enum: GCash, Bank Transfer, COD, Card)
customer_reference       TEXT (GCash ref, bank slip number, etc.)
proof_of_payment         TEXT (file/photo link)
recorded_date            DATE (YYYY-MM-DD)
verified_by              TEXT (owner_user_id - required for verification)
verified_at              TIMESTAMP
status                   TEXT (enum: Pending Verification, Verified, Disputed, Refunded)
```

**Payment Verification:** ONLY owner can create/verify payments. Sales rep cannot access.

---

### PRICING_CONFIG Sheet
Owner manages meal plan pricing (hidden from sales rep)

```
meal_plan_name           TEXT (Keto Plan, Standard Plan, Protein+ Plan)
price_per_week           CURRENCY
num_days                 NUMBER (7)
active                   BOOLEAN
```

---

### AUDIT_LOG Sheet
Immutable log of all actions for fraud detection

```
log_id                   NUMBER (auto-increment)
timestamp                TIMESTAMP (YYYY-MM-DD HH:MM:SS)
user_id                  TEXT
user_role                TEXT (enum: sales_rep, owner)
action                   TEXT (e.g., "Created Subscription", "Verified Payment", "Marked Cancelled")
record_id                TEXT (SUB-xxx or BILL-xxx or PAY-xxx)
details                  TEXT (what changed, previous vs new value)
ip_address               TEXT (optional)
```

---

## Week Numbering Format

**Rule:** When a week spans two months, use the NEW MONTH.

Examples:
- Week June 30 - July 6 → `2025-07-W1` (July is the new month)
- Week July 28 - August 3 → `2025-08-W1` (August is the new month)
- Week July 7 - July 13 → `2025-07-W2` (same month)

Format: `YYYY-MM-WN`
- YYYY = year
- MM = month (the month that the week ends in, or is primarily in)
- WN = week number within that month (W1, W2, W3, W4, W5)

---

## Workflows

### Workflow 1: Customer Onboarding (Sales Rep)

```
1. Customer inquires on FB Messenger
2. Sales Rep opens OrderFlow dashboard
3. Rep clicks "New Subscription"
4. Rep enters:
   - Customer name, address, phone
   - Meal plan, quantity
   - Allergies, food requests
   - Start date
5. Rep submits → Subscription created (SUB-20250616-001)
6. Rep provides customer with subscription reference ID
7. Rep does NOT see pricing or payment amounts
```

**What Sales Rep Sees:**
- Subscription ID
- Customer name, address, phone
- Meal plan, quantity
- Allergy/food requests
- Start date
- Status: Active/Inactive

**What Sales Rep CANNOT See:**
- ❌ Price: ₱3,500
- ❌ Payment status
- ❌ Payment method
- ❌ Other reps' subscriptions
- ❌ Edit/Delete buttons
- ❌ Financial data

---

### Workflow 2: Owner Subscription Activation

```
1. Owner receives notification of new subscription
2. Owner reviews subscription details
3. Owner verifies customer information is complete
4. Owner adds internal notes if needed
5. Owner marks subscription as "Active"
6. System auto-generates first weekly billing
```

---

### Workflow 3: Auto-Weekly Billing Generation

**Trigger:** Every Sunday night at 11 PM (or manual trigger by owner)

```
1. System finds all subscriptions with is_active = TRUE
2. For each subscription:
   a. Check if WEEKLY_BILLINGS already exists for this week
   b. If NOT: Create new WEEKLY_BILLINGS record
      - billing_week: 2025-07-W1
      - amount_php: auto-calculated from PRICING_CONFIG
      - status: Pending Payment
   c. If YES: Skip (prevent duplicates)
3. Owner receives notification: "X weekly billings generated"
4. Owner reviews unpaid billings from previous week
5. Owner sends payment reminders to customers with "Pending" status
```

---

### Workflow 4: Payment Collection & Verification (Owner)

```
1. Customer sends payment proof (GCash screenshot, bank slip, etc.)
2. Owner creates PAYMENT record:
   - Links to billing_id (e.g., BILL-2025-W1-001)
   - Links to subscription_id
   - Enters payment_method
   - Uploads proof_of_payment
   - Enters customer_reference (GCash ref, bank slip #)
3. Owner verifies payment is legitimate:
   - Checks customer_reference against GCash/bank deposits
   - Confirms amount matches billing_id amount
4. Owner marks PAYMENT status: "Verified"
5. System updates linked WEEKLY_BILLINGS status: "Verified"
```

**Why separate from order entry:**
- Rep can't claim payment was received when it wasn't
- Bank reconciliation catches missing payments
- Audit trail shows who verified what payment

---

### Workflow 5: Weekly Reconciliation (Owner)

**Timing:** Every Monday morning

```
1. CHECK AUTO-GENERATED BILLINGS
   - System should have created X billings for active subscriptions
   - Verify no duplicates exist

2. VERIFY PAYMENTS AGAINST DEPOSITS
   - Total verified payments: ₱142,800
   - Actual GCash received: ₱142,900 (check account)
   - Actual bank deposits: ₱42,000 (check bank app)
   - Flag discrepancies: ₱142,900 - ₱142,800 = ₱100 mismatch

3. IDENTIFY UNPAID BILLINGS
   - Billings with status "Pending Payment" from last week
   - Send payment reminders to customers
   - Mark as "Overdue" if unpaid after 3 days

4. CHECK REP PERFORMANCE
   - Rep A: 15 subscriptions, 15 verified payments (100%)
   - Rep B: 12 subscriptions, 10 verified payments (83%) ← investigate
   - Are rep-verified payments matching actual deposits?

5. EXPORT TO FULFILLMENT
   - Export all "Verified" billings for current week
   - Include: customer name, address, allergies, meal plans, quantities
   - Send to kitchen/fulfillment team
   - Delivery team marks as "Delivered" after completing delivery
```

---

### Workflow 6: Subscription Cancellation

```
1. Customer requests cancellation (to rep or owner)
2. Owner marks subscription:
   - is_active = FALSE
   - Adds cancellation date in internal_notes
3. System stops generating weekly_billings after current week
4. Audit log records: "Subscription cancelled by [owner], reason: [text]"
5. Rep cannot see cancelled subscriptions (filtered out of their view)
```

---

## Role-Based Access Control

### SALES REP Permissions

| Action | Can Do? |
|--------|---------|
| Create subscription | ✅ Yes |
| View own subscriptions | ✅ Yes |
| View customer details (own) | ✅ Yes |
| See meal plan names | ✅ Yes |
| See quantity | ✅ Yes |
| See allergies/food requests | ✅ Yes |
| See subscription status (Active/Inactive) | ✅ Yes |
| See pricing/amounts | ❌ No |
| See payment status | ❌ No |
| See payment method | ❌ No |
| See other reps' subscriptions | ❌ No |
| See other customers' phone numbers | ❌ No |
| Edit subscription | ❌ No |
| Delete subscription | ❌ No |
| Create/verify payments | ❌ No |
| View financial reports | ❌ No |
| View audit log | ❌ No |
| Access PRICING_CONFIG | ❌ No |

---

### OWNER Permissions

| Action | Can Do? |
|--------|---------|
| Create subscription | ✅ Yes |
| View ALL subscriptions | ✅ Yes |
| View ALL customer details | ✅ Yes |
| View all reps' subscriptions | ✅ Yes |
| Edit subscription details | ✅ Yes |
| Delete subscription (soft delete) | ✅ Yes |
| See pricing/amounts | ✅ Yes |
| Create payment records | ✅ Yes |
| Verify payments | ✅ Yes |
| View payment status | ✅ Yes |
| Generate weekly billings | ✅ Yes (manual trigger) |
| Run financial reports | ✅ Yes |
| View audit log | ✅ Yes |
| Manage PRICING_CONFIG | ✅ Yes |
| Add internal notes | ✅ Yes |
| Export data to fulfillment | ✅ Yes |

---

## Anti-Fraud Controls

### Scenario 1: Rep Pockets Cash, Doesn't Record Subscription
**How to Detect:**
- Customer complains they weren't delivered
- Subscription doesn't exist in system
- No billing records generated
- Audit log shows no creation timestamp

**Prevention:**
- System timestamps all subscriptions
- If customer claims they enrolled, but no record exists, fraud is evident
- Rep's commission is tied to verified payments, not claimed orders

---

### Scenario 2: Rep Creates Fake Subscription to Hide Cash
**How to Detect:**
- Subscription exists but customer doesn't match real person
- No delivery completed (fulfillment team rejects invalid address/allergies)
- No payment received for generated billing
- Audit log shows creation by rep, but no payment verifications follow

**Prevention:**
- Fulfillment team validates customer details before prepping
- Fake orders get caught in kitchen workflow
- Weekly reconciliation flags billings with zero payments after 3 days

---

### Scenario 3: Rep Edits Subscription After Enrollment
**How to Detect:**
- Immutable record prevents post-creation edits
- If owner notices discrepancy, audit log shows who created it and when
- Any owner-made edits are logged separately with reason

**Prevention:**
- Technical: SUBSCRIPTIONS sheet is read-only after creation (only owner can edit via special form)
- Audit trail records every change with user, timestamp, before/after values

---

### Scenario 4: Rep Claims Payment Verified But Customer Didn't Pay
**How to Detect:**
- Rep cannot verify payments at all (access denied)
- Owner verifies payments against actual GCash/bank deposits
- Weekly reconciliation: payment_verified count ≠ deposit count

**Prevention:**
- Only owner can create/verify PAYMENT records
- Rep has zero access to payment verification
- Bank reconciliation exposes mismatches instantly

---

### Scenario 5: Rep Collects Full Amount But Records Partial
**How to Detect:**
- Amount in PAYMENT record is auto-filled by owner based on billing_id amount
- Rep cannot input amounts anywhere
- Bank deposits > verified payments in system = fraud flag

**Prevention:**
- Amount is calculated by system, not rep-entered
- Owner must manually verify payment against billing amount
- Audit log shows who verified and when

---

### Scenario 6: Rep Gives Wrong Address to Pocket Delivery Fee
**How to Detect:**
- Address is rep-entered, but owner verifies before confirming
- Fulfillment team validates address matches customer expectations
- Delivery team can report wrong address after delivery attempt
- Rep's delivery fee is only paid after successful delivery (depends on business rules)

**Prevention:**
- Owner reviews all subscriptions before activation
- Fulfillment team has customer contact to verify address
- Delivery team feedback loop

---

## Dashboards & Reports

### Dashboard 1: Sales Rep Dashboard
**View:** Own subscriptions and basic status

- List of subscriptions created by this rep
- Customer name, meal plan, start date, status (Active/Inactive)
- Subscription count for the week
- No financial data visible

---

### Dashboard 2: Owner - Weekly Overview

**View:** `2025-07-W1` (July 1-6)

```
ACTIVE SUBSCRIPTIONS:  45
├─ Keto Plan:          18 × ₱3,500 = ₱63,000
├─ Standard Plan:      20 × ₱2,800 = ₱56,000
└─ Protein+ Plan:       7 × ₱4,200 = ₱29,400

TOTAL DUE:             ₱148,400
VERIFIED PAYMENTS:     ₱142,800 (96%)
PENDING:               ₱5,600 (4%)
OVERDUE:               ₱0

Collection Rate:       96%
```

---

### Dashboard 3: Owner - Weekly Billings Detail

List all WEEKLY_BILLINGS for current week with:
- Billing ID
- Customer name
- Meal plan
- Amount
- Status (Pending/Verified/Overdue)
- Sales rep who created subscription
- Filter options: by status, rep, meal plan

---

### Dashboard 4: Owner - Payment Reconciliation

**What to reconcile:**
- Total billings created: ₱148,400
- Total verified payments in system: ₱142,800
- Actual GCash deposits received: ₱142,900 (₱100 discrepancy)
- Actual bank deposits received: ₱42,000

**Actions:**
- [INVESTIGATE] discrepancy
- [SEND REMINDERS] to customers with pending payments
- [MARK OVERDUE] if payment not received after 3 days
- [EXPORT] verified billings to fulfillment team

---

### Dashboard 5: Owner - Monthly Summary

Aggregate by month (e.g., 2025-07):

```
Total Billings (4 weeks):      ₱592,000
Total Verified Payments:        ₱568,800 (96%)

Revenue by Meal Plan:
├─ Keto Plan:      ₱252,000
├─ Standard Plan:  ₱224,000
└─ Protein+ Plan:  ₱117,600

Revenue by Rep:
├─ Maria:          ₱134,400
├─ Carlos:         ₱168,000
└─ Pedro:          ₱289,600

Subscription Health:
├─ Active start:   42
├─ New:             8
├─ Cancelled:       2
├─ Active end:     45
└─ Churn rate:      5%
```

---

### Report 1: Unpaid Billings Report

Show all WEEKLY_BILLINGS with status = "Pending Payment" or "Overdue"
- Customer name, phone, amount due
- Days overdue
- Meal plan
- [SEND REMINDER] [MARK OVERDUE] [FOLLOW UP]

---

### Report 2: Sales Rep Performance Report

For each rep:
- Subscriptions created (this week, this month, all-time)
- Total billings generated
- Verified payments linked to their subscriptions
- Payment verification rate (%)
- Collections trend

**Purpose:** Identify reps with suspiciously low verification rates

---

### Report 3: Payment Method Distribution

```
Payment Method        Count    Amount         %
GCash               28       ₱95,400        67%
Bank Transfer       12       ₱42,000        30%
Cash (COD)           5        ₱5,400         3%
Total              45       ₱142,800       100%
```

---

### Report 4: Reconciliation Report (for Bank Deposits)

```
Bank Statement Date: 2025-07-07
GCash Received:      ₱95,500
Bank Transfer:       ₱42,000
Total Deposited:     ₱137,500

System Records:
GCash Verified:      ₱95,400 (₱100 under)
Bank Transfer:       ₱42,000 (match)
Total Verified:      ₱137,400

Discrepancy:         ₱100 (investigate)
Action:              [ADD PAYMENT] [MARK DISPUTE]
```

---

## Tech Stack Recommendation

- **Frontend:** React 18 (simple, no external UI libraries, mobile-responsive PWA)
- **Backend:** Google Apps Script (serverless, integrates with Google Sheets)
- **Database:** Google Sheets (with proper schema structure)
- **Authentication:** Google Sign-In (owner @gmail, reps @gmail)
- **Hosting:** GitHub Pages (static frontend) + Apps Script (backend)
- **Local State:** localStorage for UI preferences only (no sensitive data)

---

## Implementation Phases

### Phase 1 (MVP - Week 1-2)
- ✅ Sales rep subscription creation form
- ✅ Subscription list with basic filtering
- ✅ Owner subscription approval workflow
- ✅ Manual weekly billing generation
- ✅ Owner payment verification form
- ✅ Weekly reconciliation dashboard (basic)

### Phase 2 (Week 3)
- ✅ Auto-weekly billing generation (Sunday trigger)
- ✅ Monthly summary reports
- ✅ Sales rep performance metrics
- ✅ Improved filtering and search

### Phase 3 (Week 4+)
- ✅ FB Messenger integration (auto-pull inquiries)
- ✅ GCash API integration (auto-confirm payments)
- ✅ Email/SMS reminders for unpaid billings
- ✅ Advanced analytics and forecasting

---

## Security & Compliance

1. **Data Validation:** All user inputs validated server-side
2. **Access Control:** Role-based access strictly enforced
3. **Audit Trail:** All actions logged immutably
4. **Data Privacy:** No sensitive data in localStorage
5. **SSL/HTTPS:** All data transmitted securely (GitHub Pages enforces)
6. **Backup:** Google Sheets native backup on Drive

---

## Success Metrics

- **Payment Collection Rate:** Target 95%+ verified payments within 3 days
- **Rep Accuracy:** Subscriptions created = billings generated = payments verified
- **Fraud Detection:** Zero discrepancies between billings and verified payments
- **Customer Retention:** Track weekly subscription renewals by meal plan
- **Rep Performance:** Commission tied to verified payments, not claimed orders
