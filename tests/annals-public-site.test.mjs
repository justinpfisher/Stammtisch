import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPublishedAnnals, contentDigest, validatePublicTextEntry } from '../scripts/annals/ApprovedRenderer.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Annals archive is discoverable and matches the approved public index', () => {
  const data = JSON.parse(read('../data/annals-approved.json'));
  const annals = read('../annals.html');
  assert.equal(data.schemaVersion, 1);
  assert.ok(Array.isArray(data.entries));
  assert.ok(Array.isArray(data.approvals));
  assert.equal(data.entries.length, data.approvals.length);
  assert.equal(new Set(data.entries.map(entry => entry.id)).size, data.entries.length);
  assert.equal(new Set(data.approvals.map(approval => approval.entryId)).size, data.approvals.length);
  for (const entry of data.entries) {
    validatePublicTextEntry(entry);
    const approval = data.approvals.find(item => item.entryId === entry.id);
    assert.ok(approval, 'Every indexed entry has its matching public attestation');
    assert.equal(approval.contentSha256, contentDigest(entry));
    assert.equal(approval.consents.publication, true);
  }
  const renderedIds = [...annals.matchAll(/<article class="annal-entry[^"\n]*" id="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(renderedIds.sort(), data.entries.map(entry => entry.id).sort());
  assert.match(annals, /The Annals of Stammtisch/);
  assert.match(annals, /Members only\./);
  if (data.entries.length === 0) {
    assert.match(annals, /The record awaits an approved contribution/);
    assert.doesNotMatch(annals, /class="annal-collections"|class="annal-collection"/);
  } else {
    assert.doesNotMatch(annals, /The record awaits an approved contribution/);
    for (const category of new Set(data.entries.map(entry => entry.category))) {
      assert.ok(annals.includes('id="collection-' + category.replaceAll('_', '-') + '"'));
    }
  }
  assert.doesNotMatch(annals, /No approved entries in this collection yet/);
  assert.match(annals, /mailto:annals@stammtischbrewery\.com/);
  assert.doesNotMatch(annals, /Only verified material approved for public use|A submission is considered privately/);
  assert.doesNotMatch(annals, /sample-cocktail|example\.test/i);
  const home = read('../index.html');
  const assembly = read('../location.html');
  assert.match(home, /href="annals\.html"/);
  assert.match(home, /annals-teaser-title/);
  assert.match(assembly, /href="annals\.html"/);
  assert.match(annals, /href="annals\.html" aria-current="page"/);
});

test('an empty approved archive retains the empty state without invented collections', () => {
  const { html } = buildPublishedAnnals([], [], 'invented-empty-archive-test-secret');
  assert.match(html, /The record awaits an approved contribution/);
  assert.doesNotMatch(html, /class="annal-collections"|class="annal-collection"|class="annal-entry/);
  assert.doesNotMatch(html, /<h2[^>]*>(?:The Cocktail Register|The Register of Remarks|Monthly Proceedings|Annual Assemblies|Club History|Club Artefacts)<\/h2>/);
  assert.match(html, /The Editorial Committee obscures/);
});
