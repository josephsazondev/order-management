// Unit check for the week-numbering logic against the 5 examples in DATA_SCHEMA.md:318-323.
// Run: node scripts/check-week.mjs   (or: npm run test:week from web/)

import { getWeekInfo } from '../web/src/lib/week.js';

const cases = [
  { date: '2025-06-30', weekId: '2025-07-W1', weekStart: '2025-06-29', weekEnd: '2025-07-05' },
  { date: '2025-07-04', weekId: '2025-07-W1', weekStart: '2025-06-29', weekEnd: '2025-07-05' },
  { date: '2025-07-07', weekId: '2025-07-W2', weekStart: '2025-07-06', weekEnd: '2025-07-12' },
  { date: '2025-07-28', weekId: '2025-08-W1', weekStart: '2025-07-27', weekEnd: '2025-08-02' },
  { date: '2025-08-01', weekId: '2025-08-W1', weekStart: '2025-07-27', weekEnd: '2025-08-02' },
];

let failed = 0;
for (const c of cases) {
  const info = getWeekInfo(c.date);
  const ok =
    info.weekId === c.weekId &&
    info.weekStart === c.weekStart &&
    info.weekEnd === c.weekEnd;
  const mark = ok ? 'PASS' : 'FAIL';
  if (!ok) failed++;
  console.log(
    `${mark}  ${c.date} -> ${info.weekId} (${info.weekStart}..${info.weekEnd})` +
      (ok ? '' : `   expected ${c.weekId} (${c.weekStart}..${c.weekEnd})`)
  );
}

// A few extra sanity cases that round out a month.
const extra = [
  { date: '2025-07-19', weekId: '2025-07-W3' },
  { date: '2025-07-26', weekId: '2025-07-W4' },
  { date: '2025-08-30', weekId: '2025-08-W5' },
];
for (const c of extra) {
  const info = getWeekInfo(c.date);
  const ok = info.weekId === c.weekId;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.date} -> ${info.weekId}` + (ok ? '' : `   expected ${c.weekId}`));
}

if (failed) {
  console.error(`\n${failed} case(s) FAILED`);
  process.exit(1);
}
console.log('\nAll week-numbering cases passed.');
