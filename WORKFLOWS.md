# Workflow Diagrams - OrderFlow System

## Workflow 1: Customer Onboarding (Sales Rep)

```
CUSTOMER (FB Messenger)
        |
        v
[Customer inquires about meal plans]
        |
        v
SALES REP (OrderFlow Dashboard)
        |
        +--- Open OrderFlow
        |
        +--- Click "New Subscription"
        |
        +--- Fill Form:
        |    ├─ Customer Name: "Juan dela Cruz"
        |    ├─ Address: "Quezon City, Manila"
        |    ├─ Phone: "09171234567"
        |    ├─ Meal Plan: "Keto Plan" (dropdown)
        |    ├─ Quantity: "1"
        |    ├─ Allergies: "No shellfish"
        |    └─ Requests: "Diabetic-friendly"
        |
        +--- [SUBMIT]
        |
        v
SYSTEM (Create Subscription)
        |
        ├─ Generate subscription_id: SUB-20250616-001
        ├─ Set created_by: maria@company.com
        ├─ Set created_at: 2025-06-16 14:30:45
        ├─ Set is_active: FALSE (awaiting owner approval)
        └─ Log to AUDIT_LOG
        |
        v
SALES REP (Confirmation)
        |
        +--- "Subscription created!"
        +--- "Reference ID: SUB-20250616-001"
        +--- "Please provide this to customer"
        |
        v
CUSTOMER
        |
        +--- Receives reference ID from rep
        +--- Awaits owner confirmation
```

**Sales Rep Can See:**
- Subscription ID ✓
- Customer name, address, phone ✓
- Meal plan, quantity ✓
- Allergies, requests ✓
- Status (active/inactive) ✓

**Sales Rep CANNOT See:**
- Price (₱3,500) ❌
- Payment status ❌
- Billing information ❌

---

## Workflow 2: Owner Subscription Activation

```
OWNER (Dashboard)
        |
        v
[Receives notification: "New Subscription SUB-20250616-001"]
        |
        v
Owner Opens Subscription Details:
        |
        ├─ Customer Name: Juan dela Cruz ✓
        ├─ Address: Quezon City, Manila ✓
        ├─ Phone: 09171234567 ✓
        ├─ Meal Plan: Keto Plan ✓
        ├─ Allergies: No shellfish ✓
        └─ Requests: Diabetic-friendly ✓
        |
        v
Owner Verifies Information:
        |
        ├─ Is address complete? YES
        ├─ Is phone valid? YES
        ├─ Are allergies clear? YES
        └─ Any red flags? NO
        |
        v
Owner Makes Decision:
        |
        ├─ [APPROVE] ← CLICKED
        ├─ Adds internal note: "Verified customer contact"
        └─ Marks is_active = TRUE
        |
        v
SYSTEM (Activation + Billing Generation)
        |
        ├─ Update SUBSCRIPTIONS.is_active = TRUE
        ├─ Set internal_notes: "Verified customer contact"
        ├─ Trigger billing generation for first week (2025-06-16 to 2025-06-22)
        ├─ Create WEEKLY_BILLINGS:
        |  ├─ billing_id: BILL-2025-06-W3-001
        |  ├─ subscription_id: SUB-20250616-001
        |  ├─ amount_php: 3500.00 (from PRICING_CONFIG)
        |  └─ status: "Pending Payment"
        |
        └─ Log to AUDIT_LOG
        |
        v
OWNER (Notification)
        |
        +--- "Subscription activated!"
        +--- "First billing: BILL-2025-06-W3-001 (₱3,500)"
        +--- "Awaiting payment from customer"
```

**Owner Can See:**
- All subscription details ✓
- Pricing (₱3,500) ✓
- Can activate/deactivate ✓
- Can add internal notes ✓

---

## Workflow 3: Weekly Billing Generation (Automatic)

