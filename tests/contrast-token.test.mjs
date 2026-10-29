import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

function colorToken(name) {
  const match = css.match(new RegExp(name + '\\s*:\\s*(#[0-9a-f]{6})', 'i'));
  assert.ok(match, `Missing CSS color token ${name}`);
  return match[1];
}

function luminance(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map(value => parseInt(value, 16) / 255);
  const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('brass text meets normal-text contrast on paper surfaces', () => {
  const brass = colorToken('--brass');
  for (const surface of ['--paper', '--paper-deep']) {
    const ratio = contrast(brass, colorToken(surface));
    assert.ok(ratio >= 4.5, `${surface} contrast is ${ratio.toFixed(3)}:1`);
  }
  assert.ok(contrast(brass, '#fcf9f0') >= 4.5, 'Brass on the light card surface must meet 4.5:1');
});
