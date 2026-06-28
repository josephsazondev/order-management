// Week-numbering logic for Ketolab Order Management.
//
// Rule (from SYSTEM_SPEC.md / DATA_SCHEMA.md): a billing week runs Sunday -> Saturday.
// The week is labelled by the month its SATURDAY (week end) falls in, and numbered
// sequentially within that month. Format: YYYY-MM-WN.
//
// NOTE: This corrects the algorithm sketched in DATA_SCHEMA.md:326-347, which anchored
// on the first *Sunday* of the month and produced "W0" for cross-month weeks (e.g. the
// week ending 2025-07-05 came out as 2025-07-W0 instead of W1). We anchor on the first
// SATURDAY that falls in the ending month, which yields the correct W-number for every
// example in the spec.
//
// This file is the single source of truth for the frontend AND is mirrored verbatim
// (same algorithm) in apps-script/WeekUtils.gs for the backend.

// Parse a 'YYYY-MM-DD' string (or Date) into a Date at local midnight, avoiding the
// UTC-shift footgun of `new Date('2025-07-01')`.
export function toDate(input) {
  if (input instanceof Date) {
    return new Date(input.getFullYear(), input.getMonth(), input.getDate());
  }
  const [y, m, d] = String(input).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function formatDate(date) {
  const d = toDate(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function addDays(date, days) {
  const d = toDate(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Most recent Sunday on or before `date` (Sunday = start of the billing week).
export function getWeekStart(date) {
  const d = toDate(date);
  return addDays(d, -d.getDay()); // getDay(): 0 = Sunday
}

// Saturday that ends the billing week containing `date`.
export function getWeekEnd(date) {
  return addDays(getWeekStart(date), 6);
}

// First Saturday that falls within the given (year, monthIndex) — monthIndex is 0-based.
function firstSaturdayOfMonth(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  // Days until the first Saturday (Saturday = day 6).
  const offset = (6 - first.getDay() + 7) % 7;
  return addDays(first, offset);
}

// Returns { weekId, billingMonth, weekStart, weekEnd, weekNumber } for the week
// containing `date`. weekStart/weekEnd are 'YYYY-MM-DD' strings.
export function getWeekInfo(date) {
  const weekStart = getWeekStart(date);
  const weekEnd = getWeekEnd(date);

  // The week belongs to the month its Saturday (weekEnd) lands in.
  const year = weekEnd.getFullYear();
  const monthIndex = weekEnd.getMonth();

  const firstSat = firstSaturdayOfMonth(year, monthIndex);
  const weekNumber = Math.round((weekEnd - firstSat) / (7 * 24 * 60 * 60 * 1000)) + 1;

  const billingMonth = `${year}-${pad2(monthIndex + 1)}`;
  const weekId = `${billingMonth}-W${weekNumber}`;

  return {
    weekId,
    billingMonth,
    weekStart: formatDate(weekStart),
    weekEnd: formatDate(weekEnd),
    weekNumber,
  };
}

// Convenience: just the 'YYYY-MM-WN' identifier.
export function getWeekIdentifier(date) {
  return getWeekInfo(date).weekId;
}

// 'YYYY-MM' month extracted from a week identifier.
export function billingMonthFromWeekId(weekId) {
  return weekId.split('-W')[0];
}