```
SYSTEM (Sunday 11 PM Trigger)
        |
        v
[Auto-trigger: Generate billings for all active subscriptions]
        |
        v
FOR EACH subscription WHERE is_active = TRUE:
        |
        ├─ Check: Does WEEKLY_BILLINGS already exist for this week?
        |
        ├─ IF YES: Skip (prevent duplicates)
        |
        └─ IF NO: Create new billing
            |
            ├─ subscription_id: SUB-20250616-001
            ├─ billing_week: 2025-07-W1 (calculated)
            ├─ billing_month: 2025-07
            ├─ week_start_date: 2025-07-01 (Sunday)
            ├─ week_end_date: 2025-07-06 (Saturday)
            ├─ amount_php: 3500.00 (Keto Plan × quantity 1)
            ├─ status: "Pending Payment"
            ├─ customer_name: "Juan dela Cruz"
            ├─ created_by: "system" or "maria@company.com" (rep who created sub)
            └─ created_at: 2025-06-29 23:00:00
            |
            v
        Log to AUDIT_LOG:
            |
            ├─ action: "Generated Week Billing"
            ├─ record_id: "BILL-2025-07-W1-001"
            └─ details: JSON with billing details

        |
        v
OWNER (Monday Morning)
        |
        +--- Receives notification: "45 new weekly billings generated for 2025-07-W1"
        +--- Total due: ₱148,400
        +--- Current verified: ₱0
        +--- Status: Ready for payment collection
```

**System Logic:**
```
Every Sunday at 11 PM:
  1. Query all SUBSCRIPTIONS where is_active = TRUE
  2. For each subscription:
     - Calculate billing_week for next week
     - Check if billing already exists for this subscription + week
     - If no: CREATE new WEEKLY_BILLINGS record
     - If yes: SKIP
  3. Send owner notification with summary
```

---

## Workflow 4: Payment Collection & Verification (Owner)

```
CUSTOMER
        |
        v
[Sends payment proof via:
 - GCash screenshot: "Ref: ABC123XYZ, ₱3,500"
 - Bank slip: "Reference: 12345678"
 - Cash on Delivery: "Paid ₱3,500 to delivery driver"]
        |
        v
OWNER (Email, Chat, etc.)
        |
        v
Owner Opens OrderFlow:
        |
        ├─ Navigate to: "Weekly Billings" → "2025-07-W1"
        ├─ Find: "BILL-2025-07-W1-001" (Juan dela Cruz, ₱3,500)
        ├─ Status: "Pending Payment" ← needs verification
        |
        v
Owner Creates PAYMENT Record:
        |
        +--- Click [PAY] button on billing
        |
        +--- Fill Payment Form:
        |    ├─ Payment Method: "GCash" (dropdown)
        |    ├─ Customer Reference: "ABC123XYZ"
        |    ├─ Amount: 3500.00 (auto-filled from billing)
        |    ├─ Proof: [Upload screenshot]
        |    └─ Recorded Date: 2025-07-02
        |
        v
Owner Verifies:
        |
        +--- Check GCash account
        |    └─ "Received from Juan dela Cruz: ₱3,500, Ref: ABC123XYZ"
        |    └─ MATCHES ✓
        |
        +--- [VERIFY] button
        |
        v
SYSTEM (Mark Payment as Verified)
        |
        ├─ Create PAYMENTS record:
        |  ├─ payment_id: PAY-2025-07-W1-001
        |  ├─ billing_id: BILL-2025-07-W1-001
        |  ├─ subscription_id: SUB-20250616-001
        |  ├─ amount_php: 3500.00
        |  ├─ payment_method: "GCash"
        |  ├─ customer_reference: "ABC123XYZ"
        |  ├─ verified_by: "owner@company.com"
        |  ├─ verified_at: 2025-07-02 10:30:00
        |  └─ status: "Verified"
        |
        ├─ Update WEEKLY_BILLINGS:
        |  ├─ status: "Pending Payment" → "Verified" ✓
        |
        └─ Log to AUDIT_LOG:
           ├─ action: "Verified Payment"
           ├─ record_id: "PAY-2025-07-W1-001"
           └─ details: Payment verification for billing BILL-2025-07-W1-001

        |
        v
OWNER (Confirmation)
        |
        +--- "Payment verified!"
        +--- "Billing BILL-2025-07-W1-001 marked as Verified"
        +--- "Ready for fulfillment"
```

**Sales Rep During This Time:**
- CANNOT see this workflow ❌
- CANNOT access PAYMENTS sheet ❌
- CANNOT verify payments ❌
- Remains unaware of payment details ✓ (prevents dishonesty)

---

## Workflow 5: Weekly Reconciliation (Owner)

