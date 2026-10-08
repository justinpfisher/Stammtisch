import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const get = (name) => readFileSync(new URL('../' + name, import.meta.url));

function pngSize(path) {
  const b = get(path);
  assert.equal(b.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

test('approved and derived Home Screen icons exist at the correct sizes', () => {
  const icons = [
    ['assets/stammtisch-app-icon-approved.png', 1024],
    ['apple-touch-icon.png', 180],
    ['assets/app-icon-192.png', 192],
    ['assets/app-icon-512.png', 512],
    ['assets/app-icon-maskable-512.png', 512],
    ['assets/favicon.png', 64],
  ];
  for (const [path, size] of icons) {
    assert.deepEqual(pngSize(path), [size, size], path);
  }
});

test('all public pages declare the approved iOS icon and short name', () => {
  const pages = [
    ['index.html', '/site-manifest.json?v=crest2'],
    ['location.html', '/site-manifest.json?v=crest2'],
    ['celebration.html', '/manifest.json'],
  ];
  for (const [path, manifest] of pages) {
    const html = get(path).toString('utf8');
    assert.ok(html.includes('rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"'), path);
    assert.ok(html.includes('name="apple-mobile-web-app-title" content="Stammtisch"'), path);
    assert.ok(html.includes('rel="manifest" href="' + manifest + '"'), path);
    assert.ok(html.includes('/assets/favicon.png?v=crest2'), path);
    assert.equal((html.match(/rel="apple-touch-icon"/g) || []).length, 1, path);
  }
});

test('the Club and Celebration of Life app identities remain distinct', () => {
  const main = JSON.parse(get('site-manifest.json').toString('utf8'));
  const col = JSON.parse(get('manifest.json').toString('utf8'));
  assert.equal(main.id, '/');
  assert.equal(main.start_url, '/');
  assert.equal(col.id, '/celebration.html');
  assert.equal(col.start_url, '/celebration.html');
  for (const manifest of [main, col]) {
    assert.equal(manifest.short_name, 'Stammtisch');
    assert.equal(manifest.name, 'Stammtisch Social Club');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.scope, '/');
    const entries = manifest.icons.map(i => [i.src, i.sizes, i.purpose]);
    assert.deepEqual(entries, [
      ['/assets/app-icon-192.png', '192x192', 'any'],
      ['/assets/app-icon-512.png', '512x512', 'any'],
      ['/assets/app-icon-maskable-512.png', '512x512', 'maskable']
    ]);
  }
});
