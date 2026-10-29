import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { entriesLabel } from '../annals-photos.mjs';

test('photo archive count uses singular and plural wording correctly', () => {
  assert.equal(entriesLabel(0), '0 entries');
  assert.equal(entriesLabel(1), '1 entry');
  assert.equal(entriesLabel(2), '2 entries');
});

test('photo page versions its module URL when the module changes', () => {
  const html = readFileSync(new URL('../photos.html', import.meta.url), 'utf8');
  assert.match(html, /<script type="module" src="annals-photos\.mjs\?v=[a-f0-9]+"><\/script>/);
});
