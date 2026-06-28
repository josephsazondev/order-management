# Data Schema - Google Sheets Structure

## Sheet 1: SUBSCRIPTIONS

**Purpose:** Core recurring subscription records (immutable after creation by rep)

| Column Name | Data Type | Required | Notes | Example |
|---|---|---|---|---|
| subscription_id | TEXT | Yes | Auto-generated primary key | SUB-20250616-001 |
| customer_name | TEXT | Yes | Full name of customer | Juan dela Cruz |
| customer_address | TEXT | Yes | Delivery address | Quezon City, Manila |
| customer_phone | TEXT | Yes | Contact number | 09171234567 |
| allergy_concerns | TEXT | No | Allergies/dietary restrictions | No shellfish, no fish |
| food_requests | TEXT | No | Special requests | Diabetic-friendly, less oil |
| meal_plan | TEXT | Yes | Dropdown: Keto Plan, Standard Plan, Protein+ Plan | Keto Plan |
| quantity | NUMBER | Yes | Number of servings or units | 1 |
| start_date | DATE | Yes | Subscription start date (YYYY-MM-DD) | 2025-06-16 |
| is_active | BOOLEAN | Yes | TRUE = Active, FALSE = Cancelled | TRUE |
| created_by | TEXT | Yes | Sales rep user ID/email | maria@company.com |
| created_at | TEXT | Yes | Timestamp (YYYY-MM-DD HH:MM:SS) | 2025-06-16 14:30:45 |
| internal_notes | TEXT | No | Owner-only notes (rep cannot see) | Customer prefers Thursday delivery |

**Constraints:**
- subscription_id is unique key (no duplicates)
- Sales rep cannot edit or delete (read-only after creation by app)
- Only owner can modify internal_notes or is_active
- created_at and created_by are immutable (set once, never change)

**Access Control:**
```
Sales Rep:
  - Can CREATE
  - Can VIEW own subscriptions
  - Can READ (customer_name, address, phone, meal_plan, quantity, allergies, food_requests, start_date, is_active)
  - CANNOT: Edit, delete, see internal_notes

Owner:
  - Can VIEW ALL
  - Can CREATE
  - Can EDIT (any field)
  - Can DELETE (soft delete: is_active = FALSE)
  - Can EDIT internal_notes
  - Can READ everything
```

---

## Sheet 2: WEEKLY_BILLINGS

**Purpose:** Auto-generated weekly charges for active subscriptions

| Column Name | Data Type | Required | Notes | Example |
|---|---|---|---|---|
| billing_id | TEXT | Yes | Auto-generated primary key | BILL-2025-07-W1-001 |
| subscription_id | TEXT | Yes | FK to SUBSCRIPTIONS | SUB-20250616-001 |
| billing_week | TEXT | Yes | Week identifier (YYYY-MM-WN) | 2025-07-W1 |
| billing_month | TEXT | Yes | Month (YYYY-MM) - used for grouping | 2025-07 |
| week_start_date | DATE | Yes | First day of week (YYYY-MM-DD) | 2025-07-01 |
| week_end_date | DATE | Yes | Last day of week (YYYY-MM-DD) | 2025-07-06 |
| amount_php | CURRENCY | Yes | Auto-calculated from PRICING_CONFIG | 3500.00 |
| status | TEXT | Yes | Dropdown: Pending Payment, Verified, Overdue, Cancelled | Pending Payment |
| customer_name | TEXT | Yes | Denormalized from SUBSCRIPTIONS (for filtering) | Juan dela Cruz |
| meal_plan | TEXT | Yes | Denormalized (for filtering) | Keto Plan |
| created_by | TEXT | Yes | Sales rep who created original subscription | maria@company.com |
| created_at | TEXT | Yes | When this billing was generated (YYYY-MM-DD HH:MM:SS) | 2025-06-29 23:00:00 |

**Rules:**
- billing_id is unique (subscription_id + billing_week combination should be unique)
- amount_php is auto-calculated by system: lookup meal_plan in PRICING_CONFIG, multiply by quantity from SUBSCRIPTIONS
- status starts as "Pending Payment" when generated
- status changes to "Verified" only when PAYMENTS record is created and verified by owner
- If subscription is_active = FALSE, no new billings generated after that week

