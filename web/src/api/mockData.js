// Seed dataset for the mock adapter.
// Stores: users, settings, products, subscriptions, payments, invoices, audit.
// seedData() returns a deep clone so "reset demo data" produces a clean copy.

import { DEFAULT_SETTINGS, BUILTIN_ROLE_PERMISSIONS, BUILTIN_ROLE_META } from '../config.js';

function clone(x) {
  return JSON.parse(JSON.stringify(x));
}

// Normalize a customer name (trim, lowercase, collapse whitespace) for best-effort dedup in the
// demo backfill (manual customer_id is the real key).
export function normalizeName(raw) {
  return String(raw == null ? '' : raw).trim().toLowerCase().replace(/\s+/g, ' ');
}

// Seed the ROLES store with the 3 built-ins (mirrors Setup.gs). Built-ins are
// protected: undeletable, name/is_builtin immutable.
const BUILTIN_ROLES = Object.keys(BUILTIN_ROLE_PERMISSIONS).map((roleId) => ({
  role_id: roleId,
  name: (BUILTIN_ROLE_META[roleId] && BUILTIN_ROLE_META[roleId].name) || roleId,
  is_builtin: true,
  permissions: BUILTIN_ROLE_PERMISSIONS[roleId].slice(),
  created_by: 'system',
  created_at: '2025-06-16 09:00:00',
  active: true,
}));

