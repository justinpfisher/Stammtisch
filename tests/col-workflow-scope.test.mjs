import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=name=>readFileSync(new URL('../.github/workflows/'+name,import.meta.url),'utf8');

test('new CoL candidate alone runs whole-code qualification while every phase retains signed publication',()=>{
  const wf=read('annals-col-rules-v3.yml');
  const step=wf.split('      - name: Qualify code once for a new CoL candidate',2)[1]
    .split('      - name: Install existing read-only monitor dependencies',1)[0];
  assert.match(step,/if: github\.event\.action == 'annals-col-candidate-v3'/);
  assert.match(step,/run: node scripts\/local-dev\.mjs check/);
  assert.match(wf,/run: node scripts\/annals\/run-staged-col\.mjs/);
  assert.match(wf,/Verify final independent Viewer source/);
  assert.match(wf,/Commit immutable package and compare-and-swap ledger/);
});

test('merged numerical engine changes automatically receive exact-main Viewer qualification',()=>{
  const wf=read('col-source-observe.yml');
  assert.match(wf,/push:\n    branches: \[main\]/);
  assert.match(wf,/col-numeric-\*\.mjs/);
  assert.match(wf,/\.github\/workflows\/col-source-observe\.yml/);
  assert.match(wf,/qualification == 'prospective' \|\| github\.event_name == 'push'/);
  assert.match(wf,/Qualify prospective calculations against the independent Viewer source/);
  assert.match(wf,/Preserve public-safe observation/);
});

test('Sheet processing tests the affected score/push modules and keeps source verification',()=>{
  const wf=read('celebration-sheet-monitor.yml');
  const step=wf.split('      - name: Verify generated site data and award calculations',2)[1]
    .split('      - name: Commit verified website data',1)[0];
  assert.match(step,/steps\.public_changes\.outputs\.changed == 'true'/);
  assert.match(step,/python -m unittest discover -s tests -p 'test_\*\.py'/);
  assert.match(step,/node --test tests\/celebration\*\.test\.mjs tests\/col-\*\.test\.mjs/);
  assert.doesNotMatch(step,/node --test tests\/\*\.test\.mjs/);
  assert.match(wf,/scripts\/verify-celebration-publication\.py/);
  assert.match(wf,/git push origin HEAD:main/);
});

test('routine successful Sheet changes no longer generate public issues while failures still alert',()=>{
  const wf=readFileSync(new URL('../.github/workflows/celebration-sheet-monitor.yml',import.meta.url),'utf8');
  assert.doesNotMatch(wf,/Open or update a metadata-only change alert|Record successful website publication|site-published:/);
  assert.match(wf,/Reconcile current Sheet with published website data/);
  assert.match(wf,/Commit verified website data/);
  assert.match(wf,/Verify visitor-facing website register/);
  assert.match(wf,/Upload encrypted baseline and report/);
  assert.match(wf,/Open or update a monitor failure alert/);
  assert.match(wf,/independent verification required/);
  assert.match(wf,/season transition requires engineering/);
});
