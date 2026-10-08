import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const helper = fileURLToPath(new URL('../scripts/local-dev.mjs', import.meta.url));

function invoke(...args) {
  return spawnSync(process.execPath, [helper, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

test('local development helper describes non-publishing commands', () => {
  const result = invoke('--help');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /GMKtec preferred/);
  assert.match(result.stdout, /doctor/);
  assert.match(result.stdout, /check/);
  assert.match(result.stdout, /preview/);
  assert.match(result.stdout, /No command publishes/);
});

test('unknown local development commands fail closed', () => {
  const result = invoke('publish');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unknown task/);
});

test('public repository production and CI workflows remain GitHub-hosted', () => {
  for (const file of [
    'celebration-ci.yml',
    'celebration-push.yml',
    'celebration-sheet-monitor.yml',
  ]) {
    const workflow = readFileSync(
      new URL('../.github/workflows/' + file, import.meta.url), 'utf8',
    );
    assert.match(workflow, /runs-on:\s*ubuntu-latest\b/, file);
    assert.doesNotMatch(workflow, /runs-on:\s*[^\n]*(?:self-hosted|gmktec)/i, file);
  }
});
