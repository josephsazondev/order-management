# Quick Reference Guide - OrderFlow

Use this while building with Claude Code. Bookmark key sections!

---

## THE GOLDEN RULE 🏆

**Sales Rep NEVER sees amounts, payments, or financial data.**

- ❌ No pricing
- ❌ No payment status
- ❌ No financial reports
- ✅ Only customer details + subscription management

---

## User Roles Matrix

### SALES REP (FB Messenger order entry)

**Can CREATE & VIEW:**
- Own subscriptions only
- Customer name, address, phone
- Meal plan, quantity, allergies, food requests
- Subscription start date
- Subscription status (Active/Inactive)

**CANNOT access:**
- Any pricing/amounts
- PAYMENTS sheet (entirely)
- PRICING_CONFIG sheet
- Financial dashboards
- Other reps' subscriptions
- Edit/Delete buttons

### OWNER (Payment verification & reporting)

**Can CREATE, EDIT, DELETE, VIEW:**
- All subscriptions (all reps)
- All customers
- All pricing/amounts
- All payment records
- All financial reports
- Audit logs
- Weekly billings
- Everything

---

## Core Sheets (Google Sheets)

### 1️⃣ SUBSCRIPTIONS (Immutable once created)
```
subscription_id | customer_name | customer_address | customer_phone 
meal_plan | quantity | allergy_concerns | food_requests 
start_date | is_active | created_by | created_at | internal_notes
```
**Rule:** Sales rep can CREATE but CANNOT EDIT or DELETE

### 2️⃣ WEEKLY_BILLINGS (Auto-generated every Sunday)
```
billing_id | subscription_id | billing_week | billing_month 
week_start_date | week_end_date | amount_php | status 
customer_name | meal_plan | created_by | created_at
```
**Rule:** System auto-creates for all active subscriptions; owner updates status only

### 3️⃣ PAYMENTS (Owner-only creation)
```
payment_id | billing_id | subscription_id | amount_php 
payment_method | customer_reference | proof_of_payment 
recorded_date | verified_by | verified_at | status
```
**Rule:** SALES REP HAS ZERO ACCESS. Only owner creates & verifies.

### 4️⃣ PRICING_CONFIG (Owner configuration)
```
meal_plan_name | price_per_week | num_days | active
```
**Rule:** Hidden from sales rep entirely

### 5️⃣ AUDIT_LOG (Immutable)
```
log_id | timestamp | user_id | user_role | action 
record_id | record_type | details | ip_address
```
**Rule:** Append-only. Never delete. Log everything.

---

## Week Format

**YYYY-MM-WN** (Month is where week ENDS, not starts)

```
June 29 - July 5   → 2025-07-W1  (ends July)
July 6 - July 12   → 2025-07-W2  (ends July)
July 27 - Aug 2    → 2025-08-W1  (ends August)
```

**Calculation:**
```
1. Get Sunday-Saturday range for date
2. Find which month the SATURDAY falls in
3. Count which week# that is in that month
4. Format: YYYY-MM-W[number]
```

---

## Anti-Fraud Controls Checklist

### ✅ Prevent Rep from Pocketing Cash
- [x] Timestamp all subscription creation
- [x] Require proof of payment from customer
- [x] Owner verifies against actual bank deposits
- [x] Weekly reconciliation exposes mismatches

### ✅ Prevent Rep from Editing Records
- [x] SUBSCRIPTIONS immutable after creation
- [x] Only owner can edit (with audit trail)
- [x] Audit log shows who created what when

### ✅ Prevent Rep from Skipping Payments
- [x] Rep has ZERO access to PAYMENTS sheet
- [x] Rep cannot mark payments verified
- [x] Only owner can create/verify payments
- [x] Bank reconciliation catches missing payments

### ✅ Prevent Rep from Seeing Amounts
- [x] Price hidden in PRICING_CONFIG
- [x] Amount in WEEKLY_BILLINGS not shown to rep
- [x] Rep cannot navigate to PAYMENTS sheet
- [x] Rep UI shows no currency values