**Weekly Generation Logic:**
```
Every Sunday 11 PM:
  FOR each subscription WHERE is_active = TRUE:
    IF NOT EXISTS (billing WHERE subscription_id = X AND billing_week = "2025-07-W1"):
      CREATE new billing:
        - subscription_id: from subscription
        - billing_week: calculated as "2025-07-W1"
        - billing_month: extracted from billing_week
        - week_start_date: Sunday of this week
        - week_end_date: Saturday of this week
        - amount_php: PRICING_CONFIG[subscription.meal_plan].price_per_week
        - status: "Pending Payment"
        - customer_name: from subscription
        - meal_plan: from subscription
        - created_by: from subscription
        - created_at: NOW()
```

**Access Control:**
```
Sales Rep:
  - Can VIEW own created subscriptions' billings only
  - Can READ (billing_id, customer_name, meal_plan, status, billing_week)
  - CANNOT: See amounts, edit, delete, verify

Owner:
  - Can VIEW ALL
  - Can CREATE (manual or auto)
  - Can EDIT status
  - Can EXPORT for fulfillment
  - Can RUN reports
```

---

## Sheet 3: PAYMENTS

**Purpose:** Payment records (independent from orders; only owner creates)

| Column Name | Data Type | Required | Notes | Example |
|---|---|---|---|---|
| payment_id | TEXT | Yes | Auto-generated primary key | PAY-2025-07-W1-001 |
| billing_id | TEXT | Yes | FK to WEEKLY_BILLINGS | BILL-2025-07-W1-001 |
| subscription_id | TEXT | Yes | FK to SUBSCRIPTIONS (for quick lookup) | SUB-20250616-001 |
| amount_php | CURRENCY | Yes | Amount paid (should match billing_id.amount) | 3500.00 |
| payment_method | TEXT | Yes | Dropdown: GCash, Bank Transfer, COD, Card | GCash |
| customer_reference | TEXT | Yes | GCash ref number, bank slip number, etc. | GCash Ref: ABC123XYZ |
| proof_of_payment | TEXT | No | File path/URL to screenshot or receipt | /uploads/proof_2025-07-01.jpg |
| recorded_date | DATE | Yes | Date payment was recorded in system (YYYY-MM-DD) | 2025-07-02 |
| verified_by | TEXT | Yes | Owner user ID who verified | owner@company.com |
| verified_at | TEXT | Yes | Timestamp of verification (YYYY-MM-DD HH:MM:SS) | 2025-07-02 10:30:00 |
| status | TEXT | Yes | Dropdown: Pending Verification, Verified, Disputed, Refunded | Verified |

**Rules:**
- payment_id is unique
- Only owner can CREATE payment records
- Sales rep has ZERO access to this sheet
- amount_php should equal billing_id.amount (validation on creation)
- status starts as "Pending Verification" when created
- status must be manually set to "Verified" after owner confirms payment legitimacy
- verified_by and verified_at are set when owner verifies
- Multiple payments can be linked to same billing_id if partial payments or corrections needed

**Owner Verification Process:**
```
1. Customer sends payment proof (screenshot, bank slip, etc.)
2. Owner creates PAYMENT record:
   - Looks up billing_id from customer inquiry
   - Enters payment_method
   - Uploads proof_of_payment file
   - Enters customer_reference
   - amount_php auto-populated from billing_id
3. Owner reviews:
   - Does customer_reference match actual GCash/bank?
   - Does amount match billing amount?
   - Is proof_of_payment legitimate?
4. Owner marks status = "Verified"
5. Owner enters verified_by (auto-filled with owner email)
6. System updates WEEKLY_BILLINGS.status = "Verified"
```

**Access Control:**
```
Sales Rep:
  - CANNOT VIEW this sheet at all
  - CANNOT CREATE
  - CANNOT VERIFY

Owner:
  - Can CREATE
  - Can VIEW ALL
  - Can VERIFY (set status to Verified)
  - Can DISPUTE (set status to Disputed for investigation)
  - Can REFUND (set status to Refunded)
  - Can RUN reconciliation reports
```

---

## Sheet 4: PRICING_CONFIG

**Purpose:** Owner manages meal plan pricing (hidden from sales rep)

| Column Name | Data Type | Required | Notes | Example |
|---|---|---|---|---|
| meal_plan_name | TEXT | Yes | Primary key; matches SUBSCRIPTIONS.meal_plan | Keto Plan |
| price_per_week | CURRENCY | Yes | Weekly charge for this meal plan | 3500.00 |
| num_days | NUMBER | Yes | Number of days in this plan (usually 7) | 7 |
| active | BOOLEAN | Yes | Is this plan available? | TRUE |

