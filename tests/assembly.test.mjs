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

test('Assembly shows the chosen public cottage listing without access secrets', () => {
  for (const file of ['index.html', 'location.html']) {
    const html = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
    assert.match(html, /Huntsville/);
    assert.match(html, /airbnb\.ca\/rooms\/605759557639781130/);
    assert.match(html, /a0\.muscache\.com\/im\/pictures\//);
    assert.match(html, /alt="[^"]*cottage[^"]*"/i);
    assert.doesNotMatch(html, /(?:door|keypad|gate)\s+(?:access\s+)?code\s*[:=]\s*\S+/i);
  }
  const home = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(home, /Photograph from the/);
  const assembly = readFileSync(new URL('../location.html', import.meta.url), 'utf8');
  assert.match(assembly, /arrival instructions and access codes remain in the group chat/);
  assert.match(assembly, /The proceedings must now endeavour to keep pace/);
});
