import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { thirdFridayDay, nextMonthlyGathering } from '../monthly.mjs';

test('third Friday is computed across different month layouts', () => {
  assert.equal(thirdFridayDay(2026, 10), 16);
  assert.equal(thirdFridayDay(2026, 11), 20);
  assert.equal(thirdFridayDay(2026, 12), 18);
  assert.equal(thirdFridayDay(2027, 1), 15);
  assert.equal(thirdFridayDay(2027, 2), 19);
  assert.equal(thirdFridayDay(2028, 2), 18);
  assert.throws(() => thirdFridayDay(2026, 13), RangeError);
});

test('Oct 2026 shows the next Toronto-local third Friday and calendar day count', () => {
  const upcoming = nextMonthlyGathering(new Date('2026-10-08T17:07:00Z'));
  assert.deepEqual(upcoming, {
    isoDate: '2026-10-16', displayDate: 'Friday, October 16, 2026',
    daysRemaining: 8, isToday: false,
  });
  const dayOf = nextMonthlyGathering(new Date('2026-10-16T18:00:00Z'));
  assert.equal(dayOf.isoDate, '2026-10-16');
  assert.equal(dayOf.daysRemaining, 0);
  assert.equal(dayOf.isToday, true);
  const following = nextMonthlyGathering(new Date('2026-10-17T04:01:00Z'));
  assert.equal(following.isoDate, '2026-11-20');
  assert.equal(following.daysRemaining, 34);
});

test('Toronto calendar dates, not UTC midnight or DST hours, determine the countdown', () => {
  assert.equal(nextMonthlyGathering('2026-10-17T03:30:00Z').isoDate, '2026-10-16');
  assert.equal(nextMonthlyGathering('2026-10-17T04:00:00Z').isoDate, '2026-11-20');
  assert.equal(nextMonthlyGathering('2027-01-01T00:00:00Z').isoDate, '2027-01-15');
  assert.equal(nextMonthlyGathering('2027-03-14T03:30:00Z').daysRemaining, 6);
  assert.equal(nextMonthlyGathering('2027-03-14T07:30:00Z').daysRemaining, 5);
  assert.equal(nextMonthlyGathering('invalid-date'), null);
});

test('monthly calendar contains date-only 3rd-Friday recurrence and no private address', () => {
  const ics = readFileSync(new URL('../stammtisch-monthly.ics', import.meta.url), 'utf8');
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261016\r\n'));
  assert.ok(ics.includes('DTEND;VALUE=DATE:20261017\r\n'));
  assert.ok(ics.includes('RRULE:FREQ=MONTHLY;BYDAY=3FR\r\n'));
  assert.ok(ics.includes('TRANSP:TRANSPARENT\r\n'));
  assert.ok(ics.includes('STATUS:TENTATIVE\r\n'));
  assert.ok(!ics.includes('DTSTART;TZID='));
  assert.ok(!ics.includes('LOCATION:'));
  assert.ok(ics.includes('END:VCALENDAR\r\n'));
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
});

test('home distinguishes the monthly date reminder and annual Assembly start', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /data-monthly-gathering/);
  assert.match(html, /data-monthly-date/);
  assert.match(html, /stammtisch-monthly\.ics/);
  assert.match(html, /monthly\.mjs/);
  assert.match(html, /Third Friday of every month/);
  assert.match(html, /often held at headquarters/i);
  assert.match(html, /date-only/i);
  assert.match(html, /data-assembly-start datetime="2027-02-05T09:00:00-05:00"/);
});
