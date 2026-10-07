import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ageAt, basePoints, multiplierFor, selectionValue, rankedMembers, matchesPick, groupedCommemorations, escapeHtml, pickMarkup, mountCelebration } from '../celebration.mjs';
import { awardEvents } from '../celebration-awards.mjs';

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
  assert.ok(data.members.reduce((sum, member) => sum + member.picks.length, 0) >= 300);
  for (const member of data.members) {
    assert.equal(member.picks.filter(pick => typeof pick.pick === 'number').length, 50);
    assert.equal(member.picks.filter(pick => pick.counted).reduce((sum, pick) => sum + pick.points, 0), member.score);
  }
  const ranked = rankedMembers(data.members);
  assert.equal(ranked[0].rank, 1);
  assert.ok(ranked.every((member, index) => index === 0 || member.score <= ranked[index - 1].score));
});

test('Dolly has the verified date and earns 20 points exactly once', () => {
  const jamie = data.members.find(m => m.id === 'jamie');
  const dolly = jamie.picks.find(p => p.name === 'Dolly Parton');
  assert.equal(dolly.dateOfPassing, '2026-08-25');
  assert.equal(dolly.needsReview, false);
  assert.equal(basePoints(ageAt(dolly.born, dolly.dateOfPassing)), 20);
  assert.equal(selectionValue(dolly, data.asOf), 20);
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
  for (const name of ['David Attenborough', 'Mel Brooks']) {
    const pick = picks.find(p => p.name === name && !p.counted);
    assert.ok(pick, name + ' remains a selection in this season');
    assert.equal(selectionValue(pick, data.asOf), basePoints(ageAt(pick.born, data.asOf)) * multiplierFor(pick));
  }
  assert.equal(multiplierFor(picks.find(p => p.name === 'Kid Rock')), 2);
  assert.equal(selectionValue({ born: '1925-01-01', counted: false, pick: 1 }, '2026-09-19'), -2);
});

test('double-point selections survive formula rewrites and pasted values', () => {
  for (const pick of [1, 50]) {
    for (const pointsFormula of [null, '2*ROUNDUP(...)', 'ROUNDUP(...)*2']) {
      const entry = { pick, pointsFormula, points: 40, born: '1946-01-19', counted: false };
      assert.equal(multiplierFor(entry), 2);
      assert.equal(selectionValue(entry, '2026-09-19'), 40);
      assert.ok(matchesPick({ ...entry, name: 'Example' }, '', 'double'));
    }
  }
  for (const member of data.members) {
    assert.ok(member.picks.find(p => p.pick === 1 && multiplierFor(p) === 2));
    assert.ok(member.picks.find(p => p.pick === 50 && multiplierFor(p) === 2));
  }
  assert.equal(multiplierFor({ pick: 2, marker: 'diamond' }), 2);
  assert.equal(multiplierFor({ pick: 2, marker: null }), 1);
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


test('Eva Marie Saint verified passing follows the club record without double-counting', () => {
  const jerome = data.members.find(m => m.id === 'jerome');
  const eva = jerome.picks.find(p => p.name === 'Eva Marie Saint');
  assert.ok(eva, 'Eva remains selection #13 for Jerome');
  assert.equal(eva.pick, 13);
  assert.equal(eva.born, '1924-07-04');
  assert.equal(eva.actualDeathDate, '2026-10-06');
  assert.equal(eva.points, -2);
  assert.equal(ageAt(eva.born, eva.actualDeathDate), 102);
  assert.ok(eva.actualDeathSource.sourceUrl.startsWith('https://www.reuters.com/'));
  assert.ok(matchesPick(eva, 'eva marie', 'commemorations'));
  assert.ok(!matchesPick(eva, '', 'unflagged'));
  const commemorations = groupedCommemorations(data.members);
  assert.equal(commemorations.filter(p => p.name === 'Eva Marie Saint').length, 1);
  const commemoration = commemorations.find(p => p.name === 'Eva Marie Saint');
  assert.equal(commemoration.actualDeathDate, '2026-10-06');
  assert.deepEqual(commemoration.members.map(m => m.name), ['Jerome']);
  // The official total must be the sum of *counted* selections, regardless
  // of whether this revision of the workbook has awarded Eva's penalty.
  assert.equal(jerome.score, jerome.picks.filter(p => p.counted).reduce((n, p) => n + p.points, 0));
  assert.equal(selectionValue(eva, data.asOf), -2);
  const html = pickMarkup(eva, jerome, data);
  assert.match(html, /Reuters report/);
  const event = awardEvents(data).find(x => x.name === 'Eva Marie Saint');
  assert.ok(event);
  if (eva.counted) {
    assert.ok(eva.dateOfPassing, 'scored passing must have a group-recorded date');
    assert.equal(commemoration.dateOfPassing, eva.dateOfPassing);
    assert.match(html, /In remembrance/);
    assert.match(html, /Date recorded by group/);
    assert.match(html, /Points in the standings/);
    assert.ok(!html.includes('Club score pending'));
    assert.equal(event.inSeason, data.asOf >= eva.actualDeathDate);
  } else {
    assert.match(html, /Not yet awarded/);
    if (eva.dateOfPassing) {
      assert.match(html, /Date recorded by group/);
    } else {
      assert.equal(commemoration.dateOfPassing, null);
      assert.match(html, /Club score pending/);
      assert.match(html, /Verified date of death/);
      assert.match(html, /Potential points \(not yet in standings\)/);
    }
  }
});

test('post-snapshot confirmed death can become recorded without duplicate points', () => {
  const copy = structuredClone(data);
  const jerome = copy.members.find(m => m.id === 'jerome');
  const eva = jerome.picks.find(p => p.name === 'Eva Marie Saint');
  const priorCounted = eva.counted;
  const priorScore = jerome.score;
  eva.dateOfPassing = '2026-10-06';
  eva.counted = true;
  eva.points = -2;
  jerome.score = priorScore + (priorCounted ? 0 : -2);
  copy.asOf = '2026-10-07';
  assert.equal(eva.actualDeathDate, '2026-10-06');
  assert.equal(jerome.score, jerome.picks.filter(p => p.counted).reduce((n,p) => n+p.points, 0));
  assert.equal(selectionValue(eva, copy.asOf), -2);
  assert.match(pickMarkup(eva, jerome, copy), /Points in the standings/);
  assert.equal(awardEvents(copy).filter(x => x.name === 'Eva Marie Saint').length, 1);
});

test('failed register fetch renders fallback rather than crashing', async () => {
  const previousDocument = globalThis.document;
  const previousFetch = globalThis.fetch;
  const selectors = ['#award-leaders', '#draft-benefits', '#standings', '#member-lists', '#commemoration-list'];
  const nodes = Object.fromEntries(selectors.map(s => [s, { innerHTML: '' }]));
  globalThis.document = { querySelector: s => {
    if (!(s in nodes)) throw new Error('Unexpected fallback selector: ' + s);
    return nodes[s];
  } };
  let request;
  globalThis.fetch = async (...args) => { request = args; throw new Error('offline'); };
  try {
    await mountCelebration();
    for (const selector of selectors) assert.ok(nodes[selector].innerHTML.length, selector);
    assert.match(nodes['#commemoration-list'].innerHTML, /original spreadsheet/);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousFetch === undefined) delete globalThis.fetch;
    else globalThis.fetch = previousFetch;
  }
});
