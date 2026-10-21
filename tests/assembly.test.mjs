import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { countdownParts } from '../assembly.mjs';

const start = Date.parse('2027-02-05T09:00:00-05:00');

test('February Assembly uses Eastern standard time', () => {
  assert.equal(new Date(start).toISOString(), '2027-02-05T14:00:00.000Z');
  assert.deepEqual(countdownParts(start, start - 90_060_000), { days: 1, hours: 1, minutes: 1, convened: false });
});

test('last partial minute stays pending, then switches at the start', () => {
  assert.deepEqual(countdownParts(start, start - 1), { days: 0, hours: 0, minutes: 1, convened: false });
  assert.equal(countdownParts(start, start).convened, true);
  assert.equal(countdownParts(start, start + 86_400_000).convened, true);
  assert.equal(countdownParts(NaN, start), null);
});

test('both pages and calendar agree on the confirmed start', () => {
  for (const file of ['index.html', 'location.html']) {
    const html = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    const datetime = html.match(/data-assembly-start datetime="([^"]+)"/)[1];
    assert.equal(Date.parse(datetime), start);
    assert.ok(!html.includes('2026'));
    assert.ok(!html.includes('mightly'));
  }
  const calendar = readFileSync(new URL('../assembly-2027.ics', import.meta.url), 'utf8');
  assert.ok(calendar.includes('DTSTART:20270205T140000Z\r\n'));
  assert.ok(!calendar.includes('DTEND'));
  assert.ok(calendar.includes('END:VCALENDAR\r\n'));
  for (const line of calendar.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
});

test('future Assembly publicity does not identify the private booked property', () => {
  for(const file of ['index.html','location.html']){
    const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');
    assert.match(html,/Huntsville/,'general location remains in the Club record');
    assert.doesNotMatch(html,/airbnb\.ca\/rooms\/|a0\.muscache\.com\/im\/pictures\/|Big East River|Near Arrowhead|Hosting-605759557639781130/i,
      'property-specific links, photographs and clues must stay private');
  }
  const home=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(home,/src="assets\/crest\.webp"/);
  const assembly=readFileSync(new URL('../location.html',import.meta.url),'utf8');
  assert.match(assembly,/booking and access details are circulated privately/);
});