const SEED = {
  // Custom + built-in role definitions (managed by admin in the Roles screen).
  roles: clone(BUILTIN_ROLES),

  // Role assignments live here (managed by admin). Bootstrap admin is also in config.
  users: [
    { email: 'admin@ketolab.com', role: 'admin', assigned_by: 'system', assigned_at: '2025-06-16 09:00:00', active: true },
    { email: 'owner@ketolab.com', role: 'owner', assigned_by: 'admin@ketolab.com', assigned_at: '2025-06-16 09:01:00', active: true },
    { email: 'maria@ketolab.com', role: 'sales_rep', assigned_by: 'admin@ketolab.com', assigned_at: '2025-06-16 09:02:00', active: true },
    { email: 'carlos@ketolab.com', role: 'sales_rep', assigned_by: 'admin@ketolab.com', assigned_at: '2025-06-16 09:03:00', active: true },
  ],

  settings: clone(DEFAULT_SETTINGS),

  // Products (the catalog used in subscriptions). Owner-managed.
  products: [
    { product_name: 'Keto Plan', price_per_week: 3500, num_days: 7, active: true },
    { product_name: 'Standard Plan', price_per_week: 2800, num_days: 7, active: true },
    { product_name: 'Protein+ Plan', price_per_week: 4200, num_days: 7, active: true },
    { product_name: 'Budget Plan', price_per_week: 2000, num_days: 7, active: false },
  ],

  subscriptions: [
    {
      // Older, lapsed subscription for Juan — gives him a 2-entry history in the demo.
      subscription_id: 'SUB-20250601-001', customer_name: 'Juan dela Cruz',
      customer_address: '12 Mabini St, Quezon City, Manila', customer_phone: '09171234567',
      allergy_concerns: 'No shellfish', food_requests: '', product: 'Standard Plan', quantity: 1,
      start_date: '2025-06-01', is_active: false, is_deleted: false,
      created_by: 'maria@ketolab.com', created_at: '2025-06-01 10:00:00', internal_notes: '',
    },
    {
      subscription_id: 'SUB-20250616-001', customer_name: 'Juan dela Cruz',
      customer_address: '12 Mabini St, Quezon City, Manila', customer_phone: '09171234567',
      allergy_concerns: 'No shellfish', food_requests: 'Less oil', product: 'Keto Plan', quantity: 1,
      start_date: '2025-06-16', is_active: true, is_deleted: false,
      created_by: 'maria@ketolab.com', created_at: '2025-06-16 14:30:45', internal_notes: 'Prefers Thursday delivery',
    },
    {
      subscription_id: 'SUB-20250616-002', customer_name: 'Sofia Santos',
      customer_address: '88 Katipunan Ave, Quezon City', customer_phone: '09181112233',
      allergy_concerns: '', food_requests: 'Extra veggies', product: 'Standard Plan', quantity: 2,
      start_date: '2025-06-16', is_active: true, is_deleted: false,
      created_by: 'maria@ketolab.com', created_at: '2025-06-16 15:10:00', internal_notes: '',
    },
    {
      subscription_id: 'SUB-20250617-001', customer_name: 'Pedro Reyes',
      customer_address: '5 Roxas Blvd, Pasay City', customer_phone: '09221234567',
      allergy_concerns: 'No nuts', food_requests: 'High protein', product: 'Protein+ Plan', quantity: 1,
      start_date: '2025-06-17', is_active: true, is_deleted: false,
      created_by: 'carlos@ketolab.com', created_at: '2025-06-17 09:05:20', internal_notes: '',
    },
    {
      subscription_id: 'SUB-20250617-002', customer_name: 'Ana Lim',
      customer_address: '23 Ortigas Ave, Pasig City', customer_phone: '09331234567',
      allergy_concerns: 'Lactose intolerant', food_requests: '', product: 'Keto Plan', quantity: 1,
      start_date: '2025-06-17', is_active: true, is_deleted: false,
      created_by: 'carlos@ketolab.com', created_at: '2025-06-17 11:42:10', internal_notes: '',
    },
    {
      subscription_id: 'SUB-20250618-001', customer_name: 'Jose Ramos',
      customer_address: '7 Aurora Blvd, San Juan', customer_phone: '09441234567',
      allergy_concerns: '', food_requests: 'Diabetic-friendly', product: 'Standard Plan', quantity: 1,
      start_date: '2025-06-18', is_active: true, is_deleted: false,
      created_by: 'maria@ketolab.com', created_at: '2025-06-18 16:20:00', internal_notes: '',
    },
    {
      subscription_id: 'SUB-20250618-002', customer_name: 'Liza Mendoza',
      customer_address: '14 Shaw Blvd, Mandaluyong', customer_phone: '09451234567',
      allergy_concerns: 'No pork', food_requests: 'Halal', product: 'Protein+ Plan', quantity: 1,
      start_date: '2025-06-18', is_active: true, is_deleted: false,
      created_by: 'carlos@ketolab.com', created_at: '2025-06-18 17:05:00', internal_notes: '',
    },
    {
      subscription_id: 'SUB-20250619-001', customer_name: 'Mark Villanueva',
      customer_address: '3 Timog Ave, Quezon City', customer_phone: '09461234567',
      allergy_concerns: '', food_requests: 'No rice', product: 'Keto Plan', quantity: 2,
      start_date: '2025-06-19', is_active: true, is_deleted: false,
      created_by: 'maria@ketolab.com', created_at: '2025-06-19 08:40:00', internal_notes: '',
    },
    {
      subscription_id: 'SUB-20250619-002', customer_name: 'Grace Tan',
      customer_address: '90 Boni Ave, Mandaluyong', customer_phone: '09471234567',
      allergy_concerns: 'No seafood', food_requests: '', product: 'Standard Plan', quantity: 1,
      start_date: '2025-06-19', is_active: false, is_deleted: false,
      created_by: 'carlos@ketolab.com', created_at: '2025-06-19 10:15:00', internal_notes: 'Awaiting confirmation',
    },
    {
      subscription_id: 'SUB-20250619-003', customer_name: 'Ramon Cruz',
      customer_address: '21 EDSA, Cubao', customer_phone: '09481234567',
      allergy_concerns: '', food_requests: 'Extra protein', product: 'Protein+ Plan', quantity: 1,
      start_date: '2025-06-19', is_active: true, is_deleted: false,
      created_by: 'maria@ketolab.com', created_at: '2025-06-19 13:25:00', internal_notes: '',
    },
    {
      subscription_id: 'SUB-20250620-001', customer_name: 'Bea Aquino',
      customer_address: '6 Maginhawa St, Quezon City', customer_phone: '09491234567',
      allergy_concerns: 'No dairy', food_requests: 'Low carb', product: 'Keto Plan', quantity: 1,
      start_date: '2025-06-20', is_active: true, is_deleted: false,
      created_by: 'carlos@ketolab.com', created_at: '2025-06-20 09:00:00', internal_notes: '',
    },
    {
      subscription_id: 'SUB-20250620-002', customer_name: 'Diego Navarro',
      customer_address: '40 Quezon Ave, Quezon City', customer_phone: '09501234567',
      allergy_concerns: '', food_requests: '', product: 'Standard Plan', quantity: 3,
      start_date: '2025-06-20', is_active: true, is_deleted: false,
      created_by: 'maria@ketolab.com', created_at: '2025-06-20 11:30:00', internal_notes: '',
    },
    {
      subscription_id: 'SUB-20250620-003', customer_name: 'Carmen Flores',
      customer_address: '17 Banawe St, Quezon City', customer_phone: '09511234567',
      allergy_concerns: 'No nuts', food_requests: 'Vegetarian', product: 'Protein+ Plan', quantity: 1,
      start_date: '2025-06-20', is_active: false, is_deleted: false,
      created_by: 'carlos@ketolab.com', created_at: '2025-06-20 14:45:00', internal_notes: '',
    },
    {
      subscription_id: 'SUB-20250621-001', customer_name: 'Paolo Reyes',
      customer_address: '8 Congressional Ave, Quezon City', customer_phone: '09521234567',
      allergy_concerns: '', food_requests: 'No spicy', product: 'Keto Plan', quantity: 1,
      start_date: '2025-06-21', is_active: true, is_deleted: false,
      created_by: 'maria@ketolab.com', created_at: '2025-06-21 09:20:00', internal_notes: '',
    },
  ],

  // Payments are tagged to a week_group; no auto-generated billing rows.
  payments: [
    {
      payment_id: 'PAY-2025-07-W1-001', subscription_id: 'SUB-20250616-001', week_group: '2025-07-W1',
      amount_php: 3500, payment_method: 'GCash', customer_reference: 'GCash Ref: ABC123XYZ',
      proof_of_payment: 'https://drive.example/proof-001.jpg', recorded_date: '2025-07-02',
      recorded_by: 'owner@ketolab.com', verified_by: 'owner@ketolab.com', verified_at: '2025-07-02 10:30:00',
      status: 'Verified',
    },
    {
      payment_id: 'PAY-2025-07-W1-002', subscription_id: 'SUB-20250617-001', week_group: '2025-07-W1',
      amount_php: 4200, payment_method: 'Bank Transfer', customer_reference: 'BPI slip #778120',
      proof_of_payment: '', recorded_date: '2025-07-02',
      recorded_by: 'owner@ketolab.com', verified_by: 'owner@ketolab.com', verified_at: '2025-07-02 11:15:00',
      status: 'Verified',
    },
    {
      payment_id: 'PAY-2025-07-W1-003', subscription_id: 'SUB-20250618-001', week_group: '2025-07-W1',
      amount_php: 2800, payment_method: 'GCash', customer_reference: 'GCash Ref: LMN456OPQ',
      proof_of_payment: '', recorded_date: '2025-07-03',
      recorded_by: 'owner@ketolab.com', verified_by: '', verified_at: '',
      status: 'Pending Verification',
    },
  ],

  // Invoices generated from subscriptions (EPIC 5). Numbered INV-000001…
  invoices: [],

  audit: [
    {
      log_id: 1, timestamp: '2025-06-16 14:30:45', user_id: 'maria@ketolab.com', user_role: 'sales_rep',
      action: 'Created Subscription', record_id: 'SUB-20250616-001', record_type: 'SUBSCRIPTION',
      details: '{"customer_name":"Juan dela Cruz","product":"Keto Plan"}', ip_address: '',
    },
    {
      log_id: 2, timestamp: '2025-07-02 10:30:00', user_id: 'owner@ketolab.com', user_role: 'owner',
      action: 'Verified Payment', record_id: 'PAY-2025-07-W1-001', record_type: 'PAYMENT',
      details: '{"subscription_id":"SUB-20250616-001","amount_php":3500}', ip_address: '',
    },
  ],
};

