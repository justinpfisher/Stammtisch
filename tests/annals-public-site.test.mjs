import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('empty Annals archive is discoverable and contains no invented entries', () => {
  const data = JSON.parse(read('../data/annals-approved.json'));
  const annals = read('../annals.html');
  assert.equal(data.schemaVersion, 1);
  assert.deepEqual(data.entries, []);
  assert.deepEqual(data.approvals, []);
  assert.match(annals, /The Annals of Stammtisch/);
  assert.match(annals, /The first approved contribution will appear here/);
  assert.doesNotMatch(annals, /class="annal-collections"|class="annal-collection"|No approved entries in this collection yet/);
  assert.doesNotMatch(annals, /The Cocktail Register|Quotations of Questionable Wisdom|Monthly Proceedings|Annual Assemblies|Club History|Club Artefacts/);
  assert.match(annals, /mailto:annals@stammtischbrewery\.com/);
  assert.match(annals, /submission is considered privately/);
  assert.doesNotMatch(annals, /sample-cocktail|fictional|example\.test/i);
  const home = read('../index.html');
  const assembly = read('../location.html');
  assert.match(home, /href="annals\.html"/);
  assert.match(home, /annals-teaser-title/);
  assert.match(assembly, /href="annals\.html"/);
  assert.match(annals, /href="annals\.html" aria-current="page"/);
});