**Rules:**
- One row per meal plan type
- price_per_week is used to calculate WEEKLY_BILLINGS.amount_php
- Only owner can VIEW and EDIT
- Sales rep cannot see this sheet at all

**Example Data:**
```
Meal Plan Name      Price Per Week    Num Days    Active
Keto Plan           3500.00           7           TRUE
Standard Plan       2800.00           7           TRUE
Protein+ Plan       4200.00           7           TRUE
Budget Plan         2000.00           7           FALSE
```

---

## Sheet 5: AUDIT_LOG

**Purpose:** Immutable log of all actions for fraud detection

| Column Name | Data Type | Required | Notes | Example |
|---|---|---|---|---|
| log_id | NUMBER | Yes | Auto-increment primary key | 1, 2, 3, ... |
| timestamp | TEXT | Yes | Action timestamp (YYYY-MM-DD HH:MM:SS) | 2025-07-01 10:30:45 |
| user_id | TEXT | Yes | Who performed the action | maria@company.com |
| user_role | TEXT | Yes | Enum: sales_rep, owner | sales_rep |
| action | TEXT | Yes | What action was performed | Created Subscription |
| record_id | TEXT | Yes | Which record was affected | SUB-20250616-001 |
| record_type | TEXT | Yes | Type of record (SUBSCRIPTION, PAYMENT, BILLING) | SUBSCRIPTION |
| details | TEXT | Yes | JSON-like summary of change | {"customer_name": "Juan dela Cruz", "meal_plan": "Keto Plan"} |
| ip_address | TEXT | No | Optional for tracking | 192.168.1.1 |

**Rules:**
- AUDIT_LOG is append-only (never edit or delete existing rows)
- Every user action must be logged
- Details should include before/after values for edits

**Actions to Log:**
```
Created Subscription          - New SUB record created
Activated Subscription        - is_active changed TRUE
Cancelled Subscription        - is_active changed FALSE
Updated Subscription          - Any field changed
Generated Week Billing        - New BILL record created
Created Payment               - New PAY record created
Verified Payment              - PAY.status changed to Verified
Disputed Payment              - PAY.status changed to Disputed
Updated Billing Status        - BILL.status changed
Exported to Fulfillment       - Batch export triggered
Viewed Report                 - Owner ran a report
Sent Customer Reminder        - Payment reminder sent
```

---

## Relationships (Foreign Keys)

```
SUBSCRIPTIONS (PK: subscription_id)
    ├─> WEEKLY_BILLINGS (FK: subscription_id)
    │       ├─> PAYMENTS (FK: billing_id)
    │       └─> PAYMENTS (FK: subscription_id)
    │
    └─> AUDIT_LOG (FK: record_id when action involves SUBSCRIPTIONS)

PRICING_CONFIG (PK: meal_plan_name)
    ├─> SUBSCRIPTIONS (FK: meal_plan)
    └─> WEEKLY_BILLINGS (FK: meal_plan)

AUDIT_LOG (PK: log_id)
    └─> Logs all changes to above sheets
```

---

## Data Integrity Rules

1. **No NULL Values in Key Fields:**
   - subscription_id, customer_name, customer_phone, meal_plan, start_date must always have values
   - billing_id, billing_week, amount_php, status must always have values
   - payment_id, billing_id, subscription_id, amount_php, verified_by must always have values

2. **Referential Integrity:**
   - Every billing_id in PAYMENTS must exist in WEEKLY_BILLINGS
   - Every subscription_id in WEEKLY_BILLINGS must exist in SUBSCRIPTIONS
   - Every meal_plan in SUBSCRIPTIONS must exist in PRICING_CONFIG

3. **Immutability:**
   - SUBSCRIPTIONS: created_at, created_by, subscription_id never change
   - PAYMENTS: payment_id, billing_id, subscription_id never change after creation
   - AUDIT_LOG: All rows are append-only (never edit/delete)

4. **Amount Consistency:**
   - WEEKLY_BILLINGS.amount_php = PRICING_CONFIG[meal_plan].price_per_week × SUBSCRIPTIONS.quantity
   - PAYMENTS.amount_php should equal WEEKLY_BILLINGS.amount_php (with tolerance for partial payments)

5. **Status Transitions:**
   - WEEKLY_BILLINGS.status: "Pending Payment" → "Verified" or "Overdue" or "Cancelled"
   - PAYMENTS.status: "Pending Verification" → "Verified" or "Disputed" or "Refunded"