export function seedData(mode = 'full') {
  const db = clone(SEED);
  // Empty seed: keep the operational scaffolding (users, roles, settings, products) so
  // you can still log in and author records, but start with zero transactional data.
  if (mode === 'empty') {
    db.subscriptions = [];
    db.payments = [];
    db.invoices = [];
    db.audit = [];
    db.customers = [];
    return db;
  }
  // Derive the CUSTOMERS master + stamp customer_id onto each subscription, mirroring the
  // one-time backfill the real backend runs (oldest sub per name seeds the record + id).
  const byName = {};
  const customers = [];
  let seq = 0;
  db.subscriptions
    .slice()
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0))
    .forEach((s) => {
      const key = normalizeName(s.customer_name);
      let cust = byName[key];
      if (!cust) {
        seq += 1;
        const datePart = String(s.created_at).slice(0, 10).replace(/-/g, '');
        cust = {
          customer_id: `CUST-${datePart}-${String(seq).padStart(3, '0')}`,
          customer_name: s.customer_name, customer_address: s.customer_address,
          customer_phone: s.customer_phone, allergy_concerns: s.allergy_concerns || '',
          food_requests: s.food_requests || '', created_by: s.created_by,
          created_at: s.created_at, updated_at: s.created_at, is_deleted: false,
        };
        byName[key] = cust;
        customers.push(cust);
      }
      s.customer_id = cust.customer_id;
    });
  db.customers = customers;
  return db;
}
