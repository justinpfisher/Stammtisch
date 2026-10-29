import test from 'node:test';
import assert from 'node:assert/strict';
import { entriesLabel } from '../annals-photos.mjs';

test('photo archive count uses singular and plural wording correctly', () => {
  assert.equal(entriesLabel(0), '0 entries');
  assert.equal(entriesLabel(1), '1 entry');
  assert.equal(entriesLabel(2), '2 entries');
});
