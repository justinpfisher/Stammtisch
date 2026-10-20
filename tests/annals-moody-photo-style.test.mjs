/* Editorial photo treatment must not masquerade as the signed source. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css=readFileSync(new URL('../annals-photos.css',import.meta.url),'utf8');
const photoUi=readFileSync(new URL('../annals-photos.mjs',import.meta.url),'utf8');
const guide=readFileSync(new URL('../docs/brand-editorial-style-guide.md',import.meta.url),'utf8');
const archive=readFileSync(new URL('../annals.html',import.meta.url),'utf8');
const production=readFileSync(new URL('../scripts/annals/apply-approved-entry.mjs',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../.github/workflows/annals-publish.yml',import.meta.url),'utf8');
const backfill=readFileSync(new URL('../.github/workflows/annals-photo-style.yml',import.meta.url),'utf8');
const style=readFileSync(new URL('../scripts/annals/cocktail-image-style.py',import.meta.url),'utf8');

test('the approved direction is actual visual editing, never a CSS surround',()=>{
  assert.match(guide,/Moody & Atmospheric \(option 2\)/);
  assert.match(guide,/actual background separation/);
  assert.match(guide,/Original photograph/);
  assert.match(guide,/not evidence of a different venue/);
  assert.match(guide,/without an additional external AI subscription/);
  assert.match(css,/background:transparent/);
  assert.match(css,/filter:none/);
  assert.doesNotMatch(css,/filter:contrast\(1\.04\) brightness\(\.96\) saturate\(\.96\)/);
});

test('image styling remains scoped to cocktails and preserves full original access',()=>{
  assert.match(css,/\.annal-entry\[data-annals-category="cocktail"\] \.annal-gallery/);
  assert.match(css,/\.photos-card\[data-photos-collection="cocktail"\] \.photos-grid/);
  assert.match(photoUi,/card\.dataset\.photosCollection=row\.collection/);
  assert.match(photoUi,/a\.dataset\.styledSrc/);
  assert.match(photoUi,/data-original/);
  assert.match(photoUi,/Original photograph/);
  assert.match(photoUi,/photo.*styleCocktailPreviews|styleCocktailPreviews/);
  assert.match(photoUi,/img\.alt=p\.alt/);
  assert.match(photoUi,/a\.href=p\.src/);
});

test('the source-first publishing gate precedes optional styling',()=>{
  assert.match(production,/buildPublishedAnnals\(entries, approvals, secret, history\)/);
  assert.match(workflow,/node scripts\/annals\/apply-approved-entry\.mjs/);
  assert.match(workflow,/python scripts\/annals\/cocktail-image-style\.py/);
  assert.ok(workflow.indexOf('node scripts/annals/apply-approved-entry.mjs') <
            workflow.indexOf('python scripts/annals/cocktail-image-style.py'));
  assert.match(production,/styled-v1\.jpg/);
  assert.match(style,/hashlib\.sha256\(data\)\.hexdigest\(\) != expected/);
  assert.match(style,/if entry\.get\("category"\) != "cocktail":/);
  assert.match(style,/insufficient_confidence/);
  assert.doesNotMatch(style,/requests\.get|https:\/\//);
});

test('one-time approved originals are re-verified before backfill',()=>{
  assert.match(backfill,/buildPublishedAnnals\(data.entries,data.approvals,secret,history\)/);
  assert.match(backfill,/--verify-only --strict/);
  assert.match(backfill,/--index data\/annals-approved\.json/);
  assert.match(backfill,/gh api --method POST repos\/justinpfisher\/Stammtisch\/pages\/builds/);
  assert.match(backfill,/paths:\s*\n\s*- scripts\/annals\/cocktail-image-style\.py/);
});

test('original signed Kingston Windfall image and entry remain sources',()=>{
  assert.match(archive,/data-annals-category="cocktail"/);
  assert.match(archive,/Kingston Windfall/);
  assert.match(archive,/<img src="assets\/annals\/annal-[a-f0-9]+\.jpg"/);
});
