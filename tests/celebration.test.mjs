import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ageAt, basePoints, multiplierFor, selectionValue, rankedMembers, matchesPick, groupedCommemorations, escapeHtml } from '../celebration.mjs';

const data = JSON.parse(readFileSync(new URL('../data/celebration.json', import.meta.url), 'utf8'));

test('scoring handles the centenary exception and later penalties', () => {
  assert.equal(basePoints(80), 20);
  assert.equal(basePoints(99), 1);
  assert.equal(basePoints(100), 10);
  assert.equal(basePoints(101), -1);
  assert.equal(basePoints(102), -2);
  assert.equal(basePoints(-1), null);
  assert.equal(basePoints(80.5), null);
});

test('age changes on the birthday and uses the passing date when supplied', () => {
  assert.equal(ageAt('1926-09-20', '2026-09-19'), 99);
  assert.equal(ageAt('1926-09-20', '2026-09-20'), 100);
  assert.equal(ageAt('1926-09-20', '2027-09-20'), 101);
  assert.equal(ageAt('2000-02-29', '2026-02-28'), 25);
  assert.equal(ageAt('2000-02-29', '2026-03-01'), 26);
  assert.equal(ageAt('1946-01-19', '2026-08-25'), 80);
  assert.equal(ageAt(null, '2026-09-19'), null);
});

test('all imported entries reconcile to recorded standings without awarding uncounted values', () => {
  assert.equal(data.members.length, 6);
  assert.equal(data.members.reduce((sum, member) => sum + member.picks.length, 0), 301);
  for (const member of data.members) {
    assert.equal(member.picks.filter(pick => typeof pick.pick === 'number').length, 50);
    assert.equal(member.picks.filter(pick => pick.counted).reduce((sum, pick) => sum + pick.points, 0), member.score);
  }
  assert.deepEqual(rankedMembers(data.members).map(m => [m.id, m.score]), [['jerome', 109], ['matt', 99], ['marc', 53], ['ken', 27], ['jamie', 25], ['fish', 13]]);
});

test('Dolly has the verified date and earns 20 points exactly once', () => {
  const jamie = data.members.find(m => m.id === 'jamie');
  const dolly = jamie.picks.find(p => p.name === 'Dolly Parton');
  assert.equal(dolly.dateOfPassing, '2026-08-25');
  assert.equal(dolly.needsReview, false);
  assert.equal(basePoints(ageAt(dolly.born, dolly.dateOfPassing)), 20);
  assert.equal(selectionValue(dolly, data.asOf), 20);
  assert.equal(jamie.score, 25);
  assert.ok(dolly.dateSource.sourceUrl.startsWith('https://www.dollyparton.com/'));
});

test('special allocations are preserved and the same person is commemorated once', () => {
  const keegan = groupedCommemorations(data.members).filter(p => p.name === 'Kevin Keegan');
  assert.equal(keegan.length, 1);
  assert.deepEqual(keegan[0].members.map(m => m.points).sort((a, b) => a - b), [12, 13]);
  assert.equal(keegan[0].members.reduce((sum, m) => sum + m.points, 0), 25);
});

test('unawarded values follow centenary rules and source multipliers', () => {
  const picks = data.members.flatMap(m => m.picks);
  assert.equal(selectionValue(picks.find(p => p.name === 'David Attenborough'), data.asOf), 10);
  assert.equal(selectionValue(picks.find(p => p.name === 'Mel Brooks'), data.asOf), 10);
  assert.equal(selectionValue(picks.find(p => p.name === 'Eva Marie Saint'), data.asOf), -2);
  assert.equal(multiplierFor(picks.find(p => p.name === 'Kid Rock')), 2);
  assert.equal(selectionValue({ born: '1925-01-01', counted: false, pointsFormula: 'ROUNDUP(...) * 2' }, '2026-09-19'), -2);
});

test('search is accent-insensitive and combines with the commemoration filter', () => {
  assert.ok(matchesPick({ name: 'Beyoncé' }, 'beyonce'));
  assert.ok(matchesPick({ name: 'Vincent D’Onofrio' }, "d'onofrio"));
  assert.ok(!matchesPick({ name: 'Beyoncé' }, 'beyonce', 'commemorations'));
  assert.ok(matchesPick({ name: 'Dolly Parton', dateOfPassing: '2026-08-25' }, 'dolly', 'commemorations'));
  assert.ok(!matchesPick({ name: 'Unclear', needsReview: true }, '', 'unflagged'));
});

test('tied scores share a rank and source strings cannot inject markup', () => {
  assert.deepEqual(rankedMembers([{name:'A',score:10},{name:'B',score:10},{name:'C',score:5}]).map(m => m.rank), [1,1,3]);
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});