---

## Calculated Fields (in Application Logic)

These are NOT stored in sheets but calculated by frontend/backend:

| Calculation | Where Used | Formula |
|---|---|---|
| billing_week | WEEKLY_BILLINGS | Calculate from week_start_date and week_end_date (YYYY-MM-WN format) |
| billing_month | WEEKLY_BILLINGS | Extract from billing_week (YYYY-MM) |
| amount_php | WEEKLY_BILLINGS | PRICING_CONFIG[meal_plan].price_per_week × SUBSCRIPTIONS.quantity |
| Total Weekly Billings | Dashboard | SUM(WEEKLY_BILLINGS.amount_php WHERE billing_week = "2025-07-W1" AND status = "Verified") |
| Total Verified Payments | Dashboard | SUM(PAYMENTS.amount_php WHERE status = "Verified" AND recorded_date <= TODAY()) |
| Collection Rate | Dashboard | Total Verified Payments / Total Weekly Billings |
| Rep Performance | Report | COUNT(SUBSCRIPTIONS WHERE created_by = rep) AND Verification Rate = COUNT(verified PAYMENTS) / COUNT(billings) |
| Monthly Revenue | Report | SUM(WEEKLY_BILLINGS WHERE billing_month = "2025-07") |
| Overdue Billings | Report | COUNT(WEEKLY_BILLINGS WHERE status = "Pending Payment" AND week_end_date < TODAY() - 3 days) |

---

## Week Numbering Logic

**Input:** Any date (e.g., July 4, 2025)

**Rules:**
1. Find week boundaries (Sunday-Saturday for the week containing that date)
2. Determine which month that week ENDS in
3. Count which week number it is within that month
4. Format as YYYY-MM-WN

**Examples:**

| Date | Week Starts | Week Ends | Month (Rule) | Week # | Result |
|---|---|---|---|---|---|
| June 30, 2025 | June 29 (Sun) | July 5 (Sat) | July (new month) | 1st week in July | 2025-07-W1 |
| July 4, 2025 | June 29 (Sun) | July 5 (Sat) | July (new month) | 1st week in July | 2025-07-W1 |
| July 7, 2025 | July 6 (Sun) | July 12 (Sat) | July (same month) | 2nd week in July | 2025-07-W2 |
| July 28, 2025 | July 27 (Sun) | Aug 2 (Sat) | August (new month) | 1st week in August | 2025-08-W1 |
| Aug 1, 2025 | July 27 (Sun) | Aug 2 (Sat) | August (new month) | 1st week in August | 2025-08-W1 |

**Algorithm:**
```
FUNCTION getWeekIdentifier(date) {
  // Find Sunday of this week
  let weekStart = getLastSunday(date);
  
  // Find Saturday of this week
  let weekEnd = addDays(weekStart, 6);
  
  // Month to use is the month that weekEnd falls in
  let monthToUse = weekEnd.getMonth();
  let yearToUse = weekEnd.getFullYear();
  
  // Find week number: count how many Sundays of monthToUse occur before weekStart
  let firstDayOfMonth = new Date(yearToUse, monthToUse, 1);
  let firstSundayOfMonth = getFirstSunday(firstDayOfMonth);
  let weekNumber = Math.floor((weekStart - firstSundayOfMonth) / 7) + 1;
  
  // Format: YYYY-MM-WN
  return `${yearToUse}-${pad(monthToUse+1, 2)}-W${weekNumber}`;
}
```

---

## View for Sales Rep (What they see)

**Sheet: "My Subscriptions" (Filtered View)**

```
SELECT:
  subscription_id,
  customer_name,
  meal_plan,
  quantity,
  start_date,
  allergy_concerns,
  food_requests,
  is_active

WHERE:
  created_by = CURRENT_USER

FILTER OUT:
  internal_notes,
  all PRICING_CONFIG columns,
  all PAYMENTS columns,
  all WEEKLY_BILLINGS amounts
```

---

## View for Owner (What they see)

**Full Access to All Sheets**

Owner can see and filter by:
- All SUBSCRIPTIONS columns
- All WEEKLY_BILLINGS columns
- All PAYMENTS columns
- All PRICING_CONFIG columns
- AUDIT_LOG in read-only mode

Owner CANNOT:
- Delete AUDIT_LOG rows
- Directly edit created_at or created_by fields