### ✅ Catch Suspicious Reps Early
- [x] Dashboard shows: Orders created vs Verified payments %
- [x] Rep with 20 orders + 8 verified = 40% = RED FLAG
- [x] Weekly reconciliation shows verification rate
- [x] Audit log tracks all rep actions

---

## Workflows at a Glance

### Workflow A: Sales Rep Creates Subscription
```
Rep fills form (name, address, phone, meal plan, qty, allergies)
  ↓
System generates subscription_id
  ↓
Rep tells customer: "Your ref is SUB-20250616-001"
  ↓
Rep does NOT see pricing
```

### Workflow B: Owner Activates Subscription
```
Owner reviews subscription details
  ↓
Owner marks: is_active = TRUE
  ↓
System auto-generates first weekly billing
```

### Workflow C: System Auto-Generates Weekly Billings (Every Sunday 11 PM)
```
FOR each subscription WHERE is_active = TRUE:
  IF billing doesn't exist for this week:
    CREATE WEEKLY_BILLINGS
    amount_php = PRICING_CONFIG[meal_plan] × quantity
    status = "Pending Payment"
```

### Workflow D: Owner Verifies Payment
```
Customer sends payment proof
  ↓
Owner creates PAYMENT record
  ↓
Owner verifies against actual bank/GCash deposit
  ↓
Owner marks: status = "Verified"
  ↓
System updates WEEKLY_BILLINGS: status = "Verified"
```

### Workflow E: Weekly Reconciliation (Monday Morning)
```
1. Check billings were auto-generated (no duplicates)
2. Sum verified payments + compare to actual deposits
3. Flag discrepancies
4. Identify unpaid billings (send reminders)
5. Check rep performance (low verification rates?)
6. Export verified billings to fulfillment
```

---

## Dashboard Views

### Sales Rep Dashboard
```
My Subscriptions
  ├─ List of subscriptions I created
  ├─ Customer name, meal plan, start date, status
  ├─ No amounts shown
  └─ Filter by: date, status
```

### Owner Dashboard - Weekly Overview
```
Week: 2025-07-W1

ACTIVE SUBSCRIPTIONS: 45
  ├─ Keto Plan: 18 × ₱3,500 = ₱63,000
  ├─ Standard Plan: 20 × ₱2,800 = ₱56,000
  └─ Protein+ Plan: 7 × ₱4,200 = ₱29,400

Total Due: ₱148,400
Verified Payments: ₱142,800 (96%)
Pending: ₱5,600 (4%)
Overdue: ₱0

[RECONCILE] [EXPORT TO KITCHEN] [SEND REMINDERS]
```

### Owner Dashboard - Reconciliation
```
Total Billings: ₱148,400
Verified Payments: ₱142,800
Bank Deposits (actual): ₱142,900
  → Discrepancy: +₱100 [INVESTIGATE]

Unpaid Customers (3 days overdue):
  ├─ Jose Reyes: ₱4,200
  ├─ Rosa Maria: ₱2,800
  └─ [SEND REMINDERS]

Rep Performance:
  ├─ Maria: 15 orders, 15 verified (100%)
  ├─ Carlos: 12 orders, 10 verified (83%) ⚠️
  └─ Pedro: 18 orders, 16 verified (89%)
```

---

## Access Control Implementation

### Check Before Every Database Query:

```javascript
IF action = "READ PAYMENTS SHEET"
  IF user_role = "sales_rep"
    → DENY ACCESS ❌
  IF user_role = "owner"
    → ALLOW ✅

IF action = "VIEW PRICING_CONFIG"
  IF user_role = "sales_rep"
    → DENY ACCESS ❌
  IF user_role = "owner"
    → ALLOW ✅

IF action = "EDIT SUBSCRIPTION"
  IF user_role = "sales_rep"
    → ALLOW only CREATE ✅
    → DENY EDIT/DELETE ❌
  IF user_role = "owner"
    → ALLOW EVERYTHING ✅

IF action = "CREATE PAYMENT"
  IF user_role = "sales_rep"
    → DENY ACCESS ❌
  IF user_role = "owner"
    → ALLOW ✅
```

