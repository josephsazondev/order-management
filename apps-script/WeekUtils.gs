/**
 * WeekUtils.gs — week-numbering logic (backend mirror of web/src/lib/week.js).
 *
 * Billing week = Sunday..Saturday. The week is labelled by the month its SATURDAY
 * (week end) falls in, numbered sequentially within that month: YYYY-MM-WN.
 *
 * This corrects the algorithm sketched in DATA_SCHEMA.md (which anchored on the first
 * Sunday and produced W0 for cross-month weeks). We anchor on the first SATURDAY of the
 * ending month. Verified against all examples in DATA_SCHEMA.md.
 */

var MS_PER_DAY = 24 * 60 * 60 * 1000;

function wuPad2_(n) {
  return ('0' + n).slice(-2);
}

/** Coerce a 'YYYY-MM-DD' string or Date to a local-midnight Date. */
function wuToDate_(input) {
  if (input instanceof Date) {
    return new Date(input.getFullYear(), input.getMonth(), input.getDate());
  }
  var parts = String(input).split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function wuAddDays_(date, days) {
  var d = wuToDate_(date);
  d.setDate(d.getDate() + days);
  return d;
}

function wuFormatDate_(date) {
  var d = wuToDate_(date);
  return d.getFullYear() + '-' + wuPad2_(d.getMonth() + 1) + '-' + wuPad2_(d.getDate());
}

function wuWeekStart_(date) {
  var d = wuToDate_(date);
  return wuAddDays_(d, -d.getDay()); // 0 = Sunday
}

function wuWeekEnd_(date) {
  return wuAddDays_(wuWeekStart_(date), 6);
}

function wuFirstSaturdayOfMonth_(year, monthIndex) {
  var first = new Date(year, monthIndex, 1);
  var offset = (6 - first.getDay() + 7) % 7;
  return wuAddDays_(first, offset);
}

/** Returns { weekId, billingMonth, weekStart, weekEnd, weekNumber }. */
function getWeekInfo(date) {
  var weekStart = wuWeekStart_(date);
  var weekEnd = wuWeekEnd_(date);
  var year = weekEnd.getFullYear();
  var monthIndex = weekEnd.getMonth();
  var firstSat = wuFirstSaturdayOfMonth_(year, monthIndex);
  var weekNumber = Math.round((weekEnd - firstSat) / (7 * MS_PER_DAY)) + 1;
  var billingMonth = year + '-' + wuPad2_(monthIndex + 1);
  return {
    weekId: billingMonth + '-W' + weekNumber,
    billingMonth: billingMonth,
    weekStart: wuFormatDate_(weekStart),
    weekEnd: wuFormatDate_(weekEnd),
    weekNumber: weekNumber,
  };
}

function getWeekIdentifier(date) {
  return getWeekInfo(date).weekId;
}

function billingMonthFromWeekId(weekId) {
  return weekId.split('-W')[0];
}
