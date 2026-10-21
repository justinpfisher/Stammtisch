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