---

## Amount Calculation

### When Owner Creates Weekly Billing:
```
amount_php = PRICING_CONFIG[subscription.meal_plan].price_per_week 
           × subscription.quantity

Example:
  Meal Plan: Keto Plan
  Price Per Week: ₱3,500
  Quantity: 1
  Amount: ₱3,500 × 1 = ₱3,500
```

### Sales Rep NEVER Sees This Calculation ❌

---

## What to Log to AUDIT_LOG

Every time something changes, log it:

```
Created Subscription
→ Details: {subscription_id, customer_name, meal_plan, quantity}

Activated Subscription (is_active TRUE)
→ Details: {subscription_id, activated_by, timestamp}

Cancelled Subscription (is_active FALSE)
→ Details: {subscription_id, cancelled_by, reason}

Generated Week Billing
→ Details: {billing_id, subscription_id, billing_week, amount_php}

Created Payment
→ Details: {payment_id, billing_id, amount_php, payment_method}

Verified Payment
→ Details: {payment_id, verified_by, verified_at}

Updated Billing Status
→ Details: {billing_id, old_status, new_status}

Exported to Fulfillment
→ Details: {week, count, total_amount}
```

---

## Red Flags for Fraud Detection

| Red Flag | Investigation |
|---|---|
| Rep created 20 subscriptions but only 8 have verified payments | Are customers not paying? Or is rep not following up? Or did rep pocket cash? |
| Billing exists but no payment record after 5 days | Legitimate delay, or rep didn't record payment? |
| Bank deposit ₱5,000 but no matching payment record | Rep pocketed cash OR payment not yet recorded |
| Rep marked status = "Verified" but timestamp is before deposit received | Impossible - rep tampered with records? |
| Customer has no subscription but claims they enrolled with rep | Rep pocketed payment without recording |
| Subscription exists but kitchen never received delivery order | Order created but never activated? |

---

## Development Checklist

### Phase 1: MVP
- [ ] Sales rep form to create subscription
- [ ] Subscription list (show only own)
- [ ] Hide pricing from rep
- [ ] Owner can view all subscriptions
- [ ] Owner can activate subscription
- [ ] Manual weekly billing creation (button)
- [ ] Owner payment verification form
- [ ] Basic reconciliation dashboard

### Phase 2: Automation
- [ ] Auto-weekly billing generation (Sunday trigger)
- [ ] Rep performance metrics dashboard
- [ ] Monthly summary reports
- [ ] Advanced reconciliation

### Phase 3: Integration
- [ ] FB Messenger integration
- [ ] GCash API auto-confirmation
- [ ] Email/SMS reminders

---

## Testing Checklist

### Security Testing
- [ ] Sales rep cannot navigate to PAYMENTS sheet (returns 403)
- [ ] Sales rep cannot view PRICING_CONFIG (returns 403)
- [ ] Sales rep cannot edit another rep's subscription (returns 403)
- [ ] Sales rep cannot view other reps' subscriptions (filtered out)
- [ ] Owner CAN view everything (no 403 errors)

### Data Integrity Testing
- [ ] Cannot create subscription without name/phone
- [ ] Cannot create billing without active subscription
- [ ] Cannot create payment for non-existent billing
- [ ] Billing amount matches pricing × quantity (no discrepancies)
- [ ] Weekly billing generation creates no duplicates

### Fraud Detection Testing
- [ ] Audit log records subscription creation with timestamp
- [ ] If customer claims they enrolled but no subscription exists → fraud evident
- [ ] Bank reconciliation catches missing payments
- [ ] Rep performance metric shows suspicious reps (low verification %)

---

## Tech Stack Quick Ref