```
OWNER (Monday Morning)
        |
        v
[Open Reconciliation Dashboard for: 2025-07-W1]
        |
        v
STEP 1: Verify Auto-Generated Billings
        |
        +--- System generated: 45 billings
        +--- Total: ₱148,400
        +--- Check for duplicates: NONE ✓
        +--- Check for missing: 0 ❌
        |
        v
STEP 2: Payment Verification vs Bank Deposits
        |
        +--- Verified in System:
        |    ├─ GCash: 28 payments = ₱95,400
        |    ├─ Bank: 12 payments = ₱42,000
        |    └─ Cash: 5 payments = ₱5,400
        |    └─ Total Verified: ₱142,800
        |
        +--- Actual Deposits Received:
        |    ├─ GCash Account: ₱95,500
        |    ├─ Bank Account: ₱42,000
        |    └─ Total Received: ₱137,500
        |
        +--- DISCREPANCY DETECTED:
        |    ├─ GCash: ₱95,500 (received) vs ₱95,400 (verified) = +₱100
        |    └─ Status: ⚠️ INVESTIGATE
        |
        v
STEP 3: Identify Unpaid Billings
        |
        +--- Status = "Pending Payment" for 2025-07-W1:
        |    ├─ Jose Reyes: ₱4,200 (Protein+ Plan)
        |    ├─ Rosa Maria: ₱2,800 (Standard Plan)
        |    └─ Total Overdue: ₱7,000
        |
        +--- [SEND REMINDERS] (auto-email to customers)
        |
        +--- Mark as "Overdue" if unpaid after 3 days
        |
        v
STEP 4: Rep Performance Check
        |
        +--- Rep A (Maria): 15 subscriptions created, 15 billings verified = 100% ✓
        |
        +--- Rep B (Carlos): 12 subscriptions created, 10 billings verified = 83% ⚠️
        |    └─ Action: Contact Carlos to follow up on 2 customers
        |
        +--- Rep C (Pedro): 18 subscriptions created, 16 billings verified = 89% ⚠️
        |    └─ Action: Review Pedro's customer list
        |
        v
STEP 5: Investigate GCash Discrepancy
        |
        +--- Received: ₱95,500
        +--- Verified: ₱95,400
        +--- Difference: ₱100
        |
        +--- Possible causes:
        |    ├─ Payment not yet recorded in system
        |    ├─ Duplicate payment (customer paid twice)
        |    └─ Additional small payment from another source
        |
        +--- Action: [ADD PAYMENT]
        |    └─ Create PAYMENT record for the missing ₱100
        |
        v
STEP 6: Export Verified Billings to Fulfillment
        |
        +--- Filter: status = "Verified" AND billing_week = "2025-07-W1"
        +--- Count: 38 verified billings (₱137,500)
        |
        +--- [EXPORT TO KITCHEN]
        |
        +--- Send to fulfillment team:
        |    ├─ Customer name, address, phone
        |    ├─ Meal plan, quantity
        |    ├─ Delivery date (by Friday/Saturday)
        |    ├─ Allergies & special requests
        |    └─ Billing ID (for reference)
        |
        v
STEP 7: Log Reconciliation Complete
        |
        +--- Log to AUDIT_LOG:
        |    ├─ action: "Completed Weekly Reconciliation"
        |    ├─ week: "2025-07-W1"
        |    ├─ total_billings: 45
        |    ├─ verified_payments: 38
        |    ├─ discrepancies: 1 (GCash +₱100)
        |    └─ exported_to_fulfillment: 38
        |
        v
OWNER (Summary)
        |
        +--- WEEKLY RECONCILIATION COMPLETE ✓
        |
        +--- Results:
        |    ├─ Billings: 45 (₱148,400)
        |    ├─ Verified: 38 (₱142,800)
        |    ├─ Pending: 7 (₱5,600)
        |    ├─ Collection Rate: 96% 📊
        |    ├─ Discrepancies: 1 (₱100) ⚠️
        |    └─ Status: Ready for fulfillment
        |
        +--- Next Actions:
        |    ├─ Kitchen team: Prep for 38 verified orders
        |    ├─ Delivery team: Deliver by Friday/Saturday
        |    ├─ Follow-up: Contact 7 customers with pending payments
        |    └─ Investigation: Resolve GCash ₱100 discrepancy
```

