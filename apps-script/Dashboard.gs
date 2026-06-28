/**
 * Dashboard.gs — OWNER collection dashboard, derived from active subscriptions vs payments.
 */

function weekOptions_(payload, user) {
  requirePermission_(user, 'dashboard', 'read');
  var current = getWeekIdentifier(todayISO_());
  var seen = {};
  readObjects(CONFIG.SHEETS.PAYMENTS).forEach(function (p) { seen[p.week_group] = true; });
  seen[current] = true;
  var weeks = Object.keys(seen).sort().reverse();
  return { weeks: weeks, current: current };
}

function weeklyDashboard_(payload, user) {
  requirePermission_(user, 'dashboard', 'read');
  var week = payload.week_group || getWeekIdentifier(todayISO_());
  var settings = readSettings_();
  var active = liveSubs_().filter(function (s) { return isTrue_(s.is_active); });
  var pays = readObjects(CONFIG.SHEETS.PAYMENTS).filter(function (p) { return p.week_group === week; });
  var verifiedBySub = {};
  pays.forEach(function (p) { if (p.status === 'Verified') verifiedBySub[p.subscription_id] = p; });

  var expectedTotal = 0, collected = 0, byProduct = {}, unpaid = [];
  active.forEach(function (s) {
    var amt = priceFor_(s.product) * Number(s.quantity);
    expectedTotal += amt;
    if (!byProduct[s.product]) byProduct[s.product] = { count: 0, amount: 0 };
    byProduct[s.product].count += 1;
    byProduct[s.product].amount += amt;
    if (verifiedBySub[s.subscription_id]) {
      collected += Number(verifiedBySub[s.subscription_id].amount_php);
    } else {
      var recorded = pays.filter(function (p) { return p.subscription_id === s.subscription_id; })[0];
      unpaid.push({
        subscription_id: s.subscription_id, customer_name: s.customer_name, customer_phone: s.customer_phone,
        product: s.product, expected_amount: amt, payment_status: recorded ? recorded.status : 'No payment',
      });
    }
  });
  return {
    week_group: week, activeCount: active.length, expectedTotal: expectedTotal, collected: collected,
    outstanding: expectedTotal - collected, byProduct: byProduct, unpaid: unpaid,
    overdueDays: Number(settings.overdue_days) || 3,
  };
}
