# OrderFlow - Complete System Documentation

## 📋 Quick Start

You now have a complete specification package to build **OrderFlow**, a dual-role weekly meal plan subscription management system with fraud prevention.

**All files are ready to download and use with Claude Code.**

---

## 📁 Files Included

### 1. **CLAUDE_CODE_PROMPT.md** ⭐ START HERE
**This is your master prompt for Claude Code.**

Copy the entire content and paste it into Claude Code to begin development. It contains:
- Project brief
- Core requirements
- Data model summary
- All workflows
- Success metrics
- Development phases

**👉 Use this first**

---

### 2. **SYSTEM_SPEC.md** 📘 Complete Specification
The most detailed document. Reference this when building:
- Executive summary
- Core principles & user roles
- Complete data model with all sheets
- Every workflow detailed step-by-step
- All dashboards & reports
- Anti-fraud controls explained
- Success metrics & compliance

**Use when:** You need full context on any component

---

### 3. **DATA_SCHEMA.md** 🗂️ Database Structure
Exact Google Sheets column definitions:
- Column names, data types, constraints
- Rules for each sheet
- Access control per sheet
- Foreign key relationships
- Data integrity rules
- Week numbering logic
- Calculated fields

**Use when:** Building forms, queries, and database operations

---

### 4. **WORKFLOWS.md** 🔄 Process Flows
Visual ASCII diagrams of all workflows:
- Customer onboarding (rep perspective)
- Owner subscription activation
- Auto-weekly billing generation
- Payment collection & verification
- Weekly reconciliation process
- Payment reminders
- Fraud detection examples
- Subscription cancellation

**Use when:** Understanding how features interact

---

### 5. **QUICK_REFERENCE.md** ⚡ Developer Cheat Sheet
Condensed guide for while you're building:
- Golden rule (sales rep never sees amounts)
- User role matrix
- Core sheets at a glance
- Week format explanation
- Anti-fraud checklist
- Workflows at a glance
- Dashboard views
- Access control implementation
- Development checklist
- Testing checklist
- Common pitfalls to avoid

**Use when:** Quick lookup while coding

---

## 🚀 How to Build with Claude Code

### Step 1: Understand the System (5 mins)
Read this README and glance at QUICK_REFERENCE.md

### Step 2: Copy the Master Prompt (1 min)
Open CLAUDE_CODE_PROMPT.md and copy everything

### Step 3: Paste into Claude Code (1 min)
- Open Claude Code
- Create new project
- Paste the entire CLAUDE_CODE_PROMPT.md content
- Click "Continue"

### Step 4: Build Phase 1 (Week 1-2)
Claude Code will help you build:
- [ ] Sales rep subscription form
- [ ] Subscription list (own only)
- [ ] Owner subscription approval
- [ ] Manual weekly billing
- [ ] Payment verification form
- [ ] Basic reconciliation

### Step 5: Reference Docs During Development
As you build, open:
- **DATA_SCHEMA.md** → for exact column names & types
- **WORKFLOWS.md** → for process logic
- **QUICK_REFERENCE.md** → for quick lookups
- **SYSTEM_SPEC.md** → for comprehensive details

### Step 6: Build Phase 2 & 3 (Week 3+)
Automation and integrations:
- Auto-weekly billing generation
- Advanced reports
- FB Messenger integration (optional)
- GCash API integration (optional)

---

## 📖 Recommended Reading Order

**For Developers:**
1. QUICK_REFERENCE.md (5 mins) ← Start here
2. CLAUDE_CODE_PROMPT.md (10 mins) ← Your build guide
3. DATA_SCHEMA.md (reference as needed)
4. WORKFLOWS.md (reference as needed)
5. SYSTEM_SPEC.md (comprehensive reference)

**For Project Managers:**
1. SYSTEM_SPEC.md (read: Overview, Core Principles, Workflows)
2. QUICK_REFERENCE.md (read: Red Flags, Success Criteria)
3. All workflow diagrams in WORKFLOWS.md

**For QA/Testing:**
1. QUICK_REFERENCE.md (read: Testing Checklist, Common Pitfalls)
2. WORKFLOWS.md (read: Fraud Detection scenarios)
3. SYSTEM_SPEC.md (read: Anti-Fraud Controls section)

---

## 🎯 The Core Requirement (Remember This!)

### 🚫 Sales Rep NEVER Sees:
- Pricing (₱3,500)
- Payment status
- Payment methods
- Financial reports
- Other reps' customers
- Edit/Delete buttons
- PAYMENTS sheet (entirely)
- PRICING_CONFIG sheet

