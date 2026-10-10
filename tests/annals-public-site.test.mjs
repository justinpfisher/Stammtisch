import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('empty Annals site is connected throughout the website and contains no invented entries', () => {
  const data = JSON.parse(read('../data/annals-approved.json'));
  const annals = read('../annals.html');
  assert.equal(data.schemaVersion, 1);
  assert.deepEqual(data.entries, []);
  assert.match(annals, /The Annals of Stammtisch/);
  assert.match(annals, /No approved entries in this collection yet/);
  assert.match(annals, /mailto:annals@stammtischbrewery\.com/);
  assert.match(annals, /submission is considered privately/);
  assert.doesNotMatch(annals, /sample-cocktail|fictional|example\.test/i);
  for (const file of ['../index.html', '../celebration.html', '../location.html']) {
    assert.match(read(file), /href="annals\.html"/);
  }
  assert.match(read('../index.html'), /annals-teaser-title/);
});

