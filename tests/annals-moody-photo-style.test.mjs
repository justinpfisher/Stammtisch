/* Source-only safeguards for the selected Cocktail Register photographic direction. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../annals-photos.css', import.meta.url), 'utf8');
const photoUi = readFileSync(new URL('../annals-photos.mjs', import.meta.url), 'utf8');
const guide = readFileSync(new URL('../docs/brand-editorial-style-guide.md', import.meta.url), 'utf8');
const archive = readFileSync(new URL('../annals.html', import.meta.url), 'utf8');

test('owner-selected option 2 is the documentary cocktail standard', () => {
  assert.match(guide, /Moody & Atmospheric \(option 2\)/);
  assert.match(guide, /dark forest-green/i);
  assert.match(guide, /authentic drink hues/i);
  assert.match(guide, /signed public image bytes unchanged/i);
  assert.match(guide, /recipe name, recipe description, ingredient list or preparation instructions/);
});

test('dark archival styling only selects Cocktail Register previews', () => {
  assert.match(css, /\.annal-entry\[data-annals-category="cocktail"\] \.annal-gallery figure/);
  assert.match(css, /\.photos-card\[data-photos-collection="cocktail"\] \.photos-grid figure/);
  assert.match(css, /background:#193d32/);
  assert.match(css, /border:1px solid #846329/);
  assert.match(css, /filter:contrast\(1\.04\) brightness\(\.96\) saturate\(\.96\)/);
  assert.doesNotMatch(css.split('/* Moody Cocktail Register photography:')[1], /(?:^|\n)\s*\.photo-viewer img\s*\{/);
  assert.match(css, /@media\(forced-colors:active\), \(prefers-contrast:more\)/);
});

test('gallery index identifies collection without modifying photographic data', () => {
  assert.match(photoUi, /card\.dataset\.photosCollection=row\.collection/);
  assert.match(photoUi, /a\.href=p\.src/);
  assert.match(photoUi, /img\.alt=p\.alt/);
  assert.match(photoUi, /if\(p\.caption\)/);
});

test('existing signed Kingston Windfall photo remains a qualifying original', () => {
  assert.match(archive, /data-annals-category="cocktail"/);
  assert.match(archive, /Kingston Windfall/);
  assert.match(archive, /<img src="assets\/annals\/annal-[a-f0-9]+\.jpg"/);
});