---

## Workflow 6: Payment Reminder (Unpaid Billings)

```
OWNER (Monday Morning - Reconciliation)
        |
        v
[Identified unpaid billings from last week]
        |
        ├─ Jose Reyes: ₱4,200 (not yet paid)
        ├─ Rosa Maria: ₱2,800 (not yet paid)
        ├─ Miguel Santos: ₱3,500 (not yet paid)
        |
        v
[SEND REMINDERS] button clicked
        |
        v
SYSTEM (Auto-send reminders)
        |
        +--- Email to Jose Reyes:
        |    |
        |    | Subject: Payment Reminder - Your Keto Meal Plan (₱4,200)
        |    |
        |    | Hi Jose,
        |    |
        |    | We notice your meal plan payment for this week is still pending.
        |    | Billing ID: BILL-2025-07-W1-003
        |    | Amount Due: ₱4,200
        |    | Meal Plan: Protein+ Plan (7 days)
        |    |
        |    | Please complete payment by EOD Wednesday to ensure delivery.
        |    |
        |    | Payment Options:
        |    | - GCash: [QR Code or Phone #]
        |    | - Bank Transfer: [Account Details]
        |    | - Cash on Delivery: [Contact Info]
        |    |
        |    | Reply with payment proof to confirm.
        |    |
        |    | Thanks!
        |    | OrderFlow Team
        |
        +--- Similar emails to Rosa Maria, Miguel Santos
        |
        v
3 DAYS LATER (Thursday)
        |
        v
OWNER (Follow-up Check)
        |
        +--- Check payment status:
        |    ├─ Jose Reyes: Still pending (3 days overdue) ❌
        |    ├─ Rosa Maria: Verified ✓ (paid Wednesday)
        |    └─ Miguel Santos: Verified ✓ (paid Tuesday)
        |
        +--- For Jose Reyes:
        |    ├─ Mark as "Overdue"
        |    ├─ Contact Jose directly (call/message)
        |    ├─ Decision: Delay delivery? Cancel subscription?
        |    └─ Log to AUDIT_LOG
        |
        v
RESOLUTION:
        |
        ├─ SCENARIO A: Jose pays by Thursday EOD
        |  └─ Mark as "Verified", proceed with delivery
        |
        ├─ SCENARIO B: Jose doesn't pay by Friday
        |  ├─ Don't deliver (no verified payment)
        |  ├─ Suspend subscription (is_active = FALSE)
        |  └─ Schedule for next week pending payment
        |
        └─ Log outcome to AUDIT_LOG
```

---

## Workflow 7: Detecting Fraud (Sales Rep Misconduct)

```
SCENARIO: Sales Rep collects cash, doesn't record order
        |
        v
REP'S PERSPECTIVE:
        +--- Customer calls rep: "I want Keto Plan, ₱3,500"
        +--- Rep collects ₱3,500 cash
        +--- Rep does NOT create subscription in system
        +--- Rep keeps the ₱3,500 ❌ FRAUD
        |
        v
CUSTOMER'S PERSPECTIVE:
        +--- Customer expects delivery next week
        +--- Doesn't receive anything
        +--- Calls rep: "Where's my meal plan?"
        +--- Rep ignores/makes excuse
        |
        v
OWNER'S PERSPECTIVE:
        |
        +--- Customer contacts owner directly
        |    ├─ "I paid your rep ₱3,500 but got nothing"
        |    └─ Provides rep's name
        |
        +--- Owner investigates:
        |    ├─ Search for subscription by customer phone
        |    ├─ Result: NO SUBSCRIPTION FOUND ❌
        |    |
        |    ├─ Check AUDIT_LOG for this rep:
        |    |    └─ "No orders created on [date] around [time]"
        |    |
        |    └─ Conclusion: REP POCKETED ₱3,500 CASH
        |
        v
ACTION:
        |
        ├─ Create subscription manually (owner)
        ├─ Generate billing for this week
        ├─ Cancel subscription after 1 week (compensate customer)
        ├─ Review rep's ALL orders for similar patterns
        ├─ Check bank reconciliation:
        |  └─ Rep created 20 orders but only 15 verified payments?
        |     This is RED FLAG
        |
        └─ Terminate rep access + investigate ₱3,500 loss

        |
        v
PREVENTION:
        |
        +--- System has timestamp proof of order creation
        +--- If customer claims ordered, but no record exists:
        |    └─ Fraud is evident
        |
        +--- Rep performance metrics expose low verification rates:
        |    └─ Rep A: 20 orders, 20 verified (100%)
        |    └─ Rep B: 15 orders, 8 verified (53%) ⚠️ FRAUD RISK
        |
        +--- Weekly reconciliation:
        |    ├─ Bank deposits vs verified payments must match
        |    └─ Missing payments flag which rep's orders have issues
```