### ✅ Sales Rep CAN See:
- Their own subscriptions
- Customer name, address, phone
- Meal plan, quantity
- Allergies, food requests
- Subscription status (Active/Inactive)

This separation prevents fraud where reps pocket payments without recording orders.

---

## 🔐 Key Security Rules

1. **Immutability** - Subscriptions created by rep cannot be edited by rep
2. **Access Control** - Rep has zero access to PAYMENTS or PRICING_CONFIG
3. **Amount Hiding** - No pricing shown to rep anywhere
4. **Audit Trail** - Every action logged for fraud detection
5. **Bank Reconciliation** - Owner verifies payments against actual deposits
6. **Rep Performance** - Dashboard shows which reps have low verification rates

---

## 📊 Data Model at a Glance

```
SUBSCRIPTIONS (immutable after rep creation)
  ├─ subscription_id, customer_name, customer_address, customer_phone
  ├─ meal_plan, quantity, allergies, food_requests
  ├─ start_date, is_active, created_by, created_at
  └─ internal_notes (owner only)

WEEKLY_BILLINGS (auto-generated every Sunday)
  ├─ billing_id, subscription_id, billing_week, billing_month
  ├─ week_start_date, week_end_date, amount_php, status
  └─ customer_name, meal_plan, created_by, created_at

PAYMENTS (owner-only creation)
  ├─ payment_id, billing_id, subscription_id, amount_php
  ├─ payment_method, customer_reference, proof_of_payment
  ├─ recorded_date, verified_by, verified_at, status
  └─ [SALES REP HAS ZERO ACCESS]

PRICING_CONFIG (owner configuration)
  ├─ meal_plan_name, price_per_week, num_days, active
  └─ [HIDDEN FROM SALES REP]

AUDIT_LOG (immutable record of all actions)
  ├─ log_id, timestamp, user_id, user_role, action
  ├─ record_id, record_type, details, ip_address
  └─ [APPEND-ONLY]
```

---

## 📈 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 (simple, no external UI libs) |
| Backend | Google Apps Script |
| Database | Google Sheets (5 sheets) |
| Auth | Google Sign-In |
| Hosting | GitHub Pages + Apps Script |
| Local State | localStorage (UI preferences only) |

---

## ✨ Features by Phase

### Phase 1: MVP (Week 1-2)
- ✅ Sales rep subscription creation
- ✅ Owner subscription management
- ✅ Manual weekly billing
- ✅ Payment verification
- ✅ Basic reconciliation

### Phase 2: Automation (Week 3)
- ✅ Auto-weekly billing (Sunday trigger)
- ✅ Rep performance dashboard
- ✅ Monthly reports
- ✅ Advanced filtering

### Phase 3: Integration (Week 4+)
- ✅ FB Messenger integration
- ✅ GCash API auto-confirmation
- ✅ Email/SMS reminders

---

## 🧪 Testing Strategy

### Security Testing
```
[ ] Rep cannot access PAYMENTS sheet (403 Forbidden)
[ ] Rep cannot access PRICING_CONFIG (403 Forbidden)
[ ] Rep cannot edit other reps' subscriptions
[ ] Rep subscriptions are read-only after creation
[ ] Owner can access everything
```

### Data Integrity Testing
```
[ ] Cannot create subscription without required fields
[ ] Cannot create billing without active subscription
[ ] Billing amount = pricing × quantity (no discrepancies)
[ ] Weekly billing generation creates no duplicates
[ ] Amount calculations are server-side only
```

### Fraud Detection Testing
```
[ ] Audit log records all actions with timestamps
[ ] If customer claims they enrolled but no subscription exists → fraud evident
[ ] Bank reconciliation catches missing payments
[ ] Rep performance metric shows suspicious reps
[ ] Cannot hide payments without audit trail
```

---

## ⚠️ Common Pitfalls

### DON'T:
1. ❌ Show pricing to sales rep
2. ❌ Let rep edit subscriptions after creation
3. ❌ Allow rep to access PAYMENTS sheet
4. ❌ Skip audit logging
5. ❌ Calculate amounts on frontend
6. ❌ Trust rep to enter payment amounts
7. ❌ Skip bank reconciliation
8. ❌ Ignore low verification rates
9. ❌ Allow manual week billing entry (make it auto)
10. ❌ Store sensitive data in localStorage

### DO:
1. ✅ Hide all amounts from rep
2. ✅ Make subscriptions immutable for rep
3. ✅ Restrict PAYMENTS to owner-only
4. ✅ Log everything with timestamps
5. ✅ Calculate amounts in backend
6. ✅ Owner enters payment amounts only
7. ✅ Reconcile weekly vs bank deposits
8. ✅ Monitor rep performance metrics
9. ✅ Lock timestamps (immutable)
10. ✅ Auto-generate billings on schedule