```
Frontend:        React 18 (no external UI libs)
Backend:         Google Apps Script
Database:        Google Sheets (5 sheets)
Auth:            Google Sign-In (@gmail accounts)
Hosting:         GitHub Pages (frontend) + Apps Script (backend)
Local Storage:   UI preferences only (no sensitive data)
```

---

## Common Pitfalls to Avoid

### ❌ DON'T:
1. Show pricing to sales rep
2. Let sales rep edit subscriptions after creation
3. Allow sales rep access to PAYMENTS sheet
4. Skip audit logging
5. Calculate amounts on frontend (do it server-side)
6. Trust rep to enter payment amounts
7. Skip bank reconciliation
8. Ignore low verification rates (red flag for fraud)
9. Disable edit timestamps
10. Allow manual week billing entry (make it auto-generated)

### ✅ DO:
1. Hide all amounts from rep
2. Make subscriptions immutable for rep
3. Restrict PAYMENTS to owner-only
4. Log everything with timestamp
5. Calculate amounts in backend
6. Owner enters payment amounts only
7. Reconcile weekly vs bank deposits
8. Monitor rep performance metrics
9. Lock timestamps (immutable)
10. Auto-generate billings on schedule

---

## Key Formulas

### Week Identifier Calculation
```
Given: Date (e.g., July 4, 2025)

1. Find Sunday of this week:
   sunday = date - (date.dayOfWeek - 0)  // 0 = Sunday
   
2. Find Saturday of this week:
   saturday = sunday + 6
   
3. Get month of Saturday:
   month = saturday.month()
   
4. Count week number:
   firstDayOfMonth = new Date(saturday.year, saturday.month, 1)
   firstSunday = getFirstSunday(firstDayOfMonth)
   weekNumber = Math.floor((sunday - firstSunday) / 7) + 1
   
5. Format:
   return `${saturday.year}-${pad(saturday.month+1,2)}-W${weekNumber}`
```

### Collection Rate
```
Collection Rate = (Verified Payments / Total Billings) × 100%

Example:
  Total Billings: ₱148,400
  Verified Payments: ₱142,800
  Collection Rate: (142,800 / 148,400) × 100% = 96%
```

### Rep Performance
```
Verification Rate = (Billings with Verified Payment / Total Billings Created) × 100%

Example:
  Maria created: 15 subscriptions
  Total billings for Maria's subs: 15 (week 1)
  Verified payments: 15
  Verification Rate: (15 / 15) × 100% = 100% ✓

  Carlos created: 12 subscriptions
  Total billings for Carlos's subs: 12 (week 1)
  Verified payments: 10
  Verification Rate: (10 / 12) × 100% = 83% ⚠️
```

---

## Emergency Contact Points

If something breaks:

1. **Payment verification broken?**
   - Check: Is owner accessing PAYMENTS sheet?
   - Check: Are verified_by and verified_at being set?
   - Check: Is WEEKLY_BILLINGS status being updated?

2. **Billing not generating?**
   - Check: Is subscription is_active = TRUE?
   - Check: Is week identifier calculated correctly?
   - Check: Does billing already exist (prevent duplicates)?

3. **Rep seeing pricing?**
   - Check: Is pricing filtered in API response?
   - Check: Is sales rep querying PRICING_CONFIG?
   - Check: Is amount_php field hidden in UI?

4. **Discrepancy in reconciliation?**
   - Check: Bank deposits vs verified payments count
   - Check: Which payments are "Pending Verification"?
   - Check: Are there duplicate payment records?

---

## Success Criteria

When you're done:

✅ Sales rep cannot see any pricing or amounts
✅ Sales rep cannot access PAYMENTS sheet
✅ Sales rep subscriptions are immutable (cannot edit)
✅ Owner can view everything
✅ Weekly billings auto-generate every Sunday
✅ Owner payment verification works
✅ Weekly reconciliation shows bank vs system match
✅ Audit log records everything
✅ Rep performance dashboard shows verification rates
✅ No fraud can happen without being detected

---

**Good luck building! 🚀**