---

## Workflow 8: Subscription Cancellation

```
CUSTOMER
        |
        v
[Wants to cancel subscription]
        |
        +--- Contact owner: "I want to cancel"
        |
        v
OWNER (Dashboard)
        |
        +--- Open subscription: SUB-20250616-001 (Juan dela Cruz)
        +--- Click [CANCEL] button
        |
        v
SYSTEM (Cancellation)
        |
        ├─ Update SUBSCRIPTIONS:
        |  ├─ is_active: TRUE → FALSE
        |  └─ internal_notes: "Cancelled by owner on 2025-07-10, reason: Customer request"
        |
        ├─ Stop generating weekly_billings after current week
        |
        └─ Log to AUDIT_LOG:
           ├─ action: "Cancelled Subscription"
           ├─ record_id: "SUB-20250616-001"
           └─ details: "Cancelled by owner@company.com on 2025-07-10"

        |
        v
NEXT SUNDAY (Weekly Billing Generation)
        |
        +--- System checks: is_active = FALSE
        +--- Result: DO NOT generate new billing ✓
        +--- Subscription is dormant, no further charges
        |
        v
OWNER (Notification)
        |
        +--- "Subscription cancelled"
        +--- "No further billings will be generated"
        +--- "Customer can re-subscribe anytime"
```

---

## Summary: Data Flow Through Sheets

```
SALES REP creates Subscription
        ↓
SUBSCRIPTIONS Sheet (immutable)
        ↓
OWNER activates (is_active = TRUE)
        ↓
SYSTEM auto-generates weekly billings (Sunday)
        ↓
WEEKLY_BILLINGS Sheet (status: Pending Payment)
        ↓
CUSTOMER sends payment proof
        ↓
OWNER creates & verifies PAYMENT record
        ↓
PAYMENTS Sheet (status: Verified)
        ↓
SYSTEM updates WEEKLY_BILLINGS (status: Verified)
        ↓
OWNER exports verified billings to fulfillment
        ↓
KITCHEN & DELIVERY teams execute
        ↓
COMPLETION (Delivery done)
        ↓
Next Sunday: SYSTEM generates new billings
        ↓
Cycle repeats for recurring customers

THROUGHOUT: AUDIT_LOG records every action
```

---

## Key Controls for Fraud Prevention

| Fraud Risk | Prevention | Who Checks |
|---|---|---|
| **Rep pockets cash** | Timestamp subscription creation; no subscription = fraud evident | Customer disputes + Owner audit |
| **Rep creates fake orders** | Kitchen validates customer details; fake orders get rejected in fulfillment | Fulfillment team |
| **Rep edits after creation** | Immutable subscription records; audit log shows creator | Owner reviews audit log |
| **Rep claims payment verified** | Rep has zero access to PAYMENTS sheet; only owner can verify | System access control |
| **Rep records wrong amount** | Amount auto-calculated; bank reconciliation catches mismatches | Weekly reconciliation |
| **Rep's verification rate is low** | Performance dashboard shows (orders created vs verified payments) | Owner monitors weekly |

---

## Month-Week Examples

| Date | Week Range | Billing Week | Why |
|---|---|---|---|
| June 30, 2025 | Jun 29 - Jul 5 | 2025-07-W1 | Ends in July (new month) |
| July 4, 2025 | Jun 29 - Jul 5 | 2025-07-W1 | Same week as June 30 |
| July 7, 2025 | Jul 6 - Jul 12 | 2025-07-W2 | 2nd week in July |
| July 28, 2025 | Jul 27 - Aug 2 | 2025-08-W1 | Ends in August (new month) |
| August 1, 2025 | Jul 27 - Aug 2 | 2025-08-W1 | Same week as July 28 |