---

## 📞 Key Questions for Claude Code

When Claude Code asks you questions, here are the answers:

### "How should I structure the frontend?"
→ React with separate components for Sales Rep Dashboard and Owner Dashboard. No external UI libraries.

### "How do I handle role-based access?"
→ Check user_role on every API call. Return 403 Forbidden for unauthorized access.

### "How do I auto-generate weekly billings?"
→ Use Google Apps Script time-based trigger (every Sunday 11 PM) or manual owner button.

### "How do I prevent duplicates in weekly billing?"
→ Check if billing already exists for (subscription_id + billing_week) before creating.

### "Where do I store proof_of_payment files?"
→ Google Drive folder or base64 in sheet (depends on file size).

### "How do I calculate week identifiers?"
→ Find the week's Saturday, use that month for YYYY-MM, count week number in that month.

### "How do I verify payments?"
→ Owner manually checks GCash account or bank statement, then marks PAYMENT.verified_by and verified_at.

### "How do I detect fraud?"
→ Monitor rep performance (orders created vs verified payments %), bank reconciliation (deposits vs verified), audit log for impossible timestamps.

---

## 🎓 Learning Resources

### From the Docs:

**Understanding the Problem:**
- Read: SYSTEM_SPEC.md → "Anti-Fraud Controls" section
- This explains WHY the system is designed this way

**Understanding the Solution:**
- Read: WORKFLOWS.md → "Workflow 4: Payment Verification"
- This shows HOW payments are verified independently

**Understanding the Details:**
- Read: DATA_SCHEMA.md → "PAYMENTS Sheet"
- This shows WHAT data to collect

---

## ✅ Success Checklist

When your system is complete, verify:

- [ ] Sales rep CANNOT see any pricing
- [ ] Sales rep CANNOT access PAYMENTS sheet
- [ ] Sales rep subscriptions are immutable
- [ ] Owner CAN view everything
- [ ] Weekly billings auto-generate every Sunday
- [ ] Owner payment verification requires bank/GCash confirmation
- [ ] Weekly reconciliation shows bank vs system match
- [ ] Audit log records everything with timestamps
- [ ] Rep performance dashboard shows low performers
- [ ] Zero fraud possible without being detected

---

## 📝 Notes for Your Friend

When showing your friend the system:

1. **For Sales Reps:**
   - "You enter customer details, we generate an ID"
   - "Never see pricing - just manages customer subscriptions"
   - "Cannot edit orders once created - prevents mistakes"

2. **For the Owner:**
   - "Full visibility into all subscriptions and payments"
   - "Weekly reconciliation prevents rep fraud automatically"
   - "Dashboard shows which reps need attention"
   - "Audit log proves everything that happened"

3. **For Customers:**
   - "Your subscription renews weekly (flexible cancellation)"
   - "Payment options: GCash, Bank Transfer, COD"
   - "Delivery next Friday/Saturday after payment confirmed"

---

## 🎯 Next Steps

1. Download all 5 markdown files from outputs
2. Read QUICK_REFERENCE.md (5 mins)
3. Open Claude Code
4. Copy CLAUDE_CODE_PROMPT.md and paste into Claude Code
5. Start building Phase 1 (subscription creation)
6. Reference other docs as needed during development
7. Build iteratively (Phase 1 → Phase 2 → Phase 3)

---

## 💡 Pro Tips

1. **Bookmark QUICK_REFERENCE.md** - You'll reference it constantly
2. **Keep DATA_SCHEMA.md open** - Exact column names matter
3. **Test access control heavily** - This is your fraud prevention
4. **Log everything** - Audit trail is your safety net
5. **Calculate amounts server-side** - Never on frontend
6. **Do bank reconciliation manually first** - Before automating
7. **Start with Phase 1 MVP** - Don't build Phase 3 before Phase 1 works

---

## 📧 Questions?

If you get stuck:
1. Check QUICK_REFERENCE.md (common pitfalls)
2. Read relevant WORKFLOWS.md section
3. Verify column names in DATA_SCHEMA.md
4. Review access control in QUICK_REFERENCE.md
5. Ask Claude Code directly ("How do I...")

---

**Good luck building OrderFlow! Your friend's business is going to run much more smoothly with fraud prevention built in from day one.** 🚀

---

**Version:** 1.0  
**Last Updated:** June 2026  
**Status:** Ready for development
